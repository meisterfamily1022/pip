import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { ErrorSummary, NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { AuthRequestError, resendVerification, verifyEmail } from '@/features/auth/auth-client';
import { pendingVerification } from '@/features/auth/sign-up-form';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Confirms the address with a six-digit code.
 *
 * The pending address is read from storage rather than passed as a param, so
 * closing the app mid-sign-up returns here instead of to an empty form.
 */
export default function VerifyEmailRoute() {
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void pendingVerification.get().then(setEmail);
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      await verifyEmail(email, code.trim());
      await pendingVerification.clear();
      router.replace('/family-space');
    } catch (caught: unknown) {
      setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.');
    } finally {
      setSubmitting(false);
    }
  }, [code, email]);

  const resend = useCallback(async (): Promise<void> => {
    if (!email) return;
    setError(null);
    try {
      await resendVerification(email);
      setNotice('If that address needs confirming, a new code is on its way.');
    } catch (caught: unknown) {
      setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.');
    }
  }, [email]);

  // Sending mail needs a provider credential that is not configured yet, so the
  // screen says so plainly rather than leaving a parent waiting for an email
  // that cannot arrive.
  const deliveryNotice = `Email delivery is not switched on in this build yet, so no code will arrive. ${pipBrand.name} still records the address.`;

  return (
    <OnboardingScreen
      description={email ? `Enter the six-digit code we sent to ${email}.` : 'Enter the six-digit code from your email.'}
      footer={
        <PrimaryButton
          label={submitting ? 'Confirming…' : 'Confirm email'}
          disabled={submitting || code.trim().length !== 6}
          onPress={() => {
            void submit();
          }}
        />
      }
      title="Confirm your email"
    >
      <NoticeBanner message={deliveryNotice} title="Before you wait for an email" tone="warning" />
      <ErrorSummary errors={error ? [error] : []} />
      {notice ? <NoticeBanner message={notice} tone="info" /> : null}

      <RoundedTextInput
        autoComplete="one-time-code"
        inputMode="numeric"
        keyboardType="number-pad"
        label="Six-digit code"
        maxLength={6}
        onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
        textContentType="oneTimeCode"
        value={code}
      />

      <View style={styles.actions}>
        <QuietButton
          label="Send another code"
          onPress={() => {
            void resend();
          }}
        />
        <QuietButton label="Use a different email" onPress={() => router.replace('/sign-up')} />
      </View>

      <Text style={styles.note}>Codes expire after a day. You can ask for a new one at any time.</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] },
  note: { color: theme.colors.mutedText, ...theme.typography.supporting },
});
