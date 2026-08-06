import { useState } from 'react';
import { router } from 'expo-router';

import { NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { AuthRequestError, requestPasswordReset } from '@/features/auth/auth-client';

/**
 * Starts a password reset.
 *
 * The confirmation is deliberately worded so it reveals nothing: it says what
 * happens *if* the address has an account, because saying "no such account"
 * would let anyone test addresses.
 */
export default function ForgotPasswordRoute() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught: unknown) {
      setError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <OnboardingScreen title="Check your email" description="If that address has an account, a reset link is on its way.">
        <NoticeBanner
          message="Email delivery is not switched on in this build yet, so no message will arrive. Nothing is wrong with your account."
          tone="warning"
          title="Before you wait"
        />
        <QuietButton label="Back to sign in" onPress={() => router.replace('/sign-in')} />
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      description="We will send a link to set a new password."
      footer={
        <PrimaryButton
          label={submitting ? 'Sending…' : 'Send reset link'}
          disabled={submitting || !email.trim()}
          onPress={() => {
            void submit();
          }}
        />
      }
      title="Reset your password"
    >
      {error ? <NoticeBanner message={error} tone="error" /> : null}
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
      <QuietButton label="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </OnboardingScreen>
  );
}
