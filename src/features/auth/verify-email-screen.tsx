import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorSummary, NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { AuthRequestError, resendVerification, verifyEmail } from './auth-client';
import { pendingVerification } from './sign-up-form';

export function VerifyEmailScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const submittingRef = useRef(false);
  const resendingRef = useRef(false);
  useEffect(() => { void pendingVerification.get().then(setEmail); }, []);
  const submit = useCallback(async (): Promise<void> => {
    if (!email || code.trim().length !== 6 || submittingRef.current || resendingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try { await verifyEmail(email, code.trim()); await pendingVerification.clear(); router.replace('/onboarding'); }
    catch (caught: unknown) { setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }, [code, email]);
  const resend = useCallback(async (): Promise<void> => {
    if (!email || submittingRef.current || resendingRef.current) return;
    resendingRef.current = true;
    setResending(true); setError(null); setNotice(null); setCode('');
    try { await resendVerification(email); setNotice('A new code is on its way. Use the newest code in your email.'); }
    catch (caught: unknown) { setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.'); }
    finally { resendingRef.current = false; setResending(false); }
  }, [email]);
  return (
    <OnboardingScreen description={email ? `Enter the six-digit code we sent to ${email}.` : 'Enter the six-digit code from your email.'} footer={<PrimaryButton disabled={submitting || resending || code.trim().length !== 6} label={submitting ? 'Confirming…' : 'Confirm email'} onPress={() => void submit()} />} title="Confirm your email">
      <ErrorSummary errors={error ? [error] : []} />
      {notice ? <NoticeBanner message={notice} tone="info" /> : null}
      <RoundedTextInput autoComplete="one-time-code" editable={!submitting && !resending} inputMode="numeric" keyboardType="number-pad" label="Six-digit code" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/g, ''))} testID="verification-code" textContentType="oneTimeCode" value={code} />
      <View style={styles.actions}><QuietButton disabled={submitting || resending} label={resending ? 'Sending another code…' : 'Send another code'} onPress={() => void resend()} /><QuietButton disabled={submitting || resending} label="Use a different email" onPress={() => { void pendingVerification.clear().then(() => router.replace('/sign-up')); }} /></View>
      <Text style={styles.note}>Use the newest code in your email. You can ask for a new one at any time.</Text>
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({ actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] }, note: { color: theme.colors.mutedText, ...theme.typography.supporting } });
