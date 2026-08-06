import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton } from '@/components/onboarding-controls';
import { QuietButton, RoundedTextInput } from '@/components/playmap-ui';
import { AuthRequestError, renameHousehold } from '@/features/auth/auth-client';
import { getSessionSnapshot } from '@/features/auth/session-state';
import { householdNameSuggestions, validateHouseholdName } from '@/features/auth/sign-up-form';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Names the household.
 *
 * Renaming is idempotent, so a retry after a dropped connection settles on the
 * same value rather than creating a second household.
 */
export default function FamilySpaceRoute() {
  const session = getSessionSnapshot();
  const firstName = session.account?.firstName ?? '';
  const suggestions = householdNameSuggestions(firstName);

  const [name, setName] = useState(suggestions[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    const validationError = validateHouseholdName(name);
    setError(validationError);
    setSubmitError(null);
    if (validationError) return;

    const householdId = session.account?.householdId;
    if (!householdId) {
      setSubmitError('Sign in to continue.');
      return;
    }

    setSubmitting(true);
    try {
      await renameHousehold(householdId, name.trim());
      router.replace('/onboarding');
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
      description="This is just a label for your family's library. You can change it later."
      footer={
        <PrimaryButton
          label={submitting ? 'Saving…' : 'Continue'}
          disabled={submitting}
          onPress={() => {
            void submit();
          }}
        />
      }
      title={`What should we call your ${pipBrand.name}?`}
    >
      {submitError ? <NoticeBanner message={submitError} tone="error" /> : null}

      <RoundedTextInput error={error} label="Name" maxLength={60} onChangeText={setName} value={name} />

      <View style={styles.suggestions}>
        <Text style={styles.suggestionsLabel}>Suggestions</Text>
        <View style={styles.suggestionRow}>
          {suggestions.map((suggestion) => (
            <QuietButton
              key={suggestion}
              accessibilityLabel={`Use the name ${suggestion}`}
              label={suggestion}
              onPress={() => {
                setName(suggestion);
                setError(null);
              }}
            />
          ))}
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  suggestions: { gap: theme.spacing[8] },
  suggestionsLabel: { color: theme.colors.primaryText, ...theme.typography.label },
});
