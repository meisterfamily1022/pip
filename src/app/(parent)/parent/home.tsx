import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ParentModeHeader } from '@/components/parent-ui';
import { Card, ConfirmationDialog, PageShell, PastelNavigationCard, PrimaryButton, SectionHeading } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { listChildProfiles } from '@/repositories/child-profiles-repository';
import { completePlaySession, listActivePlaySessions, type ActivePlaySession } from '@/repositories/play-sessions-repository';
import { setActiveChild } from '@/repositories/settings-repository';
import { enterChildMode } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

const destinations = [
  { href: '/parent/toy-library' as const, title: 'Toy library', description: 'Add, find, and manage toys', tint: theme.colors.surface },
  { href: '/parent/locations' as const, title: 'Rooms & storage', description: 'Keep every toy easy to find', tint: theme.colors.surface },
  { href: '/parent/select-child' as const, title: 'Child mode', description: 'Choose who is playing', tint: theme.colors.brandPrimarySoft, locks: true },
  { href: '/parent/settings' as const, title: 'Settings', description: 'Children, choices, cleanup, and access', tint: theme.colors.surface },
] as const;

export default function ParentHomeRoute() {
  const [accessError, setAccessError] = useState<string | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [sessions, setSessions] = useState<ActivePlaySession[]>([]);
  const [resolving, setResolving] = useState<ActivePlaySession | null>(null);
  const loadOverview = useCallback(async () => { try { const database = await initializeDatabase(); const [profiles, active] = await Promise.all([listChildProfiles(database), listActivePlaySessions(database)]); setChildren(profiles); setSessions(active); } catch (caught: unknown) { setAccessError(caught instanceof Error ? caught.message : 'Could not load the family overview.'); } }, []);
  useFocusEffect(useCallback(() => { void loadOverview(); }, [loadOverview]));
  const openDestination = async (item: typeof destinations[number]): Promise<void> => {
    setAccessError(null);
    try {
      if ('locks' in item && children.length === 1) { const database = await initializeDatabase(); await setActiveChild(database, children[0].id); router.replace('/child/home'); await enterChildMode(); return; }
      router.replace(item.href as never);
    } catch (caught: unknown) { setAccessError(caught instanceof Error ? caught.message : 'Could not open Child Mode.'); }
  };
  const finishSession = async (): Promise<void> => { if (!resolving) return; try { const database = await initializeDatabase(); await completePlaySession(database, resolving.id, resolving.childId); setResolving(null); await loadOverview(); } catch (caught: unknown) { setAccessError(caught instanceof Error ? caught.message : 'Could not finish this checkout.'); setResolving(null); } };
  return <PageShell><ParentModeHeader title="A calmer way to keep play organized." subtitle="Start with the library, then let Child Mode do the simple part." />{accessError && <Text accessibilityLiveRegion="polite" style={styles.error}>{accessError}</Text>}<Card tone="peach" style={styles.intro}><View style={styles.illustration}><View style={styles.arc} /><View style={styles.block} /><View style={styles.dot} /></View><View style={styles.introCopy}><Text style={styles.introTitle}>Everything has a home.</Text><Text style={styles.introText}>A small toy library makes choosing, finding, and putting things away feel lighter.</Text></View></Card><SectionHeading title="Active checkouts" supporting={sessions.length ? 'Each child’s current toy stays separate.' : 'No toys are checked out right now.'} />{sessions.map((session) => <Card key={session.id} tone="sage"><Text style={styles.sessionChild}>{session.childName}</Text><Text style={styles.sessionToy}>{session.toy?.name ?? 'Missing toy record'}</Text><Text style={styles.introText}>{session.toy ? `${session.toy.roomName} · ${session.toy.storageSpotName}` : 'This session can still be safely resolved.'}</Text><PrimaryButton label={`Mark ${session.childName}’s toy put away`} onPress={() => setResolving(session)} /></Card>)}<SectionHeading title="Your play space" supporting="Choose where you want to go." /><View style={styles.links}>{destinations.map((item) => <PastelNavigationCard key={item.href} {...item} onPress={() => { void openDestination(item); }} />)}</View><ConfirmationDialog visible={resolving !== null} title="Finish this checkout?" message={`${resolving?.childName ?? 'This child'} will no longer have ${resolving?.toy?.name ?? 'this toy'} as their current toy. This does not delete the toy or play history.`} confirmLabel="Mark Put Away" onCancel={() => setResolving(null)} onConfirm={() => { void finishSession(); }} /></PageShell>;
}

const styles = StyleSheet.create({ error: { color: theme.colors.error }, intro: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, illustration: { backgroundColor: theme.colors.brandPrimarySoft, borderRadius: 22, height: 92, overflow: 'hidden', position: 'relative', width: 92 }, arc: { borderColor: theme.colors.brandPrimary, borderRadius: 50, borderWidth: 8, height: 66, left: 12, position: 'absolute', top: 28, width: 66 }, block: { backgroundColor: theme.colors.surfaceSage, borderRadius: 9, height: 30, left: 38, position: 'absolute', top: 26, width: 30 }, dot: { backgroundColor: theme.colors.accentYellow, borderRadius: 12, height: 24, left: 18, position: 'absolute', top: 17, width: 24 }, introCopy: { flex: 1, gap: 4, minWidth: 220 }, introTitle: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700' }, introText: { color: theme.colors.secondaryText, fontSize: 15, lineHeight: 21 }, links: { gap: 10 }, sessionChild: { color: theme.colors.brandInk, fontSize: 14, fontWeight: '800' }, sessionToy: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' } });
