import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ParentScreen } from '@/components/parent-ui';
import { Banner, ConfirmationDialog, DestructiveButton, ToggleRow } from '@/components/playmap-ui';
import { analyticsPreferences } from '@/features/analytics/analytics-service';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function AnalyticsPrivacyRoute() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { void analyticsPreferences.get().then((value) => setEnabled(value.granted)).finally(() => setBusy(false)); }, []);
  const change = async (value: boolean) => {
    setBusy(true); setNotice(null);
    try { await analyticsPreferences.set(value); setEnabled(value); setNotice(value ? 'Optional analytics is on.' : 'Optional analytics is off. No new events will be sent.'); }
    catch { setNotice('That choice could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await analyticsPreferences.delete(); setEnabled(false); setNotice('Analytics data was deleted. Your account and on-device Pip data were not changed.'); }
    catch { setNotice('Analytics data could not be deleted. Nothing else was changed.'); }
    finally { setBusy(false); setConfirming(false); }
  };

  return <ParentScreen tab="settings">
    <Text accessibilityRole="header" style={styles.title}>Optional analytics</Text>
    {notice ? <Banner message={notice} tone={notice.includes('could not') ? 'alert' : 'info'} /> : null}
    <Text style={styles.body}>Help improve Pip by sharing limited adult household-level usage. This is off by default. Pip never sends toy or child names, photos, searches, free text, precise location, diagnoses, schools, or therapy information.</Text>
    <ToggleRow disabled={busy} description="Sends allowlisted product events only for this signed-in household." label="Share optional analytics" onValueChange={(value) => { void change(value); }} value={enabled} />
    <View style={styles.card}>
      <Text style={styles.heading}>What may be collected</Text>
      <Text style={styles.body}>App version and platform; coarse country and state/province you optionally choose; broad household-size and age bands you optionally provide; feature counts in bands; session, cleanup, onboarding, and categorized reliability events.</Text>
      <Text style={styles.body}>Pip uses this only to understand reliability and improve the product. Pip does not sell data, advertise, or create analytics identities for children. Raw events are kept for up to 13 months.</Text>
    </View>
    <DestructiveButton disabled={busy} label="Delete analytics data" onPress={() => setConfirming(true)} />
    <ConfirmationDialog busy={busy} cancelLabel="Keep analytics data" confirmLabel="Delete analytics data" destructive message="This removes telemetry and reporting-only profile data for this household. It does not delete your account, toys, photos, rooms, children, or play history on this device." onCancel={() => setConfirming(false)} onConfirm={() => { void remove(); }} title="Delete analytics data?" visible={confirming} />
  </ParentScreen>;
}

const styles = StyleSheet.create({ title: { color: theme.colors.primaryText, ...theme.typography.pageTitle }, heading: { color: theme.colors.primaryText, ...theme.typography.sectionTitle }, body: { color: theme.colors.secondaryText, ...theme.typography.body }, card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, gap: theme.spacing[8], padding: theme.spacing[16] } });

