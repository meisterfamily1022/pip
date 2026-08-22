import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ParentDetailScreen } from '@/components/parent-ui';
import { AccentColorPicker, AvatarPicker, ProfileAvatar } from '@/components/profile-ui';
import {
  Banner,
  ConfirmationDialog,
  FilterChip,
  ListCard,
  ListRow,
  OptionCard,
  PrimaryButton,
  RoundedTextInput,
  SegmentedControl,
  SkeletonRows,
  ToggleRow,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import {
  AGE_RANGES,
  CHOICE_COUNTS,
  DEFAULT_ACCENT_COLOR_ID,
  DEFAULT_AVATAR_ID,
  DEFAULT_CHOICE_COUNT,
  DEFAULT_READING_SUPPORT,
  READING_SUPPORT_LABELS,
  READING_SUPPORTS,
} from '@/domain/child-avatars';
import type { ChoiceLimit } from '@/domain/models';
import {
  addChildProfile,
  countChildHistory,
  deleteChildProfile,
  describeHistoryDisposition,
  loadChildProfile,
  saveChildProfile,
  setChildHidden,
  type ChildHistoryDisposition,
} from '@/features/children/child-profile-service';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Adds or edits one child profile.
 *
 * Collects a nickname and presentation preferences only. Pip never asks for a
 * birthday, legal name, school, or anything diagnostic.
 */
const HISTORY_CHOICES: readonly ChildHistoryDisposition[] = ['delete', 'anonymise'];

export default function EditChildRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const childId = /^\d+$/.test(rawId ?? '') ? Number(rawId) : null;

  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [accentColorId, setAccentColorId] = useState(DEFAULT_ACCENT_COLOR_ID);
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [choiceLimit, setChoiceLimit] = useState<ChoiceLimit>(DEFAULT_CHOICE_COUNT);
  const [readingSupport, setReadingSupport] = useState<string>(DEFAULT_READING_SUPPORT);
  const [loading, setLoading] = useState(childId !== null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  // Removing a profile and erasing what Pip remembers about a child are two
  // different intentions. The parent says which; the code does not assume.
  const [historyChoice, setHistoryChoice] = useState<ChildHistoryDisposition>('delete');
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (childId === null) return;
    let active = true;
    void (async () => {
      try {
        const database = await initializeDatabase();
        const profile = await loadChildProfile(database, childId);
        if (!active || !profile) return;
        setName(profile.name);
        setAvatarId(profile.avatarId);
        setAccentColorId(profile.accentColorId);
        setAgeRange(profile.ageRange);
        setChoiceLimit(profile.choiceLimit);
        setReadingSupport(profile.readingSupport);
        setPaused(profile.hiddenAt !== null);
      } catch (caught: unknown) {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load that profile.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [childId]);

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      const details = { name, avatarId, accentColorId, ageRange, choiceLimit, readingSupport };
      if (childId === null) await addChildProfile(database, details);
      else await saveChildProfile(database, childId, details);
      router.replace({ pathname: '/parent/children' });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not save that profile.');
    } finally {
      setSaving(false);
    }
  };

  const togglePaused = async (next: boolean): Promise<void> => {
    if (childId === null || busy) return;
    setBusy(true);
    setPaused(next);
    try {
      const database = await initializeDatabase();
      await setChildHidden(database, childId, next);
    } catch (caught: unknown) {
      setPaused(!next);
      setError(caught instanceof Error ? caught.message : 'That could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (childId === null) return;
    setBusy(true);
    try {
      const database = await initializeDatabase();
      await deleteChildProfile(database, childId, historyChoice);
      router.replace({ pathname: '/parent/children' });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That profile could not be deleted.');
      setPendingDelete(false);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <ParentDetailScreen backLabel="Children" backTo={parentBackTargets.editChild}>
        <SkeletonRows label="Loading this profile…" rows={3} />
      </ParentDetailScreen>
    );
  }

  return (
    <ParentDetailScreen
      backLabel="Children"
      backTo={parentBackTargets.editChild}
      footer={
        <PrimaryButton
          busy={saving}
          disabled={name.trim().length < 2}
          label={childId === null ? 'Add this child' : 'Save profile'}
          onPress={() => {
            void save();
          }}
        />
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        {childId === null ? 'Add a child' : name.trim() || 'Edit profile'}
      </Text>

      {error ? <Banner message={error} tone="alert" /> : null}

      <View style={styles.preview}>
        <ProfileAvatar accentColorId={accentColorId} avatarId={avatarId} decorative size={64} />
        <View style={styles.previewCopy}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text numberOfLines={1} style={styles.previewName}>{name.trim() || 'This profile'}</Text>
          <Text numberOfLines={1} style={styles.previewMeta}>
            {`${choiceLimit} ${choiceLimit === 1 ? 'choice' : 'choices'} · ${READING_SUPPORT_LABELS[readingSupport as keyof typeof READING_SUPPORT_LABELS] ?? READING_SUPPORT_LABELS['pictures-words']}`}
          </Text>
        </View>
      </View>

      <RoundedTextInput
        accessibilityLabel="Child name"
        label="Name"
        onChangeText={setName}
        placeholder="For example, Ada"
        returnKeyType="done"
        value={name}
      />

      <AvatarPicker accentColorId={accentColorId} onChange={setAvatarId} value={avatarId} />
      <AccentColorPicker onChange={setAccentColorId} value={accentColorId} />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>How many choices at once?</Text>
        <SegmentedControl<ChoiceLimit>
          accessibilityLabel="How many choices at once"
          getOptionLabel={(count) => `${count} toy${count === 1 ? '' : 's'}`}
          onChange={setChoiceLimit}
          options={CHOICE_COUNTS}
          value={choiceLimit}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>How {name.trim() || 'this child'} sees toys</Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {READING_SUPPORTS.map((support) => (
            <OptionCard
              description={
                support === 'pictures' ? 'For children who don’t read yet'
                  : support === 'pictures-words' ? 'Toy names appear under each photo'
                    : 'A speaker button reads each name aloud'
              }
              key={support}
              onPress={() => setReadingSupport(support)}
              selected={readingSupport === support}
              title={READING_SUPPORT_LABELS[support]}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Rough age range (optional)</Text>
        <View style={styles.chips}>
          {AGE_RANGES.map((range) => (
            <FilterChip
              key={range}
              label={range}
              onPress={() => setAgeRange((current) => (current === range ? null : range))}
              selected={ageRange === range}
            />
          ))}
        </View>
        <Text style={styles.hint}>Used only to pitch wording. Pip never stores a birthday.</Text>
      </View>

      {childId !== null ? (
        <>
          <ToggleRow
            description="Paused profiles stay saved but are not offered in Child Mode."
            disabled={busy}
            label="Pause this profile"
            onValueChange={(value) => {
              void togglePaused(value);
            }}
            value={paused}
          />

          <View style={styles.danger}>
            <Text style={styles.dangerLabel}>DANGER AREA</Text>
            <ListCard>
              <ListRow
                accessory="none"
                detail="Removes this profile. You choose what happens to its play history. Toys, rooms and photos are untouched."
                icon="trash"
                onPress={() => {
                  setHistoryChoice('delete');
                  setHistoryCount(null);
                  setPendingDelete(true);
                  // Loaded so the choice is made knowing what is actually at stake.
                  void (async () => {
                    const database = await initializeDatabase();
                    setHistoryCount(await countChildHistory(database, childId ?? -1));
                  })();
                }}
                title="Delete this profile"
                tone="danger"
              />
            </ListCard>
          </View>
        </>
      ) : null}

      <ConfirmationDialog
        busy={busy}
        cancelLabel="Keep the profile"
        confirmLabel="Delete profile"
        destructive
        message={`This removes ${name.trim() || 'this child'}'s profile. Your toys, rooms, storage spots and photos are not affected. This cannot be undone.`}
        onCancel={() => { setPendingDelete(false); setHistoryCount(null); }}
        onConfirm={() => {
          void remove();
        }}
        title={`Delete ${name.trim() || 'this profile'}?`}
        visible={pendingDelete}
      >
        {historyCount ? (
          <View style={styles.historyChoice}>
            <Text style={styles.historyLabel}>Their play history</Text>
            <SegmentedControl
              accessibilityLabel="What happens to this profile's play history"
              getOptionLabel={(option: ChildHistoryDisposition) => (option === 'delete' ? 'Delete it' : 'Keep it, unnamed')}
              onChange={(value) => setHistoryChoice(value)}
              options={HISTORY_CHOICES}
              value={historyChoice}
            />
            <Text style={styles.historyHint}>{describeHistoryDisposition(historyChoice, historyCount)}</Text>
          </View>
        ) : null}
      </ConfirmationDialog>
    </ParentDetailScreen>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  preview: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    padding: theme.spacing[12],
  },
  previewCopy: { flex: 1, gap: 1 },
  previewLabel: { color: theme.colors.mutedText, ...theme.typography.caption },
  previewName: { color: theme.colors.primaryText, ...theme.typography.rowTitle },
  previewMeta: { color: theme.colors.secondaryText, ...theme.typography.meta },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  options: { gap: theme.spacing[8] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  hint: { color: theme.colors.mutedText, ...theme.typography.meta },
  danger: { gap: theme.spacing[8] },
  dangerLabel: { color: theme.colors.error, ...theme.typography.eyebrow },
  historyChoice: { gap: theme.spacing[8] },
  historyLabel: { color: theme.colors.text, ...theme.typography.fieldLabel },
  historyHint: { color: theme.colors.mutedText, ...theme.typography.supporting },
});
