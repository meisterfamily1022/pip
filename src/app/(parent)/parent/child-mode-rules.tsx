import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ParentDetailScreen } from '@/components/parent-ui';
import {
  Banner,
  PrimaryButton,
  SegmentedControl,
  SkeletonRows,
  Toast,
  ToggleRow,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChoiceLimit } from '@/domain/models';
import { loadParentSettings } from '@/features/settings/settings-service';
import { updateSettings } from '@/repositories/settings-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The household-wide Child Mode defaults.
 *
 * Individual children can differ; this is what a child without their own
 * setting gets, and what Guest play uses.
 */
export default function ChildModeRulesRoute() {
  const [choiceLimit, setChoiceLimit] = useState<ChoiceLimit>(3);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const database = await initializeDatabase();
      const settings = await loadParentSettings(database);
      setChoiceLimit(settings.choiceLimit);
      setCleanupRequired(settings.cleanupRequired);
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'These rules could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const database = await initializeDatabase();
      // Only the two fields this screen owns are written, so a nickname or an
      // active child chosen elsewhere is never clobbered by a save from here.
      await updateSettings(database, { choiceLimit, cleanupRequired });
      setSaved(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Those rules could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ParentDetailScreen
      backLabel="Settings"
      backTo="/parent/settings"
      footer={<PrimaryButton busy={saving} label="Save rules" onPress={() => { void save(); }} />}
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Child Mode rules</Text>
        <Text style={styles.subtitle}>What a child sees when they are handed the phone.</Text>
      </View>

      {error ? <Banner message={error} tone="alert" /> : null}
      {saved ? <Toast message="Rules saved." /> : null}

      {loading ? (
        <SkeletonRows label="Loading rules…" rows={2} />
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>How many choices at once?</Text>
            <SegmentedControl<ChoiceLimit>
              accessibilityLabel="How many choices at once"
              getOptionLabel={(limit) => `${limit} toy${limit === 1 ? '' : 's'}`}
              onChange={(value) => {
                setChoiceLimit(value);
                setSaved(false);
              }}
              options={[1, 3, 5]}
              value={choiceLimit}
            />
            <Text style={styles.caption}>
              {choiceLimit === 1
                ? 'One at a time is the calmest. Nothing else is shown until it is put away.'
                : `A child picks between ${choiceLimit} toys drawn from what is available to them.`}
            </Text>
          </View>

          <ToggleRow
            description="Pip walks through putting the last toy away before offering another."
            label="Tidy up before the next toy"
            onValueChange={(value) => {
              setCleanupRequired(value);
              setSaved(false);
            }}
            value={cleanupRequired}
          />

          <Text style={styles.note}>
            Nothing in Child Mode counts down, expires or auto-advances. Tidy-up steps are advanced by the child.
          </Text>
        </>
      )}
    </ParentDetailScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.meta },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  caption: { color: theme.colors.secondaryText, ...theme.typography.meta },
  note: { color: theme.colors.mutedText, ...theme.typography.meta },
});
