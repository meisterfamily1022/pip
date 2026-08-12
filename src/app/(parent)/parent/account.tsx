import { useState } from 'react';
import { Share, StyleSheet, Text } from 'react-native';

import { NoticeBanner } from '@/components/auth-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import { FormCard, PageShell, PrimaryButton, SecondaryButton } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { buildHouseholdExport, exportFileName, serialiseExport } from '@/features/account/export-service';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { router } from 'expo-router';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { signOut } from '@/features/auth/auth-client';

/** Native data controls stay entirely on-device; no undeployed web API is required. */
export default function NativeAccountRoute() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const exportData = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      const data = await buildHouseholdExport(database);
      await Share.share({ message: serialiseExport(data), title: exportFileName(data) });
      setNotice(`Exported ${data.toys.length} toys and ${data.children.length} profiles.`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not export your data.');
    } finally {
      setBusy(false);
    }
  };

  const endSession = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signOut();
      router.replace('/sign-in');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not sign you out.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <ParentModeHeader
        backTo={parentBackTargets.account}
        subtitle="Your library stays on this device unless you export it."
        title="Data & export"
      />
      {error ? <NoticeBanner message={error} tone="error" /> : null}
      {notice ? <NoticeBanner message={notice} tone="success" /> : null}
      <FormCard>
        <Text style={styles.title}>Export your data</Text>
        <Text style={styles.body}>
          A readable file listing your rooms, storage spots, toys, child profiles, and play history. Photos are
          referenced by their location on this device rather than copied into the file.
        </Text>
        <PrimaryButton disabled={busy} label={busy ? 'Exporting…' : 'Export data'} onPress={() => void exportData()} />
      </FormCard>
      <FormCard>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.body}>Sign out of Pip on this iPhone. Your local library remains on this device.</Text>
        <SecondaryButton disabled={busy} label="Sign out" onPress={() => void endSession()} />
      </FormCard>
      <FormCard>
        <Text style={styles.title}>Manage local data</Text>
        <Text style={styles.body}>
          To remove one child but keep your toys, use Children. To clear this device, use Reset Pip in Settings.
        </Text>
        <SecondaryButton label="Manage children" onPress={() => router.push('/parent/children')} />
        <SecondaryButton label="Open settings" onPress={() => router.push('/parent/settings')} />
      </FormCard>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  body: { color: theme.colors.secondaryText, ...theme.typography.supporting },
  title: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
});
