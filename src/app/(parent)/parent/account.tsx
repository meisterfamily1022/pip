import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';

import { NoticeBanner } from '@/components/auth-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import {
  ConfirmationDialog,
  DestructiveButton,
  FormCard,
  PageShell,
  PinInput,
  PrimaryButton,
  SecondaryButton,
  SkeletonRows,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import {
  ACCOUNT_CAPABILITY_NOTE,
  loadAccountStatus,
  signOutConsequence,
  switchAccountConsequence,
  type AccountStatus,
} from '@/features/account/account-status';
import {
  DELETION_CONSEQUENCES,
  DELETION_UNAVAILABLE_NOTE,
  deleteAccountWithPin,
  supabaseAccountDeletionGateway,
} from '@/features/account/account-deletion';
import { buildHouseholdExport, exportFileName, serialiseExport } from '@/features/account/export-service';
import { signOut } from '@/features/auth/auth-client';
import { getSessionSnapshot, subscribeSession } from '@/features/auth/session-state';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Account & data.
 *
 * Parent-only by construction: the whole `(parent)` group redirects to the PIN
 * return screen while Child Mode is locked, so nothing here needs its own gate.
 *
 * The screen states only what an account currently does. Pip authenticates but
 * does not yet back anything up, and every line here is written to survive that
 * being true — a parent should never sign out expecting a copy to exist
 * somewhere. Sign-out and switch consequences are derived from whether this
 * particular library is linked to the account, because "your library stays on
 * this device" is true either way but seriously incomplete when it is linked.
 */
type Pending = 'signOut' | 'switch' | 'delete' | null;

