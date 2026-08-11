import { useState, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { NoticeBanner, PasswordField } from '@/components/auth-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import {
  ConfirmationDialog,
  DestructiveButton,
  FormCard,
  PageShell,
  PrimaryButton,
  SecondaryButton,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { buildHouseholdExport, exportFileName, serialiseExport } from '@/features/account/export-service';
import { AuthRequestError, deleteAccount, reauthenticate, signOut } from '@/features/auth/auth-client';
import { getSessionSnapshot, subscribeSession } from '@/features/auth/session-state';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Parent account settings.
 *
 * The four ways of removing something are deliberately kept apart, because
 * confusing them is how a family loses a library they meant to keep:
 *
 * 1. **Sign out** — ends the session. Nothing is deleted.
 * 2. **Delete a child profile** — lives in Children, and never touches toys.
 * 3. **Remove local data** — lives in Settings as "Reset Pip", and clears this
 *    device only.
 * 4. **Delete account** — here, and removes the server-side account only.
 *
 * Each says plainly what it does *not* do, so the wrong one cannot be picked by
 * accident.
 */
export default function AccountRoute() {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  const account = session.account;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState('');

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught: unknown) {
      setError(caught instanceof AuthRequestError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  /** Exports from the device database, which is where the library really is. */
  const exportData = (): void => {
    void run(async () => {
      const database = await initializeDatabase();
      const data = await buildHouseholdExport(database);
      const payload = serialiseExport(data);
      await Share.share({ message: payload, title: exportFileName(data) });
      setNotice(`Exported ${data.toys.length} toys and ${data.children.length} profiles.`);
    });
  };

  const confirmDeleteAccount = (): void => {
    void run(async () => {
      // A valid session is not enough for something irreversible.
      await reauthenticate(password);
      await deleteAccount();
      setConfirmingDelete(false);
      setPassword('');
      setNotice('Your account was deleted. Your toys are still on this device.');
      router.replace('/parent/home');
    });
  };

  return (
    <PageShell>
      <ParentModeHeader
        backTo={parentBackTargets.account}
        subtitle="Your account, your data, and what happens if you remove things."
        title="Account"
      />

      {error ? <NoticeBanner message={error} tone="error" /> : null}
      {notice ? <NoticeBanner message={notice} tone="success" /> : null}

      {account ? (
        <FormCard tone="surface">
          <Text style={styles.title}>Signed in</Text>
          <Text style={styles.body}>{account.email}</Text>
          {!account.emailVerified ? (
            <NoticeBanner message="Your email is not confirmed yet." tone="warning" />
          ) : null}
          <SecondaryButton
            disabled={busy}
            label="Sign out"
            onPress={() => {
              void run(async () => {
                await signOut();
                setNotice('Signed out. Everything on this device was kept.');
              });
            }}
          />
          <Text style={styles.hint}>Signing out keeps every toy, room, and photo on this device.</Text>
        </FormCard>
      ) : (
        <FormCard tone="surface">
          <Text style={styles.title}>Not signed in</Text>
          <Text style={styles.body}>
            {`${pipBrand.name} works on this device without an account. Sign in to keep a backup or use ${pipBrand.name} elsewhere.`}
          </Text>
          <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
        </FormCard>
      )}

      <FormCard>
        <Text style={styles.title}>Export your data</Text>
        <Text style={styles.body}>
          A readable file listing your rooms, storage spots, toys, child profiles, and play history. Photos are
          referenced by their location on this device rather than copied into the file.
        </Text>
        <PrimaryButton disabled={busy} label="Export data" onPress={exportData} />
      </FormCard>

      <FormCard>
        <Text style={styles.title}>Other ways to remove things</Text>
        <Text style={styles.body}>
          To remove one child but keep your toys, use Children. To clear this device but keep your account, use Reset
          Pip in Settings.
        </Text>
        <SecondaryButton label="Manage children" onPress={() => router.push({ pathname: '/parent/children' })} />
        <SecondaryButton label="Open settings" onPress={() => router.push('/parent/settings')} />
      </FormCard>

      {account ? (
        <FormCard>
          <Text style={styles.title}>Delete your account</Text>
          <Text style={styles.body}>
            This removes your Pip account and signs you out everywhere. It does not delete the toys, rooms, or photos on
            this device — to clear those, use Reset Pip in Settings.
          </Text>
          <DestructiveButton disabled={busy} label="Delete account" onPress={() => setConfirmingDelete(true)} />
        </FormCard>
      ) : null}

      <ConfirmationDialog
        confirmLabel="Delete my account"
        destructive
        message="Confirm your password to delete your account. Your toys stay on this device."
        onCancel={() => {
          setConfirmingDelete(false);
          setPassword('');
        }}
        onConfirm={confirmDeleteAccount}
        title="Delete your account?"
        visible={confirmingDelete}
      >
        <View style={styles.confirmField}>
          <PasswordField label="Your password" onChangeText={setPassword} value={password} />
        </View>
      </ConfirmationDialog>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  body: { color: theme.colors.secondaryText, ...theme.typography.supporting },
  confirmField: { marginTop: theme.spacing[12] },
  hint: { color: theme.colors.mutedText, ...theme.typography.caption },
  title: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
});
