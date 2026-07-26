import { useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { BackButton, Field } from '@/components/onboarding-controls';
import { ChildButton } from '@/components/child-ui';
import { pinStorage } from '@/services/pin-storage';
import { verifyParentPin } from '@/features/child/parent-access';

export default function ParentReturnRoute() {
  const [pin, setPin] = useState(''); const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  const submit = async (): Promise<void> => { if (submitting) return; setSubmitting(true); setError(null); try { if (!await verifyParentPin(pinStorage, pin)) { setError('That PIN is not correct.'); setSubmitting(false); return; } router.replace('/parent/home'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not verify the PIN.'); setSubmitting(false); } };
  return <SafeAreaView style={styles.container}><BackButton onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>Parent Mode</Text><Text>Enter the parent PIN to return.</Text><Field label="Parent PIN" value={pin} onChangeText={(value) => { setPin(value.replace(/\D/g, '')); setError(null); }} keyboardType="number-pad" secureTextEntry maxLength={4} error={error} /><ChildButton label={submitting ? 'Checking…' : 'Return to Parent Mode'} disabled={submitting} onPress={() => void submit()} /><ChildButton label="Cancel" secondary onPress={() => router.back()} /></SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, gap: 18, padding: 24, paddingTop: 52 }, title: { fontSize: 32, fontWeight: '700' } });
