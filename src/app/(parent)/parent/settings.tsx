import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { ParentScreen } from '@/components/parent-ui';
import {
  Banner,
  ConfirmationDialog,
  DestructiveButton,
  ListCard,
  ListRow,
  PinInput,
  SkeletonRows,
  Toast,
  ToggleRow,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { countSampleToys, removeSampleLibrary } from '@/features/samples/sample-library';
import { getResetImpact, resetPlayMapDataWithPin, type ResetImpact } from '@/features/settings/reset-playmap';
import { listChildProfiles, loadParentSettings } from '@/features/settings/settings-service';
import { parentAccessPreferences } from '@/services/parent-access-preferences';
import { resetRouteAccess } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { getSessionSnapshot } from '@/features/auth/session-state';

/**
 * Settings.
 *
 * A grouped list, reached from the tab bar and nowhere else — the floating gear
 * is gone. Everything that changes data lives one level down, so this screen is
 * safe to browse. The danger area is separated, labelled, and last.
 */
export default function ParentSettingsRoute() {
  const cloudEligible = getSessionSnapshot().status === 'signedIn';
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [choiceLimit, setChoiceLimit] = useState<1 | 3 | 5>(3);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [askEveryTime, setAskEveryTime] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetImpact, setResetImpact] = useState<ResetImpact | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const resettingRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const database = await initializeDatabase();
      const [settings, profiles, samples, ask] = await Promise.all([
        loadParentSettings(database),
        listChildProfiles(database),
        countSampleToys(database),
        parentAccessPreferences.getAskEveryTime(),
      ]);
      setChildren(profiles);
      setChoiceLimit(settings.choiceLimit);
      setCleanupRequired(settings.cleanupRequired);
      setSampleCount(samples);
      setAskEveryTime(ask);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Settings could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const changeAskEveryTime = async (value: boolean): Promise<void> => {
    setAskEveryTime(value);
    try {
      await parentAccessPreferences.setAskEveryTime(value);
      setNotice(value ? 'Pip will ask for the PIN every time.' : 'Pip will remember you for five minutes.');
    } catch (caught: unknown) {
      setAskEveryTime(!value);
      setError(caught instanceof Error ? caught.message : 'That preference could not be saved.');
    }
  };

  const clearSamples = async (): Promise<void> => {
    try {
      const database = await initializeDatabase();
      const removed = await removeSampleLibrary(database);
      setSampleCount(0);
      setNotice(`Removed ${removed} sample ${removed === 1 ? 'toy' : 'toys'}. Your own toys were not touched.`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'The sample toys could not be removed.');
    }
  };

  const resetData = async (): Promise<void> => {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      await resetPlayMapDataWithPin(database, resetPin);
      await resetRouteAccess();
      router.replace('/onboarding');
    } catch (caught: unknown) {
      setResetError(caught instanceof Error ? caught.message : 'Pip could not be reset.');
      resettingRef.current = false;
      setResetting(false);
    }
  };

  const openResetConfirmation = async (): Promise<void> => {
    setResetPin('');
    setResetError(null);
    setResetImpact(null);
    setResetConfirming(true);
    try {
      setResetImpact(await getResetImpact(await initializeDatabase()));
    } catch {
      // The reset remains safe even if counts are temporarily unavailable.
    }
  };

  if (loading) {
    return (
      <ParentScreen tab="settings">
        <SkeletonRows label="Loading settings…" rows={4} />
      </ParentScreen>
    );
  }

  const childSummary = children.length === 0
    ? 'None yet — Guest play still works'
    : children.map((child) => child.name).join(', ');

  return (
    <ParentScreen tab="settings">
      <Text accessibilityRole="header" style={styles.title}>Settings</Text>

      {error ? <Banner message={error} tone="alert" /> : null}
      {notice ? <Toast message={notice} /> : null}

      <Section label="Family">
        <ListCard>
          <ListRow detail={childSummary} onPress={() => router.push('/parent/children')} title="Children" />
          <ListRow
            detail={`${choiceLimit} ${choiceLimit === 1 ? 'choice' : 'choices'}, ${cleanupRequired ? 'tidy-up first' : 'no tidy-up rule'}`}
            onPress={() => router.push('/parent/child-mode-rules')}
            title="Child Mode rules"
          />
        </ListCard>
      </Section>

      <Section label="Parent access">
        <ListCard>
          <ListRow onPress={() => router.push('/parent/change-pin')} title="Change parent PIN" />
        </ListCard>
        <ToggleRow
          description="Otherwise Pip remembers you for five minutes."
          label="Ask for the PIN every time"
          onValueChange={(value) => {
            void changeAskEveryTime(value);
          }}
          value={askEveryTime}
        />
      </Section>

      <Section label="App">
        <ListCard>
          <ListRow onPress={() => router.push('/privacy')} title="Privacy" />
          {cloudEligible ? <ListRow onPress={() => router.push('/parent/analytics-privacy' as never)} title="Optional analytics" /> : null}
          {cloudEligible ? <ListRow onPress={() => router.push('/parent/analytics-profile' as never)} title="Optional household profile" /> : null}
          <ListRow onPress={() => router.push('/parent/account')} title="Account & your data" />
          <ListRow detail={pipBrand.primaryTagline} title={`About ${pipBrand.name} 1.0`} />
        </ListCard>
        <Text style={styles.note}>Core family data stays on this device. Optional analytics is off unless a signed-in parent chooses it.</Text>
        <Text style={styles.note}>Pip is free during launch. Optional Pip Plus features may be introduced later.</Text>
      </Section>

      {sampleCount > 0 ? (
        <Section label="Sample toys">
          <ListCard>
            <ListRow
              accessory="none"
              detail={`${sampleCount} sample ${sampleCount === 1 ? 'toy is' : 'toys are'} in your library, labelled and separate from your own.`}
              onPress={() => {
                void clearSamples();
              }}
              title="Remove the sample toys"
            />
          </ListCard>
        </Section>
      ) : null}

      <Section danger label="Danger area">
        <View style={styles.danger}>
          <Text style={styles.dangerTitle}>{`Reset ${pipBrand.name}`}</Text>
          <Text style={styles.dangerBody}>Removes every toy, photo, room, setting and the PIN from this device.</Text>
          <DestructiveButton
            disabled={resetting}
            label={resetting ? 'Resetting…' : `Reset ${pipBrand.name}`}
            onPress={() => { void openResetConfirmation(); }}
            style={styles.dangerButton}
          />
        </View>
      </Section>

      <ConfirmationDialog
        busy={resetting}
        cancelLabel="Keep everything"
        confirmLabel={`Reset ${pipBrand.name}`}
        destructive
        message={resetImpact
          ? `${resetImpact.toys} toys, ${resetImpact.photos} photos, ${resetImpact.rooms} rooms, ${resetImpact.storageSpots} storage spots, ${resetImpact.children} child profiles, ${resetImpact.playRecords} play records, all settings, and the parent PIN will be permanently removed from this device. This cannot be undone.`
          : 'Every toy, photo, room, storage spot, child profile, play record, setting, and the parent PIN will be permanently removed from this device. This cannot be undone.'}
        onCancel={() => { if (!resetting) { setResetConfirming(false); setResetPin(''); setResetError(null); } }}
        onConfirm={() => {
          void resetData();
        }}
        title={`Reset ${pipBrand.name}?`}
        visible={resetConfirming}
      >
        <PinInput
          accessibilityLabel="Parent PIN to confirm reset"
          error={resetError}
          onChangeText={(value) => { setResetPin(value); setResetError(null); }}
          value={resetPin}
        />
      </ConfirmationDialog>
    </ParentScreen>
  );
}

function Section({ label, children, danger = false }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, danger && styles.sectionLabelDanger]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  section: { gap: theme.spacing[8] },
  sectionLabel: { color: theme.colors.mutedText, ...theme.typography.eyebrow },
  sectionLabelDanger: { color: theme.colors.error },
  note: { color: theme.colors.mutedText, ...theme.typography.meta },
  danger: {
    backgroundColor: theme.colors.errorSoft,
    borderColor: theme.colors.errorBorder,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing[16],
  },
  dangerTitle: { color: theme.colors.error, ...theme.typography.rowTitle },
  dangerBody: { color: theme.colors.error, ...theme.typography.meta },
  dangerButton: { marginTop: theme.spacing[8] },
});
