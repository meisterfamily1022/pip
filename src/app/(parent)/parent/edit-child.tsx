import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NoticeBanner } from '@/components/auth-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import { AccentColorPicker, AvatarPicker, ProfileAvatar } from '@/components/profile-ui';
import { FormCard, LoadingState, PageShell, PrimaryButton, RoundedTextInput } from '@/components/playmap-ui';
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
import { addChildProfile, loadChildProfile, saveChildProfile } from '@/features/children/child-profile-service';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { ToyButton } from '@/components/toy-ui';

/**
 * Adds or edits one child profile.
 *
 * Collects a nickname and presentation preferences only. Pip never asks for a
 * birthday, legal name, school, or anything diagnostic.
 */
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

  if (loading) return <PageShell scroll={false}><LoadingState label="Loading profile…" /></PageShell>;

  return (
    <PageShell>
      <ParentModeHeader
        backTo={parentBackTargets.editChild}
        subtitle="A nickname and a look. Nothing about birthdays, schools, or diagnoses."
        title={childId === null ? 'Add a child' : 'Edit profile'}
      />

      {error ? <NoticeBanner message={error} tone="error" /> : null}

      <FormCard>
        <View style={styles.preview}>
          <ProfileAvatar accentColorId={accentColorId} avatarId={avatarId} name={name || 'This profile'} size={72} />
        </View>
        <RoundedTextInput
          accessibilityLabel="Child nickname"
          label="Nickname"
          onChangeText={setName}
          placeholder="For example, Sam"
          value={name}
        />
        <AvatarPicker accentColorId={accentColorId} onChange={setAvatarId} value={avatarId} />
        <AccentColorPicker onChange={setAccentColorId} value={accentColorId} />
      </FormCard>

      <FormCard tone="sage">
        <Text style={styles.label}>How many choices at a time?</Text>
        <View style={styles.row}>
          {CHOICE_COUNTS.map((count) => (
            <ToyButton
              key={count}
              label={`${count} toy${count === 1 ? '' : 's'}`}
              onPress={() => setChoiceLimit(count)}
              selected={choiceLimit === count}
            />
          ))}
        </View>

        <Text style={styles.label}>Words and pictures</Text>
        <View style={styles.row}>
          {READING_SUPPORTS.map((support) => (
            <ToyButton
              key={support}
              label={READING_SUPPORT_LABELS[support]}
              onPress={() => setReadingSupport(support)}
              selected={readingSupport === support}
            />
          ))}
        </View>

        <Text style={styles.label}>Rough age range (optional)</Text>
        <View style={styles.row}>
          {AGE_RANGES.map((range) => (
            <ToyButton
              key={range}
              label={range}
              onPress={() => setAgeRange((current) => (current === range ? null : range))}
              selected={ageRange === range}
            />
          ))}
        </View>
        <Text style={styles.hint}>Used only to pitch wording. Pip never stores a birthday.</Text>
      </FormCard>

      <PrimaryButton
        disabled={saving || name.trim().length < 2}
        label={saving ? 'Saving…' : 'Save profile'}
        onPress={() => {
          void save();
        }}
      />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hint: { color: theme.colors.mutedText, ...theme.typography.supporting },
  label: { color: theme.colors.primaryText, ...theme.typography.label },
  preview: { alignItems: 'center', paddingVertical: theme.spacing[8] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
});
