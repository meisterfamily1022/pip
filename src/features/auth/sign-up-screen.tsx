import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { ConsentCheckbox, ErrorSummary, NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { AuthRequestError, signUp } from './auth-client';
import { errorSummary, hasErrors, validateSignUp, type SignUpFieldErrors } from './sign-up-form';

export function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<SignUpFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const submit = async (): Promise<void> => {
    if (submittingRef.current) return;
    const fields = { firstName: 'Parent', email, password: 'passwordless', acceptedTerms };
    const nextErrors = validateSignUp(fields);
    setErrors(nextErrors);
    setSubmitError(null);
    if (hasErrors(nextErrors)) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await signUp({ email: email.trim() });
      router.replace('/verify-email');
    } catch (caught: unknown) {
      setSubmitError(caught instanceof AuthRequestError ? caught.message : 'We could not reach the server. Try again shortly.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScreen
      description={`An account keeps a backup of your library and lets you use ${pipBrand.name} on more than one device. You can keep using ${pipBrand.name} on this device without one.`}
      footer={<PrimaryButton disabled={submitting} label={submitting ? 'Sending code…' : 'Email me a code'} onPress={() => void submit()} />}
      title={`Create your ${pipBrand.name} account`}
    >
      <ErrorSummary errors={errorSummary(errors)} />
      {submitError ? <NoticeBanner message={submitError} tone="error" /> : null}
      <RoundedTextInput autoCapitalize="none" autoComplete="email" autoCorrect={false} error={errors.email ?? null} inputMode="email" keyboardType="email-address" label="Email" onChangeText={setEmail} textContentType="emailAddress" value={email} />
      <QuietButton label="Already have an account? Sign in" onPress={() => router.replace('/sign-in')} />
      <ConsentCheckbox error={errors.acceptedTerms ?? null} label="I accept the terms of service and privacy notice" onValueChange={setAcceptedTerms} value={acceptedTerms} />
      <View style={styles.footnote}><Text style={styles.footnoteText}>{`${pipBrand.name} never asks for your child's full name, birthday, or school. Children never sign in.`}</Text></View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  footnote: { backgroundColor: theme.colors.surfaceLavender, borderRadius: theme.radii.medium, padding: theme.spacing[16] },
  footnoteText: { color: theme.colors.secondaryText, ...theme.typography.supporting },
});
