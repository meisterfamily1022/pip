import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { ChildButton, ToyImage } from '@/components/child-ui';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession, type ActivePlaySession } from '@/repositories/play-sessions-repository';

export default function CurrentToyRoute() {
  const [session, setSession] = useState<ActivePlaySession | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { initializeDatabase().then(getActivePlaySession).then(setSession).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load the current toy.')).finally(() => setLoading(false)); }, []);
  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /><Text>Loading current toy…</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></SafeAreaView>;
  if (!session) return <SafeAreaView style={styles.center}><Text>No toy is active right now.</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></SafeAreaView>;
  if (!session.toy) return <SafeAreaView style={styles.center}><Text>This toy is no longer in your toy library.</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></SafeAreaView>;
  return <ScrollView contentContainerStyle={styles.container}><ToyImage uri={session.toy.imageUri} /><Text accessibilityRole="header" style={styles.title}>{session.toy.name}</Text><Text style={styles.message}>You’re playing with this now.</Text><Text style={styles.location}>{session.toy.roomName} → {session.toy.storageSpotName}</Text><ChildButton label="I’m Done Playing" onPress={() => router.push('/child/cleanup')} /></ScrollView>;
}
const styles = StyleSheet.create({ container: { gap: 18, padding: 24, paddingTop: 52 }, center: { flex: 1, alignItems: 'center', gap: 16, justifyContent: 'center', padding: 24 }, title: { fontSize: 34, fontWeight: '700' }, message: { fontSize: 22 }, location: { fontSize: 22, fontWeight: '600' }, error: { color: '#A52222', fontSize: 17, textAlign: 'center' } });
