import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorSummary, NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { AuthRequestError, resendVerification, verifyEmail } from './auth-client';
import { readSupportContact, resendState, sentConfirmation } from './resend-cooldown';
import { pendingVerification } from './sign-up-form';

export function VerifyEmailScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  // Re-renders the countdown once a second. Driving it from a tick rather than
  // from a stored deadline keeps the label honest if the app was backgrounded.
  const [now, setNow] = useState(() => Date.now());
  const submittingRef = useRef(false);
  const resendingRef = useRef(false);

  useEffect(() => { void pendingVerification.get().then(setEmail); }, []);

  useEffect(() => {
    if (lastSentAt === null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lastSentAt]);

  const resend = useMemo(
    () => resendState({ lastSentAt, now, attempts, sending: resending, supportContact: readSupportContact() }),
    [attempts, lastSentAt, now, resending],
  );

  const submit = useCallback(async (): Promise<void> => {
    if (!email || code.trim().length !== 6 || submittingRef.current || resendingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try { await verifyEmail(email, code.trim()); await pendingVerification.clear(); router.replace('/onboarding'); }
    catch (caught: unknown) { setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }, [code, email]);

  const requestAnotherCode = useCallback(async (): Promise<void> => {
    if (!email || submittingRef.current || resendingRef.current || !resend.canResend) return;
    resendingRef.current = true;
    setResending(true); setError(null); setNotice(null); setCode('');
    try {
      await resendVerification(email);
      const sent = attempts + 1;
      setAttempts(sent);
      // Only a send the server accepted starts the cooldown, so a failed one
      // does not lock the parent out of retrying.
      setLastSentAt(Date.now());
      setNow(Date.now());
      setNotice(sentConfirmation(email, sent));
    } catch (caught: unknown) {
      setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.');
    } finally { resendingRef.current = false; setResending(false); }
  }, [attempts, email, resend.canResend]);

  return (
    <OnboardingScreen
      description={email ? `Enter the six-digit code we sent to ${email}.` : 'Enter the six-digit code from your email.'}
      footer={<PrimaryButton disabled={submitting || resending || code.trim().length !== 6} label={submitting ? 'Confirming…' : 'Confirm email'} onPress={() => void submit()} />}
      title="Confirm your email"
    >
      <ErrorSummary errors={error ? [error] : []} />
      {notice ? <NoticeBanner message={notice} tone="info" /> : null}
      {resend.guidance ? <NoticeBanner message={resend.guidance} tone="warning" /> : null}
      <RoundedTextInput autoComplete="one-time-code" editable={!submitting && !resending} inputMode="numeric" keyboardType="number-pad" label="Six-digit code" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/g, ''))} testID="verification-code" textContentType="oneTimeCode" value={code} />
      <View style={styles.actions}>
        <QuietButton disabled={submitting || !resend.canResend} label={resend.label} onPress={() => void requestAnotherCode()} testID="resend-code" />
        <QuietButton disabled={submitting || resending} label="Use a different email" onPress={() => { void pendingVerification.clear().then(() => router.replace('/sign-up')); }} />
      </View>
      <Text style={styles.note}>Use the newest code in your email. Codes expire after an hour.</Text>
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({ actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] }, note: { color: theme.colors.mutedText, ...theme.typography.supporting } });
