import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ToySetupDraft } from '@/domain/models';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import type { LocationTreeItem } from '@/features/locations/location-service';
import { draftCategories, intakeDraftErrors, summarizeIntakeQueue, type IntakeDraftPatch } from '@/features/toys/toy-intake-queue';
import { playmapTheme as theme } from '@/theme/playmap-theme';

import { Card, ImageTile, PrimaryButton, QuietButton, RoundedTextInput, ToggleRow } from './playmap-ui';

const categoryLabels: Record<PlayCategory, string> = {
  quiet: 'Quiet', active: 'Active', creative: 'Creative', building: 'Building', pretend: 'Pretend',
  sensory: 'Sensory', independent: 'Independent', together: 'Together', indoor: 'Indoor', outdoor: 'Outdoor',
};

export function ToyBatchReview({
  drafts, locations, saving, onAddMore, onCaptureMore, onSaveAll, onUpdate, onReplace, onRemove,
}: {
  drafts: readonly ToySetupDraft[];
  locations: LocationTreeItem[];
  saving: boolean;
  onAddMore(): void;
  onCaptureMore(): void;
  onSaveAll(): void;
  onUpdate(draft: ToySetupDraft, patch: IntakeDraftPatch): Promise<void>;
  onReplace(draft: ToySetupDraft): void;
  onRemove(draft: ToySetupDraft): Promise<void>;
}) {
  const summary = summarizeIntakeQueue(drafts);
  const validPending = drafts.filter((draft) => draft.savedToyId === null && intakeDraftErrors(draft).length === 0).length;
  return <View style={styles.queue}>
    <Card tone="sage">
      <Text accessibilityRole="header" style={styles.queueTitle}>Review toy photos</Text>
      <Text style={styles.copy}>Each photo becomes one toy. Confirm the details below before saving.</Text>
      <View accessibilityLabel={`${summary.total} selected, ${summary.completed} completed, ${summary.incomplete} incomplete, ${summary.failed} failed`} style={styles.summary}>
        <Summary label="Selected" value={summary.total} />
        <Summary label="Completed" value={summary.completed} />
        <Summary label="Incomplete" value={summary.incomplete} />
        <Summary label="Failed" value={summary.failed} />
      </View>
      <View style={styles.actionRow}><QuietButton disabled={saving} label="Add More Photos" onPress={onAddMore} /><QuietButton disabled={saving} label="Take Another Photo" onPress={onCaptureMore} /><PrimaryButton disabled={saving || validPending === 0} label={saving ? 'Saving valid toys…' : `Save ${validPending} Valid ${validPending === 1 ? 'Toy' : 'Toys'}`} onPress={onSaveAll} /></View>
      {summary.incomplete > 0 && <Text style={styles.help}>{summary.incomplete} incomplete {summary.incomplete === 1 ? 'record remains' : 'records remain'} editable and will not be saved yet.</Text>}
    </Card>
    {drafts.map((draft, index) => <BatchDraftCard key={draft.id} draft={draft} index={index} locations={locations} saving={saving} onUpdate={onUpdate} onReplace={onReplace} onRemove={onRemove} />)}
  </View>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function BatchDraftCard({ draft, index, locations, saving, onUpdate, onReplace, onRemove }: {
  draft: ToySetupDraft; index: number; locations: LocationTreeItem[]; saving: boolean;
  onUpdate(draft: ToySetupDraft, patch: IntakeDraftPatch): Promise<void>;
  onReplace(draft: ToySetupDraft): void;
  onRemove(draft: ToySetupDraft): Promise<void>;
}) {
  const [name, setName] = useState(draft.draftName ?? '');
  const categories = draftCategories(draft);
  const room = locations.find((candidate) => candidate.id === draft.roomId);
  const spots = room?.storageSpots ?? [];
  const errors = intakeDraftErrors(draft);
  const saved = draft.savedToyId !== null;
  const persist = (patch: IntakeDraftPatch): void => { if (!saved) void onUpdate(draft, patch); };
  const toggleCategory = (category: PlayCategory): void => persist({ categories: categories.includes(category) ? categories.filter((item) => item !== category) : [...categories, category] });

  return <Card style={saved ? styles.savedCard : undefined}>
    <View style={styles.cardHeading}>
      <ImageTile label={`Toy photo ${index + 1}`} size={112} uri={draft.originalImageUri} />
      <View style={styles.headingCopy}><Text accessibilityRole="header" style={styles.cardTitle}>Toy {index + 1}</Text><Text accessibilityLiveRegion="polite" style={[styles.status, saved ? styles.success : draft.saveError ? styles.error : errors.length ? styles.incomplete : styles.ready]}>{saved ? 'Saved' : draft.saveError ? 'Save failed — edit and retry' : errors.length ? 'Incomplete' : 'Ready to save'}</Text><View style={styles.actionRow}>{!saved && <QuietButton disabled={saving} label="Replace Photo" onPress={() => onReplace(draft)} />}<QuietButton disabled={saving} label={saved ? 'Remove from Queue' : 'Remove Photo'} onPress={() => { void onRemove(draft); }} /></View></View>
    </View>
    {draft.saveError && <Text accessibilityLiveRegion="polite" style={styles.errorBox}>{draft.saveError}</Text>}
    {!saved && errors.length > 0 && <Text accessibilityLiveRegion="polite" style={styles.errorBox}>{errors.join(' ')}</Text>}
    <RoundedTextInput accessibilityLabel={`Toy ${index + 1} name`} editable={!saved && !saving} label="Toy name" onChangeText={(value) => { setName(value); persist({ name: value }); }} placeholder="Enter a name" value={name} />
    <Text style={styles.label}>Room</Text>
    <View style={styles.options}>{locations.map((candidate) => <Option key={candidate.id} disabled={saved || saving} label={candidate.name} selected={draft.roomId === candidate.id} onPress={() => persist({ roomId: candidate.id, storageSpotId: null })} />)}</View>
    <Text style={styles.label}>Storage spot</Text>
    <View style={styles.options}>{spots.length ? spots.map((spot) => <Option key={spot.id} disabled={saved || saving} label={spot.name} selected={draft.storageSpotId === spot.id} onPress={() => persist({ storageSpotId: spot.id })} />) : <Text style={styles.help}>Choose a room first.</Text>}</View>
    <Text style={styles.label}>Category</Text>
    <View style={styles.options}>{PLAY_CATEGORIES.map((category) => <Option key={category} disabled={saved || saving} label={categoryLabels[category]} selected={categories.includes(category)} onPress={() => toggleCategory(category)} />)}</View>
    <Text style={styles.label}>Cleanup required</Text>
    <View style={styles.options}>{(['easy', 'medium', 'big'] as const).map((difficulty) => <Option key={difficulty} disabled={saved || saving} label={difficulty === 'easy' ? 'Quick cleanup' : difficulty === 'medium' ? 'Some cleanup' : 'Big cleanup'} selected={(draft.cleanupDifficultyDraft ?? 'easy') === difficulty} onPress={() => persist({ cleanupDifficulty: difficulty })} />)}</View>
    <ToggleRow disabled={saved || saving} label="Adult help required" value={draft.adultHelpRequiredDraft ?? false} onValueChange={(value) => persist({ adultHelpRequired: value })} />
    <ToggleRow disabled={saved || saving} label="Available to child" value={draft.isAvailableDraft} onValueChange={(value) => persist({ isAvailable: value })} />
  </Card>;
}

function Option({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}><Text style={styles.optionText}>{selected ? '✓ ' : ''}{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  queue: { gap: 16 },
  queueTitle: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 25, fontWeight: '700' },
  copy: { color: theme.colors.secondaryText, fontSize: 15, lineHeight: 22 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryItem: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, minWidth: 92, padding: 10 },
  summaryValue: { color: theme.colors.primaryText, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: theme.colors.secondaryText, fontSize: 12 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardHeading: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  headingCopy: { flex: 1, gap: 8, minWidth: 180 },
  cardTitle: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700' },
  status: { alignSelf: 'flex-start', borderRadius: theme.radii.pill, fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  success: { backgroundColor: theme.colors.successSoft, color: theme.colors.success },
  error: { backgroundColor: theme.colors.errorSoft, color: theme.colors.error },
  incomplete: { backgroundColor: theme.colors.surfaceYellow, color: theme.colors.primaryText },
  ready: { backgroundColor: theme.colors.surfaceMint, color: theme.colors.sageAction },
  savedCard: { opacity: 0.8 },
  errorBox: { backgroundColor: theme.colors.errorSoft, borderRadius: theme.radii.md, color: theme.colors.error, padding: 10 },
  label: { color: theme.colors.primaryText, fontSize: 15, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: theme.measurements.minimumTouchTarget, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: theme.colors.surfaceMint, borderColor: theme.colors.sageAction, borderWidth: 2 },
  optionText: { color: theme.colors.primaryText, fontSize: 13, fontWeight: '600' },
  help: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19 },
  disabled: { opacity: 0.55 },
});
