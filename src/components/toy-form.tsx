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

import { PipIcon } from './pip-icon';
import { ToyBatchReview } from './toy-batch-review';
import {
  Banner,
  FilterChip,
  ListCard,
  ListRow,
  PrimaryButton,
  RoundedSelect,
  RoundedTextInput,
  SecondaryButton,
  SegmentedControl,
  Sheet,
  ToggleRow,
  ToyImage,
} from './playmap-ui';

const CATEGORY_LABELS: Record<PlayCategory, string> = {
  quiet: 'Quiet', active: 'Active', creative: 'Make', building: 'Build', pretend: 'Pretend',
  sensory: 'Touch & feel', independent: 'Alone', together: 'Together', indoor: 'Indoor', outdoor: 'Outdoor',
};

type ToyFormProps = {
  locations: LocationTreeItem[];
  toy?: ParentToy;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit(input: ToyFormInput): Promise<void>;
  onBulkSubmit?(drafts: readonly ToySetupDraft[]): Promise<ToySetupDraft[]>;
  onCameraBlocked?(): void;
  startInBulkMode?: boolean;
};

type IntakeFeedback = { tone: 'neutral' | 'success' | 'error'; message: string } | null;

export function ToyForm({ locations, toy, saving, error, submitLabel, onSubmit, onBulkSubmit, onCameraBlocked, startInBulkMode = false }: ToyFormProps) {
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
  const [picker, setPicker] = useState<'room' | 'spot' | null>(null);
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
      } else if (result.blockedPermission === 'camera' && onCameraBlocked) {
        onCameraBlocked();
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
      } else if (result.blockedPermission === 'camera' && onCameraBlocked) {
        onCameraBlocked();
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

  const roomOptions = locations.map((room) => ({ id: room.id, label: room.name }));

  return (
    <View style={styles.content}>
      {error ? <Banner message={error} tone="alert" /> : null}
      {feedback ? <Banner message={feedback.message} tone={feedback.tone === 'error' ? 'alert' : feedback.tone === 'success' ? 'success' : 'info'} /> : null}
      {validationError ? <Banner message={validationError} tone="alert" /> : null}

      {!toy && onBulkSubmit && drafts.length > 0 ? (
        <ToyBatchReview
          drafts={drafts}
          locations={locations}
          onAddMore={() => { void chooseFromLibrary(true); }}
          onCaptureMore={() => { void captureForIntakeQueue(); }}
          onRemove={removeDraft}
          onReplace={(draft) => { replacingDraft.current = draft; void chooseFromLibrary(false, draft); }}
          onSaveAll={() => { void saveBatch(); }}
          onUpdate={updateDraft}
          saving={saving || intakeBusy}
        />
      ) : (
        <>
          {manualFeedback ? (
            <Banner message={manualFeedback.message} tone={manualFeedback.tone === 'error' ? 'alert' : manualFeedback.tone === 'success' ? 'success' : 'info'} />
          ) : null}

          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Photo</Text>
            <Pressable
              accessibilityHint="Opens your photo library"
              accessibilityLabel={selectedImageUri ? 'Change the toy photo' : 'Add a toy photo'}
              accessibilityRole="button"
              disabled={saving || intakeBusy}
              onPress={() => { void chooseFromLibrary(); }}
              style={({ pressed }) => [styles.uploadZone, pressed && styles.pressed]}
            >
              {selectedImageUri ? (
                <ToyImage accessibilityLabel="Selected toy photo" style={styles.uploadImage} uri={selectedImageUri} />
              ) : (
                <View accessibilityElementsHidden style={styles.uploadHint}>
                  <PipIcon color={theme.colors.brandInk} name="camera" size={26} />
                  <Text style={styles.uploadTitle}>No photo yet</Text>
                  <Text style={styles.uploadCaption}>A photo is optional. You can add one later.</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.actions}>
              <SecondaryButton disabled={saving || intakeBusy} icon="camera" label="Camera" onPress={() => { void openSystemCamera(); }} style={styles.action} />
              <SecondaryButton disabled={saving || intakeBusy} icon="photos" label="Photos" onPress={() => { void chooseFromLibrary(); }} style={styles.action} />
              {selectedImageUri ? (
                <SecondaryButton
                  disabled={saving || intakeBusy}
                  label="Remove"
                  onPress={() => {
                    setSourceImageUri(null);
                    setExistingImageUri(null);
                    setManualFeedback({ tone: 'neutral', message: 'Photo removed. You can still save this toy.' });
                  }}
                  style={styles.action}
                />
              ) : null}
            </View>
          </View>

          <RoundedTextInput
            accessibilityLabel="Toy name"
            label="Toy name"
            onChangeText={(value) => { setName(value); setValidationError(null); }}
            placeholder="Magnetic tiles"
            returnKeyType="done"
            value={name}
          />

          <RoundedSelect
            label="Room"
            onPress={() => setPicker('room')}
            value={locations.find((room) => room.id === roomId)?.name}
          />
          <RoundedSelect
            label="Storage spot"
            onPress={() => setPicker('spot')}
            value={availableSpots.find((spot) => spot.id === effectiveStorageSpotId)?.name}
          />

          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Kind of play</Text>
            <Text accessibilityLabel="Why Pip asks for kinds of play" style={styles.helperText}>
              These help Pip offer choices that fit the moment.
            </Text>
            <View style={styles.chips}>
              {PLAY_CATEGORIES.map((category) => (
                <FilterChip
                  key={category}
                  label={CATEGORY_LABELS[category]}
                  onPress={() => { toggleCategory(category); setValidationError(null); }}
                  selected={categories.includes(category)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Tidy-up size</Text>
            <SegmentedControl<ToyFormInput['cleanupDifficulty']>
              accessibilityLabel="Tidy-up size"
              getOptionLabel={(value) => (value === 'easy' ? 'Quick' : value === 'medium' ? 'Some' : 'Big')}
              onChange={setCleanupDifficulty}
              options={['easy', 'medium', 'big']}
              value={cleanupDifficulty}
            />
          </View>

          <ToggleRow
            description="Mark toys that need a grown-up nearby."
            label="Grown-up help needed"
            onValueChange={setAdultHelpRequired}
            value={adultHelpRequired}
          />
          <ToggleRow
            description="Offer this toy as a choice in Child Mode."
            label="Shown in Child Mode"
            onValueChange={setIsAvailable}
            value={isAvailable}
          />

          <PrimaryButton busy={saving} label={saving ? 'Saving…' : submitLabel} onPress={() => { void submit(); }} />

          <Sheet onDismiss={() => setPicker(null)} title={picker === 'room' ? 'Which room?' : 'Which spot?'} visible={picker !== null}>
            <ListCard>
              {(picker === 'room' ? roomOptions : availableSpots.map((spot) => ({ id: spot.id, label: spot.name }))).map((option) => (
                <ListRow
                  accessory={
                    (picker === 'room' ? option.id === roomId : option.id === effectiveStorageSpotId) ? 'check' : 'none'
                  }
                  key={option.id}
                  onPress={() => {
                    if (picker === 'room') {
                      setRoomId(option.id);
                      setStorageSpotId(locations.find((room) => room.id === option.id)?.storageSpots[0]?.id ?? null);
                    } else {
                      setStorageSpotId(option.id);
                    }
                    setPicker(null);
                  }}
                  title={option.label}
                />
              ))}
            </ListCard>
            <SecondaryButton label="Cancel" onPress={() => setPicker(null)} />
          </Sheet>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing[16] },
  pressed: { opacity: 0.72 },
  section: { gap: 6 },
  fieldLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  helperText: { color: theme.colors.secondaryText, ...theme.typography.meta },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  actions: { flexDirection: 'row', gap: theme.spacing[8] },
  action: { flex: 1, minHeight: theme.measurements.minimumTouchTarget, paddingHorizontal: theme.spacing[8] },
  uploadZone: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 180,
    overflow: 'hidden',
  },
  uploadImage: { aspectRatio: 4 / 3, width: '100%' },
  uploadHint: { alignItems: 'center', gap: 5, padding: theme.spacing[24] },
  uploadTitle: { color: theme.colors.primaryText, ...theme.typography.label },
  uploadCaption: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.meta },
});
