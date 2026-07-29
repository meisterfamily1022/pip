import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { ChildButton, ChildPage, LocationPanel, ToyImage } from '@/components/child-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession, type ActivePlaySession } from '@/repositories/play-sessions-repository';

export default function CurrentToyRoute() {
  const [session, setSession] = useState<ActivePlaySession | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { initializeDatabase().then(getActivePlaySession).then(setSession).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load the current toy.')).finally(() => setLoading(false)); }, []);
  if (loading) return <ChildPage centered><ActivityIndicator color={theme.colors.sageAction} /><Text>Loading current toy…</Text></ChildPage>;
  if (error) return <ChildPage centered><Text style={styles.error}>{error}</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></ChildPage>;
  if (!session) return <ChildPage centered><Text style={styles.message}>No toy is active right now.</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></ChildPage>;
  if (!session.toy) return <ChildPage centered><Text style={styles.message}>This toy is no longer in your toy library.</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></ChildPage>;
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.eyebrow}>CURRENT TOY</Text><ToyImage uri={session.toy.imageUri} /><Text style={styles.message}>You’re playing with this now.</Text><Text accessibilityRole="header" style={styles.title}>{session.toy.name}</Text><LocationPanel room={session.toy.roomName} spot={session.toy.storageSpotName} /><ChildButton label="I’m Done Playing" onPress={() => router.push('/child/cleanup')} /></ScrollView>;
}
const styles = StyleSheet.create({ container: { alignItems: 'stretch', backgroundColor: theme.colors.childBackground, flexGrow: 1, gap: 16, padding: 20, paddingBottom: 48, paddingTop: 28 }, eyebrow: { color: theme.colors.coralDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 36, fontWeight: '700', lineHeight: 44 }, message: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 25, lineHeight: 32 }, error: { color: theme.colors.error, fontSize: 17, textAlign: 'center' } });
