import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { BackButton, Field } from '@/components/onboarding-controls';
import { ChildButton, ChildPage } from '@/components/child-ui';
import { pinStorage } from '@/services/pin-storage';
import { verifyParentPin } from '@/features/child/parent-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function ParentReturnRoute() {
  const [pin, setPin] = useState(''); const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  const submit = async (): Promise<void> => { if (submitting) return; setSubmitting(true); setError(null); try { if (!await verifyParentPin(pinStorage, pin)) { setError('That PIN is not correct.'); setSubmitting(false); return; } router.replace('/parent/home'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not verify the PIN.'); setSubmitting(false); } };
  return <ChildPage><BackButton onPress={() => router.back()} /><Text style={styles.eyebrow}>GROWN-UP AREA</Text><Text accessibilityRole="header" style={styles.title}>Parent Mode</Text><Text style={styles.helper}>Enter the four-digit PIN to return.</Text><Field label="Parent PIN" value={pin} onChangeText={(value) => { setPin(value.replace(/\D/g, '')); setError(null); }} keyboardType="number-pad" secureTextEntry maxLength={4} error={error} /><ChildButton label={submitting ? 'Checking…' : 'Return to Parent Mode'} disabled={submitting} onPress={() => void submit()} /><ChildButton label="Cancel" secondary onPress={() => router.back()} /></ChildPage>;
}
const styles = StyleSheet.create({ eyebrow: { color: theme.colors.coralDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 36, fontWeight: '700', lineHeight: 44 }, helper: { color: theme.colors.secondaryText, fontSize: 17, lineHeight: 25 } });
