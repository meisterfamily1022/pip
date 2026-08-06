import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ParentModeHeader } from '@/components/parent-ui';
import { ErrorStateCard, LoadingState, PageShell, PastelNavigationCard } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { listChildProfiles } from '@/repositories/child-profiles-repository';
import { clearActiveChild, setActiveChild } from '@/repositories/settings-repository';
import { ProfileAvatar } from '@/components/profile-ui';
import { enterChildMode } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function SelectChildRoute() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { initializeDatabase().then(listChildProfiles).then(setChildren).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load child profiles.')).finally(() => setLoading(false)); }, []);
  const choose = async (childId: number): Promise<void> => {
    setError(null);
    try { const database = await initializeDatabase(); await setActiveChild(database, childId); router.replace('/child/home'); await enterChildMode(); }
    catch (caught: unknown) { router.replace('/parent/select-child'); setError(caught instanceof Error ? caught.message : 'Could not open Child Mode.'); }
  };

  /**
   * Guest play. Clearing the active child means no profile is recorded, so a
   * visiting friend leaves no permanent child data behind, and only toys shared
   * with everyone are offered.
   */
  const playAsGuest = async (): Promise<void> => {
    setError(null);
    try { const database = await initializeDatabase(); await clearActiveChild(database); router.replace('/child/home'); await enterChildMode(); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not open Child Mode.'); }
  };
  if (loading) return <PageShell scroll={false}><LoadingState label="Loading child profiles…" /></PageShell>;
  return <PageShell><ParentModeHeader backTo="/parent/home" title="Who is playing?" subtitle="Choose a child. Each profile keeps its own current toy and cleanup progress." />{error && <ErrorStateCard message={error} />}<View style={styles.list}>{children.map((child) => <View key={child.id} style={styles.cardRow}><ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} name={child.name} size={56} /><View style={styles.cardBody}><PastelNavigationCard title={child.name} description={`${child.choiceLimit} choice${child.choiceLimit === 1 ? '' : 's'} at a time`} tint={theme.colors.brandPrimarySoft} onPress={() => { void choose(child.id); }} /></View></View>)}<PastelNavigationCard title="Guest" description="Play without a profile. Nothing is saved." tint={theme.colors.surfaceYellow} onPress={() => { void playAsGuest(); }} /></View><Text style={styles.help}>{children.length === 0 ? 'No profiles yet. Guest works right away, and you can add profiles in Settings.' : 'You can add or edit profiles in Settings.'}</Text></PageShell>;
}
const styles = StyleSheet.create({ list: { gap: 10 }, cardRow: { alignItems: 'center', flexDirection: 'row', gap: 12 }, cardBody: { flex: 1 }, help: { color: theme.colors.secondaryText, fontSize: 15, lineHeight: 22 } });