export default function NativeAccountRoute() {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // The guard has to be synchronous. `busy` is state, so two taps dispatched in
  // one batch both read it as false and both get through — which signed the
  // parent out twice, and would do the same to any other action guarded this
  // way. The ref flips before the first await.
  const inFlight = useRef(false);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Reloaded on focus as well as on session change: returning from sign-in
  // should never leave a stale "Not signed in" behind.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const database = await initializeDatabase();
        const next = await loadAccountStatus(database, getSessionSnapshot());
        if (!cancelled) setStatus(next);
      })();
      return () => {
        cancelled = true;
      };
    }, [session.status, session.account?.accountId]),
  );

  const exportData = async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      setBusy(false);
    }
  };

  /**
   * Signing out returns the parent to Parent Home, not to the sign-in screen.
   * Sending them to sign-in implied an account was required to carry on, which
   * is the opposite of how Pip works — and left the only way back out of the
   * flow being to complete it.
   */
  const endSession = async (then: 'stay' | 'signIn'): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await signOut();
      setConfirming(null);
      if (then === 'signIn') {
        router.replace('/sign-in');
        return;
      }
      setNotice('Signed out. Your library is still on this device.');
    } catch (caught: unknown) {
      // The dialog stays open so the parent can retry without finding it again.
      setError(caught instanceof Error ? caught.message : 'Pip could not sign you out. Check your connection and try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const removeAccount = async (): Promise<void> => {
    const accountId = session.account?.accountId;
    if (inFlight.current || !accountId) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      await deleteAccountWithPin(database, accountId, pin, supabaseAccountDeletionGateway, signOut);
      setConfirming(null);
      setPin('');
      setNotice('Your account was deleted. Your library is still on this device.');
    } catch (caught: unknown) {
      setPin('');
      setError(caught instanceof Error ? caught.message : 'Pip could not delete your account.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const signedIn = status?.signedIn ?? false;
  const deletionAvailable = supabaseAccountDeletionGateway.availability === 'available';

  return (
    <PageShell>
      <ParentModeHeader
        backTo={parentBackTargets.account}
        subtitle="Who is signed in on this iPhone, and what leaves it."
        title="Account & data"
      />
      {error ? <NoticeBanner message={error} tone="error" /> : null}
      {notice ? <NoticeBanner message={notice} tone="success" /> : null}

      <FormCard>
        <Text style={styles.title}>Account</Text>
        {status === null ? (
          <SkeletonRows label="Checking your account…" rows={2} />
        ) : (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>{signedIn ? 'Signed in as' : 'Not signed in'}</Text>
              {signedIn && status.email ? <Text style={styles.statusValue}>{status.email}</Text> : null}
            </View>
            <Text style={styles.body}>{ACCOUNT_CAPABILITY_NOTE}</Text>
            {signedIn ? (
              <>
                <SecondaryButton
                  disabled={busy}
                  label="Switch account"
                  onPress={() => {
                    setNotice(null);
                    setError(null);
                    setConfirming('switch');
                  }}
                />
                <SecondaryButton
                  disabled={busy}
                  label="Sign out"
                  onPress={() => {
                    setNotice(null);
                    setError(null);
                    setConfirming('signOut');
                  }}
                />
              </>
            ) : (
              <>
                <PrimaryButton disabled={busy} label="Sign in" onPress={() => router.push('/sign-in')} />
                <SecondaryButton disabled={busy} label="Create an account" onPress={() => router.push('/sign-up')} />
                <Text style={styles.body}>
                  You do not need an account. Pip works on this device without one.
                </Text>
              </>
            )}
          </>
        )}
      </FormCard>

      {signedIn ? (
        <FormCard tone="alert">
          <Text style={styles.title}>Delete your account</Text>
          {deletionAvailable ? (
            <>
              {DELETION_CONSEQUENCES.map((line) => (
                <Text key={line} style={styles.body}>{line}</Text>
              ))}
              <DestructiveButton
                disabled={busy}
                label="Delete my account"
                onPress={() => {
                  setNotice(null);
                  setError(null);
                  setPin('');
                  setConfirming('delete');
                }}
              />
            </>
          ) : (
            // No button. A Delete control that cannot delete is worse than none:
            // it tells a parent their account is gone when it is not.
            <Text style={styles.body}>{DELETION_UNAVAILABLE_NOTE}</Text>
          )}
        </FormCard>
      ) : null}

      <FormCard>
        <Text style={styles.title}>Export your data</Text>
        <Text style={styles.body}>
          A readable file listing your rooms, storage spots, toys, child profiles, and play history. Photos are
          referenced by their location on this device rather than copied into the file.
        </Text>
        <PrimaryButton disabled={busy} label={busy ? 'Working…' : 'Export data'} onPress={() => void exportData()} />
      </FormCard>

      <FormCard>
        <Text style={styles.title}>Manage local data</Text>
        <Text style={styles.body}>
          To remove one child but keep your toys, use Children. To clear this device, use Reset Pip in Settings.
        </Text>
        <SecondaryButton label="Manage children" onPress={() => router.push('/parent/children')} />
        <SecondaryButton label="Open settings" onPress={() => router.push('/parent/settings')} />
      </FormCard>

      <ConfirmationDialog
        busy={busy && confirming === 'signOut'}
        cancelLabel="Stay signed in"
        confirmLabel={busy && confirming === 'signOut' ? 'Signing out…' : 'Sign out'}
        message={status ? signOutConsequence(status) : ''}
        onCancel={() => {
          if (inFlight.current) return;
          setConfirming(null);
        }}
        onConfirm={() => void endSession('stay')}
        title="Sign out of Pip?"
        visible={confirming === 'signOut'}
      />

      <ConfirmationDialog
        busy={busy && confirming === 'switch'}
        cancelLabel="Cancel"
        confirmLabel={busy && confirming === 'switch' ? 'Signing out…' : 'Continue'}
        message={status ? switchAccountConsequence(status) : ''}
        onCancel={() => {
          if (inFlight.current) return;
          setConfirming(null);
        }}
        onConfirm={() => void endSession('signIn')}
        title="Switch to a different account?"
        visible={confirming === 'switch'}
      />

      <ConfirmationDialog
        busy={busy && confirming === 'delete'}
        cancelLabel="Keep my account"
        confirmLabel={busy && confirming === 'delete' ? 'Deleting…' : 'Delete my account'}
        destructive
        message={DELETION_CONSEQUENCES.join(' ')}
        onCancel={() => {
          if (inFlight.current) return;
          setConfirming(null);
          setPin('');
        }}
        onConfirm={() => void removeAccount()}
        title="Delete your Pip account?"
        visible={confirming === 'delete'}
      >
        <PinInput label="Enter your parent PIN to confirm" onChangeText={setPin} value={pin} />
      </ConfirmationDialog>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  body: { color: theme.colors.secondaryText, ...theme.typography.supporting },
  statusLabel: { color: theme.colors.secondaryText, ...theme.typography.meta },
  statusRow: { gap: 2 },
  statusValue: { color: theme.colors.primaryText, ...theme.typography.label },
  title: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
});
