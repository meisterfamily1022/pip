import { useState } from 'react';
import { router } from 'expo-router';

import { pipBrand } from '@/brand/pip-brand';
import { ErrorSummary, NoticeBanner, PasswordField } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { AuthRequestError, signIn } from '@/features/auth/auth-client';

/**
 * Signs a returning parent in.
 *
 * Errors come straight from the service, which deliberately gives the same
 * message for a wrong password and an unknown address, so this screen cannot
 * be used to discover which addresses are registered.
 */
export default function SignInRoute() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/parent/home');
    } catch (caught: unknown) {
      setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScreen
      description={`Your library stays on this device either way. An account is for backup and using ${pipBrand.name} elsewhere.`}
      footer={
        <PrimaryButton
          label={submitting ? 'Signing in…' : 'Sign in'}
          disabled={submitting || !email.trim() || !password}
          onPress={() => {
            void submit();
          }}
        />
      }
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
      <PasswordField
        autoComplete="current-password"
        label="Password"
        onChangeText={setPassword}
        textContentType="password"
        value={password}
      />

      <QuietButton label="I forgot my password" onPress={() => router.push('/forgot-password')} />
      <QuietButton label="Create an account instead" onPress={() => router.replace('/sign-up')} />

      <NoticeBanner
        message="Password reset emails need a mail provider, which is not switched on in this build yet."
        tone="info"
        title="About password resets"
      />
    </OnboardingScreen>
  );
}
