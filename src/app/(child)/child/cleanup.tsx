import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field } from '@/components/onboarding-controls';
import { ChildButton, ToyImage } from '@/components/child-ui';
import { initializeDatabase } from '@/database/client';
import { verifyParentPin } from '@/features/child/parent-access';
import { beginCleanup, completeCleanup, completeCleanupWithParentOverride, loadCleanupState, requestCleanupHelp } from '@/features/child/cleanup-service';
import { pinStorage } from '@/services/pin-storage';
import type { ActivePlaySession } from '@/repositories/play-sessions-repository';

type HelpMode = 'child' | 'pin' | 'parent';

export default function CleanupRoute() {
  const [session, setSession] = useState<ActivePlaySession | null>(null);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [step, setStep] = useState(1);
  const [helpMode, setHelpMode] = useState<HelpMode>('child');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    initializeDatabase().then(async (database) => {
      const state = await loadCleanupState(database);
      if (!state.activeSession) return state;
      const active = state.cleanupRequired ? await beginCleanup(database) : state.activeSession;
      return { ...state, activeSession: active };
    }).then((state) => {
      if (!mounted) return;
      setSession(state.activeSession); setCleanupRequired(state.cleanupRequired);
      if (state.activeSession?.helpRequested) setHelpMode('child');
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load cleanup.')).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const finish = async (parentOverride = false): Promise<void> => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const database = await initializeDatabase();
      if (parentOverride) await completeCleanupWithParentOverride(database);
      else await completeCleanup(database);
      router.replace('/child/home');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not finish cleanup.');
      setSaving(false);
    }
  };

  const needHelp = async (): Promise<void> => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const database = await initializeDatabase();
      setSession(await requestCleanupHelp(database));
      setHelpMode('child');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not request help.');
    } finally {
      setSaving(false);
    }
  };

  const verifyPin = async (): Promise<void> => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      if (!await verifyParentPin(pinStorage, pin)) {
        setError('That PIN is not correct.');
        return;
      }
      setHelpMode('parent');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not verify the PIN.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /><Text>Loading cleanup…</Text></SafeAreaView>;
  if (error && !session) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></SafeAreaView>;
  if (!session) return <SafeAreaView style={styles.center}><Text>There is no active toy to clean up.</Text><ChildButton label="Return Home" onPress={() => router.replace('/child/home')} /></SafeAreaView>;
  if (!session.toy) return <SafeAreaView style={styles.center}><Text>This toy is missing from the toy library.</Text><ChildButton label="Mark It Put Away" onPress={() => { void finish(true); }} /><ChildButton label="Return Home" secondary onPress={() => router.replace('/child/home')} /></SafeAreaView>;

  if (!cleanupRequired) {
    return <SafeAreaView style={styles.center}><ToyImage uri={session.toy.imageUri} /><Text accessibilityRole="header" style={styles.title}>All done with {session.toy.name}?</Text>{error && <Text style={styles.error}>{error}</Text>}<ChildButton label={saving ? 'Finishing…' : 'Yes, All Done'} disabled={saving} onPress={() => { void finish(false); }} /><ChildButton label="I’m Still Playing" secondary onPress={() => router.replace('/child/current-toy')} /></SafeAreaView>;
  }

  if (session.helpRequested && helpMode === 'child') {
    return <SafeAreaView style={styles.center}><Text accessibilityRole="header" style={styles.title}>Ask a grown-up for help.</Text>{error && <Text style={styles.error}>{error}</Text>}<ChildButton label="I’m Still Playing" onPress={() => router.replace('/child/current-toy')} /><ChildButton label="Grown-Up Help" secondary onPress={() => setHelpMode('pin')} /></SafeAreaView>;
  }

  if (helpMode === 'pin') {
    return <SafeAreaView style={styles.container}><Text accessibilityRole="header" style={styles.title}>Grown-Up Help</Text><Text>Enter the parent PIN.</Text><Field label="Parent PIN" value={pin} onChangeText={(value) => { setPin(value.replace(/\D/g, '')); setError(null); }} keyboardType="number-pad" secureTextEntry maxLength={4} error={error} /><ChildButton label={saving ? 'Checking…' : 'Continue'} disabled={saving} onPress={() => { void verifyPin(); }} /><ChildButton label="Return to Cleanup" secondary onPress={() => setHelpMode('child')} /></SafeAreaView>;
  }

  if (helpMode === 'parent') {
    return <SafeAreaView style={styles.center}><Text accessibilityRole="header" style={styles.title}>Grown-Up Help</Text>{error && <Text style={styles.error}>{error}</Text>}<ChildButton label={saving ? 'Finishing…' : 'Mark It Put Away'} disabled={saving} onPress={() => { void finish(true); }} /><ChildButton label="Return to Cleanup" secondary onPress={() => setHelpMode('child')} /><ChildButton label="Keep Playing" secondary onPress={() => router.replace('/child/current-toy')} /></SafeAreaView>;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ToyImage uri={session.toy.imageUri} />
      <Text accessibilityRole="header" style={styles.title}>{session.toy.name}</Text>
      <View style={styles.stepBox}>
        {step === 1 && <Text style={styles.stepText}>First, put all the pieces back.</Text>}
        {step === 2 && <><Text style={styles.stepText}>Next, put it back where it belongs.</Text><Text style={styles.location}>{session.toy.roomName} → {session.toy.storageSpotName}</Text></>}
        {step === 3 && <><Text style={styles.stepText}>Is everything back where it belongs?</Text><Text style={styles.location}>{session.toy.roomName} → {session.toy.storageSpotName}</Text></>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {step < 3 ? <ChildButton label="Next" onPress={() => setStep((current) => current + 1)} /> : <ChildButton label={saving ? 'Finishing…' : 'Yes, All Done'} disabled={saving} onPress={() => { void finish(false); }} />}
      <ChildButton label="I Need Help" secondary onPress={() => { void needHelp(); }} />
      <ChildButton label="I’m Still Playing" secondary onPress={() => router.replace('/child/current-toy')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', gap: 16, justifyContent: 'center', padding: 24 },
  container: { flex: 1, gap: 18, padding: 24, paddingTop: 52 },
  content: { gap: 18, padding: 24, paddingTop: 52 },
  error: { color: '#A52222', fontSize: 17, textAlign: 'center' },
  location: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  stepBox: { backgroundColor: '#F6F7FA', borderRadius: 8, gap: 12, padding: 18 },
  stepText: { fontSize: 24, fontWeight: '700', lineHeight: 32, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
});
