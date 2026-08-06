import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '@/database/client';
import type { ToySetupDraft } from '@/domain/models';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import type { LocationTreeItem } from '@/features/locations/location-service';
import {
  addImagesToIntakeQueue,
  applyIntakeDraftPatch,
  removeIntakeDraft,
  replaceIntakeDraftImage,
  updateIntakeDraft,
  type IntakeDraftPatch,
} from '@/features/toys/toy-intake-queue';
import { captureWithSystemCamera, recoverPendingToyImages, selectToyImages } from '@/features/toys/toy-media-intake';
import type { ToyFormInput } from '@/features/toys/toy-service';
import { listToySetupDrafts } from '@/features/toys/toy-setup-draft-repository';
import type { ParentToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

import { ToyBatchReview } from './toy-batch-review';
import { FormCard, PrimaryButton, QuietButton, RoundedTextInput, ToggleRow } from './playmap-ui';
import { ToyButton, ToyImagePreview } from './toy-ui';

const CATEGORY_LABELS: Record<PlayCategory, string> = {
  quiet: 'Quiet', active: 'Active', creative: 'Creative', building: 'Building', pretend: 'Pretend',
  sensory: 'Sensory', independent: 'Independent', together: 'Play Together', indoor: 'Indoor', outdoor: 'Outdoor',
};

type ToyFormProps = {
  locations: LocationTreeItem[];
  toy?: ParentToy;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit(input: ToyFormInput): Promise<void>;
  onBulkSubmit?(drafts: readonly ToySetupDraft[]): Promise<ToySetupDraft[]>;
  startInBulkMode?: boolean;
};

type IntakeFeedback = { tone: 'neutral' | 'success' | 'error'; message: string } | null;

export function ToyForm({ locations, toy, saving, error, submitLabel, onSubmit, onBulkSubmit, startInBulkMode = false }: ToyFormProps) {
  const firstUsableRoom = locations.find((room) => room.storageSpots.length > 0);
  const [name, setName] = useState(toy?.name ?? '');
  const [sourceImageUri, setSourceImageUri] = useState<string | null>(null);
  const [existingImageUri, setExistingImageUri] = useState<string | null>(toy?.imageUri ?? null);
  const [roomId, setRoomId] = useState<number | null>(toy?.roomId ?? firstUsableRoom?.id ?? null);
  const availableSpots = useMemo(() => locations.find((room) => room.id === roomId)?.storageSpots ?? [], [locations, roomId]);
  const [storageSpotId, setStorageSpotId] = useState<number | null>(toy?.storageSpotId ?? firstUsableRoom?.storageSpots[0]?.id ?? null);
  const [categories, setCategories] = useState<PlayCategory[]>(toy?.categories ?? []);
  const [cleanupDifficulty, setCleanupDifficulty] = useState<ToyFormInput['cleanupDifficulty']>(toy?.cleanupDifficulty ?? 'easy');
  const [adultHelpRequired, setAdultHelpRequired] = useState(toy?.adultHelpRequired ?? false);
  const [isAvailable, setIsAvailable] = useState(toy?.isAvailable ?? true);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [feedback, setFeedback] = useState<IntakeFeedback>(null);
  const [manualFeedback, setManualFeedback] = useState<IntakeFeedback>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ToySetupDraft[]>([]);
  const replacingDraft = useRef<ToySetupDraft | null>(null);
  const draftWriteChains = useRef(new Map<string, Promise<void>>());
  const batchSaving = useRef(false);

  const selectedImageUri = sourceImageUri ?? existingImageUri;
  const effectiveStorageSpotId = availableSpots.some((spot) => spot.id === storageSpotId) ? storageSpotId : availableSpots[0]?.id ?? null;

  useEffect(() => {
    if (toy || !onBulkSubmit) return;
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const database = await initializeDatabase();
        const [storedDrafts, pending] = await Promise.all([listToySetupDrafts(database), recoverPendingToyImages()]);
        if (!active) return;
        setDrafts(storedDrafts);
        if (!pending) return;
        if (pending.error) setFeedback({ tone: 'error', message: pending.error });
        else if (pending.uris.length > 1) {
          const added = await addImagesToIntakeQueue(database, pending.uris);
          if (active) {
            setDrafts(await listToySetupDrafts(database));
            setFeedback({ tone: added.failures.length ? 'error' : 'success', message: `${added.drafts.length} recovered ${added.drafts.length === 1 ? 'photo' : 'photos'} added to review.${added.failures.length ? ` ${added.failures.length} failed.` : ''}` });
          }
        } else if (pending.uris[0]) {
          setSourceImageUri(pending.uris[0]);
          setManualFeedback({ tone: 'success', message: 'Recovered the photo selected before the app restarted.' });
        }
      } catch (caught: unknown) {
        if (active) setFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Could not restore the photo review queue.' });
      }
    };
    void restore();
    return () => { active = false; };
  }, [onBulkSubmit, toy]);

  const chooseFromLibrary = async (multiple = false, replacement?: ToySetupDraft): Promise<void> => {
    if (saving || intakeBusy) return;
    const setIntakeFeedback = multiple || replacement ? setFeedback : setManualFeedback;
    setIntakeBusy(true);
    setIntakeFeedback({ tone: 'neutral', message: multiple ? 'Opening multiple-photo picker…' : replacement ? 'Opening photo picker to replace this image…' : 'Opening photo picker…' });
    try {
      const result = await selectToyImages(multiple);
      if (result.cancelled) {
        setIntakeFeedback({ tone: 'neutral', message: 'Photo selection canceled. Nothing was changed.' });
        return;
      }
      if (result.error && !result.uris.length) {
        setIntakeFeedback({ tone: 'error', message: result.error });
        return;
      }
      if (!result.uris.length) {
        setIntakeFeedback({ tone: 'error', message: 'No usable photo was selected.' });
        return;
      }
      setValidationError(null);
      if (replacement) {
        const database = await initializeDatabase();
        const updated = await replaceIntakeDraftImage(database, replacement, result.uris[0]!);
        setDrafts((current) => current.map((draft) => draft.id === updated.id ? updated : draft));
        setIntakeFeedback({ tone: 'success', message: 'Photo replaced. The toy details are unchanged.' });
      } else if (multiple) {
        const database = await initializeDatabase();
        const added = await addImagesToIntakeQueue(database, result.uris);
        setDrafts(await listToySetupDrafts(database));
        const warning = result.error ?? (added.failures.length ? `${added.failures.length} photo${added.failures.length === 1 ? '' : 's'} could not be prepared. ${added.failures[0]}` : null);
        setIntakeFeedback({ tone: warning ? 'error' : 'success', message: `${added.drafts.length} ${added.drafts.length === 1 ? 'photo is' : 'photos are'} ready to review.${warning ? ` ${warning}` : ''}` });
      } else {
        setSourceImageUri(result.uris[0]!);
        setIntakeFeedback({ tone: 'success', message: 'Photo selected. It will be copied into Pip when you save.' });
      }
    } catch (caught: unknown) {
      setIntakeFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'The photo action failed. Please try again.' });
    } finally {
      replacingDraft.current = null;
      setIntakeBusy(false);
    }
  };

  const openSystemCamera = async (): Promise<void> => {
    if (saving || intakeBusy) return;
    setIntakeBusy(true);
    setManualFeedback({ tone: 'neutral', message: 'Requesting camera permission and opening the device camera…' });
    try {
      const result = await captureWithSystemCamera();
      if (result.cancelled) {
        setManualFeedback({ tone: 'neutral', message: 'Camera canceled. Nothing was changed.' });
      } else if (result.error) {
        setManualFeedback({ tone: 'error', message: result.error });
      } else if (result.uris[0]) {
        setSourceImageUri(result.uris[0]);
        setManualFeedback({ tone: 'success', message: 'Photo captured. It will be copied into Pip when you save.' });
      } else {
        setManualFeedback({ tone: 'error', message: 'The camera did not return a usable photo.' });
      }
    } catch (caught: unknown) {
      setManualFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Could not open the camera. Choose a photo instead.' });
    } finally {
      setIntakeBusy(false);
    }
  };

  const captureForIntakeQueue = async (): Promise<void> => {
    if (saving || intakeBusy) return;
    setIntakeBusy(true);
    setFeedback({ tone: 'neutral', message: 'Requesting camera permission to add another review photo…' });
    try {
      const result = await captureWithSystemCamera();
      if (result.cancelled) {
        setFeedback({ tone: 'neutral', message: 'Camera canceled. The review queue is unchanged.' });
      } else if (result.error) {
        setFeedback({ tone: 'error', message: result.error });
      } else if (result.uris[0]) {
        const database = await initializeDatabase();
        const added = await addImagesToIntakeQueue(database, [result.uris[0]]);
        setDrafts(await listToySetupDrafts(database));
        setFeedback({ tone: added.failures.length ? 'error' : 'success', message: added.failures[0] ?? 'Camera photo added to the review queue. You can take another.' });
      } else {
        setFeedback({ tone: 'error', message: 'The camera did not return a usable photo.' });
      }
    } catch (caught: unknown) {
      setFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Could not add the camera photo.' });
    } finally {
      setIntakeBusy(false);
    }
  };

  const updateDraft = async (draft: ToySetupDraft, patch: IntakeDraftPatch): Promise<void> => {
    setDrafts((current) => current.map((candidate) => candidate.id === draft.id ? applyIntakeDraftPatch(candidate, patch) : candidate));
    const previous = draftWriteChains.current.get(draft.id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      const database = await initializeDatabase();
      const latest = (await listToySetupDrafts(database)).find((candidate) => candidate.id === draft.id) ?? draft;
      await updateIntakeDraft(database, latest, patch);
    }).catch((caught: unknown) => {
      setFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Could not save that draft change.' });
    });
    draftWriteChains.current.set(draft.id, next);
    await next;
    if (draftWriteChains.current.get(draft.id) === next) draftWriteChains.current.delete(draft.id);
  };

  const removeDraft = async (draft: ToySetupDraft): Promise<void> => {
    try {
      const database = await initializeDatabase();
      await removeIntakeDraft(database, draft);
      setDrafts((current) => current.filter((candidate) => candidate.id !== draft.id));
      setFeedback({ tone: 'neutral', message: draft.savedToyId ? 'Saved toy removed from this review queue. The toy remains in your library.' : 'Photo removed from the review queue.' });
    } catch (caught: unknown) {
      setFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Could not remove this photo.' });
    }
  };

  const saveBatch = async (): Promise<void> => {
    if (!onBulkSubmit || saving || batchSaving.current) return;
    batchSaving.current = true;
    setFeedback({ tone: 'neutral', message: 'Saving all valid toys. Incomplete records will stay here.' });
    try {
      await Promise.all(draftWriteChains.current.values());
      const database = await initializeDatabase();
      const persistedDrafts = await listToySetupDrafts(database);
      const next = await onBulkSubmit(persistedDrafts);
      setDrafts(next);
      const completed = next.filter((draft) => draft.savedToyId !== null).length;
      const failed = next.filter((draft) => draft.savedToyId === null && draft.saveError).length;
      setFeedback({ tone: failed ? 'error' : 'success', message: `${completed} ${completed === 1 ? 'toy is' : 'toys are'} saved.${failed ? ` ${failed} failed record${failed === 1 ? '' : 's'} remain editable for retry.` : ''}` });
    } catch (caught: unknown) {
      setFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Could not save the review queue. You can retry without creating duplicates.' });
    } finally {
      batchSaving.current = false;
    }
  };

  const toggleCategory = (category: PlayCategory): void => {
    setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  };

  const submit = async (): Promise<void> => {
    setValidationError(null);
    const nextValidationError = !name.trim() ? 'Enter a toy name.'
      : !roomId || !effectiveStorageSpotId ? 'Choose a room with a storage spot.'
      : categories.length === 0 ? 'Choose at least one play category.'
      : null;
    if (nextValidationError) { setValidationError(nextValidationError); return; }
    await onSubmit({ name, sourceImageUri, existingImageUri, roomId, storageSpotId: effectiveStorageSpotId, categories, cleanupDifficulty, adultHelpRequired, isAvailable });
  };

  return <View style={styles.content}>
    {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    {feedback && <Text accessibilityLiveRegion="polite" style={feedback.tone === 'error' ? styles.error : feedback.tone === 'success' ? styles.success : styles.notice}>{feedback.message}</Text>}
    {validationError && <Text accessibilityLiveRegion="polite" style={styles.error}>{validationError}</Text>}

    {!toy && onBulkSubmit && drafts.length > 0 && <ToyBatchReview drafts={drafts} locations={locations} saving={saving || intakeBusy} onAddMore={() => { void chooseFromLibrary(true); }} onCaptureMore={() => { void captureForIntakeQueue(); }} onRemove={removeDraft} onReplace={(draft) => { replacingDraft.current = draft; void chooseFromLibrary(false, draft); }} onSaveAll={() => { void saveBatch(); }} onUpdate={updateDraft} />}

    {!toy && onBulkSubmit && startInBulkMode && drafts.length === 0 && <FormCard tone="sage">
      <Text accessibilityRole="header" style={styles.sectionTitle}>Add multiple toys from photos</Text>
      <Text style={styles.caption}>Choose several photos, then create one separate toy record for each image. You will confirm every name, room, storage spot, category, and Child Mode setting before saving.</Text>
      <PrimaryButton disabled={saving || intakeBusy} label={intakeBusy ? 'Opening Photos…' : 'Choose Multiple Photos'} onPress={() => { void chooseFromLibrary(true); }} />
      <QuietButton disabled={saving || intakeBusy} label={intakeBusy ? 'Opening Camera…' : 'Take a Photo'} onPress={() => { void captureForIntakeQueue(); }} />
    </FormCard>}

    {manualFeedback && <Text accessibilityLiveRegion="polite" style={manualFeedback.tone === 'error' ? styles.error : manualFeedback.tone === 'success' ? styles.success : styles.notice}>{manualFeedback.message}</Text>}
    <FormCard>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{toy ? 'Toy photo' : startInBulkMode ? 'Or add one toy manually' : 'Add one toy manually'}</Text>
      <Text style={styles.caption}>A photo is optional. You can add or replace it later.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose a toy photo" disabled={saving || intakeBusy} onPress={() => { void chooseFromLibrary(); }} style={styles.uploadZone}>
        {selectedImageUri ? <ToyImagePreview uri={selectedImageUri} /> : <View accessibilityLabel="No photo yet" style={styles.uploadHint}><Text style={styles.cameraIcon}>⌾</Text><Text style={styles.uploadTitle}>No photo yet</Text><Text style={styles.uploadCaption}>Add a photo now, or save the toy without one.</Text></View>}
      </Pressable>
      <View style={styles.actions}>
        <ToyButton disabled={saving || intakeBusy} label={intakeBusy ? 'Opening Camera or Photos…' : 'Use Camera'} onPress={() => { void openSystemCamera(); }} />
        <ToyButton disabled={saving || intakeBusy} label={intakeBusy ? 'Opening Camera or Photos…' : 'Choose Photo'} onPress={() => { void chooseFromLibrary(); }} />
        {!toy && onBulkSubmit && !startInBulkMode && <ToyButton disabled={saving || intakeBusy} label="Choose Multiple" onPress={() => { void chooseFromLibrary(true); }} />}
        {selectedImageUri && <ToyButton disabled={saving || intakeBusy} label="Remove Photo" onPress={() => { setSourceImageUri(null); setExistingImageUri(null); setManualFeedback({ tone: 'neutral', message: 'Photo removed. You can still save this toy.' }); }} />}
      </View>
    </FormCard>

    <FormCard><RoundedTextInput accessibilityLabel="Toy name" label="Toy name" onChangeText={(value) => { setName(value); setValidationError(null); }} placeholder="Magnetic Tiles" value={name} /></FormCard>
    <FormCard><Text style={styles.label}>Room</Text><View style={styles.optionRow}>{locations.map((room) => <Option key={room.id} label={room.name} selected={room.id === roomId} onPress={() => { setRoomId(room.id); setStorageSpotId(room.storageSpots[0]?.id ?? null); }} />)}</View></FormCard>
    <FormCard><Text style={styles.label}>Storage spot</Text><View style={styles.optionRow}>{availableSpots.map((spot) => <Option key={spot.id} label={spot.name} selected={spot.id === effectiveStorageSpotId} onPress={() => setStorageSpotId(spot.id)} />)}</View></FormCard>
    <FormCard><Text style={styles.label}>Categories</Text><View style={styles.optionRow}>{PLAY_CATEGORIES.map((category) => <Pressable key={category} accessibilityRole="checkbox" accessibilityState={{ checked: categories.includes(category) }} onPress={() => { toggleCategory(category); setValidationError(null); }} style={[styles.option, categories.includes(category) && styles.optionSelected]}><Text style={styles.optionText}>{categories.includes(category) ? '✓ ' : ''}{CATEGORY_LABELS[category]}</Text></Pressable>)}</View></FormCard>
    <FormCard><Text style={styles.label}>Cleanup required</Text><View style={styles.optionRow}>{(['easy', 'medium', 'big'] as const).map((difficulty) => <Option key={difficulty} label={difficulty === 'easy' ? 'Quick cleanup' : difficulty === 'medium' ? 'Some cleanup' : 'Big cleanup'} selected={cleanupDifficulty === difficulty} onPress={() => setCleanupDifficulty(difficulty)} />)}</View></FormCard>
    <ToggleRow description="Mark toys that need a grown-up nearby." label="Adult help required" value={adultHelpRequired} onValueChange={setAdultHelpRequired} />
    <ToggleRow description="Show this toy as a choice in Child Mode." label="Available to child" value={isAvailable} onValueChange={setIsAvailable} />
    <PrimaryButton disabled={saving} label={saving ? 'Saving…' : submitLabel} onPress={() => { void submit(); }} />
  </View>;
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.option, selected && styles.optionSelected]}><Text style={styles.optionText}>{selected ? '✓ ' : ''}{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  content: { gap: 20 },
  error: { backgroundColor: theme.colors.errorSoft, borderRadius: theme.radii.md, color: theme.colors.danger, fontSize: 15, padding: 12 },
  success: { backgroundColor: theme.colors.successSoft, borderRadius: theme.radii.md, color: theme.colors.success, fontSize: 15, padding: 12 },
  notice: { backgroundColor: theme.colors.surfaceSage, borderRadius: theme.radii.md, color: theme.colors.primaryText, fontSize: 15, padding: 12 },
  caption: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 20 },
  label: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  sectionTitle: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700' },
  option: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14, paddingVertical: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionSelected: { backgroundColor: theme.colors.mintSoft, borderColor: theme.colors.primary, borderWidth: 2 },
  optionText: { color: theme.colors.text, fontSize: 15 },
  uploadZone: { alignItems: 'center', backgroundColor: theme.colors.surfaceWarm, borderColor: theme.colors.peach, borderRadius: theme.radii.lg, borderStyle: 'dashed', borderWidth: 2, minHeight: 210, overflow: 'hidden', justifyContent: 'center' },
  uploadHint: { alignItems: 'center', gap: 5, padding: 24 }, cameraIcon: { color: theme.colors.coral, fontSize: 38 }, uploadTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' }, uploadCaption: { color: theme.colors.mutedText, fontSize: 13, textAlign: 'center' },
});
