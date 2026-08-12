import { useState } from 'react';
import { router } from 'expo-router';

import { pipBrand } from '@/brand/pip-brand';
import { ErrorSummary } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { AuthRequestError, signIn } from './auth-client';
import { isValidEmail, pendingVerification } from './sign-up-form';

/** Platform-neutral passwordless sign-in screen. */
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    if (!isValidEmail(email)) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim());
      await pendingVerification.set(email.trim());
      router.push('/verify-email');
    } catch (caught: unknown) {
      setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScreen
      description={`Your library stays on this device either way. An account is for backup and using ${pipBrand.name} elsewhere.`}
      footer={<PrimaryButton disabled={submitting || !isValidEmail(email)} label={submitting ? 'Sending code…' : 'Email me a code'} onPress={() => void submit()} />}
      title="Sign in"
    >
      <ErrorSummary errors={error ? [error] : []} />
      <RoundedTextInput
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        inputMode="email"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        textContentType="emailAddress"
        value={email}
      />
      <QuietButton label="Create an account instead" onPress={() => router.replace('/sign-up')} />
    </OnboardingScreen>
  );
}
