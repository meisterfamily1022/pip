import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { ConsentCheckbox, ErrorSummary, NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { RoundedTextInput } from '@/components/playmap-ui';
import { AuthRequestError, signUp } from '@/features/auth/auth-client';
import { errorSummary, hasErrors, pendingVerification, validateSignUp, type SignUpFieldErrors } from '@/features/auth/sign-up-form';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Creates a parent account.
 *
 * An account is optional in Pip: it exists for backup, recovery and sharing
 * later, and the app is fully usable without one. Nothing here asks about a
 * child.
 */
export default function SignUpRoute() {
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<SignUpFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    // Supabase passwordless OTP does not collect a password or profile fields.
    // Keep the existing consent validation without retaining extra identity data.
    const fields = { firstName: 'Parent', email, password: 'passwordless', acceptedTerms };
    const nextErrors = validateSignUp(fields);
    setErrors(nextErrors);
    setSubmitError(null);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      await signUp({ email: email.trim() });
      await pendingVerification.set(email.trim());
      router.push('/verify-email');
    } catch (caught: unknown) {
      setSubmitError(
        caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScreen
      description={`An account keeps a backup of your library and lets you use ${pipBrand.name} on more than one device. You can keep using ${pipBrand.name} on this device without one.`}
      footer={
        <PrimaryButton
          label={submitting ? 'Sending code…' : 'Email me a code'}
          disabled={submitting}
          onPress={() => {
            void submit();
          }}
        />
      }
      title={`Create your ${pipBrand.name} account`}
    >
      <ErrorSummary errors={errorSummary(errors)} />
      {submitError ? <NoticeBanner message={submitError} tone="error" /> : null}

      <RoundedTextInput
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={errors.email ?? null}
        inputMode="email"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        textContentType="emailAddress"
        value={email}
      />

      <ConsentCheckbox
        error={errors.acceptedTerms ?? null}
        label="I accept the terms of service and privacy notice"
        onValueChange={setAcceptedTerms}
        value={acceptedTerms}
      />

      <View style={styles.footnote}>
        <Text style={styles.footnoteText}>
          {`${pipBrand.name} never asks for your child's full name, birthday, or school. Children never sign in.`}
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  footnote: { backgroundColor: theme.colors.surfaceLavender, borderRadius: theme.radii.medium, padding: theme.spacing[16] },
  footnoteText: { color: theme.colors.secondaryText, ...theme.typography.supporting },
});
