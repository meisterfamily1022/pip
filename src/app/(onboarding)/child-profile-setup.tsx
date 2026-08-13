import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { AccentColorPicker, AvatarPicker, ProfileAvatar } from '@/components/profile-ui';
import { SegmentedControl } from '@/components/playmap-ui';
import { READING_SUPPORT_LABELS, type ReadingSupport } from '@/domain/child-avatars';
import type { ChoiceLimit } from '@/domain/models';
import { displayChildName } from '@/domain/presentation';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validateChildNickname } from '@/features/onboarding/validation';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Step 2, first half: who is playing.
 *
 * Three questions and a live preview, rather than the nine sections this used
 * to be. Reading support and tidy-up rules are the second half, so neither
 * screen is a wall.
 *
 * Nothing here asks for a birthday, a legal name, a school, or anything
 * diagnostic. A recognizable name is required so Child Mode never invents a
 * profile identity or mistakes sample/browser state for family data.
 */
export default function ChildProfileSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/parent-pin-confirm');
  };

  const continueToPreferences = (): void => {
    const validationError = validateChildNickname(draft.childNickname);
    if (validationError) {
      setError(validationError);
      return;
    }
    router.push('/child-profile-preferences');
  };

  const validName = validateChildNickname(draft.childNickname) === null;
  const previewName = validName ? displayChildName(draft.childNickname) : "Your child's profile";
  const readingLabel = READING_SUPPORT_LABELS[draft.childReadingSupport as ReadingSupport] ?? READING_SUPPORT_LABELS['pictures-words'];

  return (
    <OnboardingScreen
      description="Create a profile your child can recognize."
      footer={
        <PrimaryButton label="Next: reading & cleanup" onPress={continueToPreferences} />
      }
      onBack={goBack}
      step={2}
      title="Add a child"
    >
      <View style={styles.preview}>
        <ProfileAvatar
          accentColorId={draft.childAccentColorId}
          avatarId={draft.childAvatarId}
          decorative
          size={64}
        />
        <View style={styles.previewCopy}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text numberOfLines={1} style={styles.previewName}>{previewName}</Text>
          <Text numberOfLines={1} style={styles.previewMeta}>
            {`${draft.choiceLimit} ${draft.choiceLimit === 1 ? 'choice' : 'choices'} · ${readingLabel}`}
          </Text>
        </View>
      </View>

      <Field
        error={error}
        label="Child's name"
        onChangeText={(childNickname) => {
          updateDraft({ childNickname });
          setError(null);
        }}
        placeholder="For example, Ada"
        returnKeyType="done"
        onSubmitEditing={continueToPreferences}
        value={draft.childNickname}
      />

      <AvatarPicker
        accentColorId={draft.childAccentColorId}
        label="Choose an icon"
        onChange={(childAvatarId) => updateDraft({ childAvatarId })}
        value={draft.childAvatarId}
      />
      <AccentColorPicker
        label="Color"
        onChange={(childAccentColorId) => updateDraft({ childAccentColorId })}
        value={draft.childAccentColorId}
      />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>How many toys should Pip show at once?</Text>
        <SegmentedControl<ChoiceLimit>
          accessibilityLabel="How many toys should Pip show at once?"
          getOptionLabel={(limit) => `${limit} toy${limit === 1 ? '' : 's'}`}
          onChange={(choiceLimit) => updateDraft({ choiceLimit })}
          options={[1, 3, 5]}
          value={draft.choiceLimit}
        />
      </View>

      <Text style={styles.note}>
        Reading support and cleanup rules come next — or set them any time in Settings.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    padding: theme.spacing[12],
  },
  previewCopy: { flex: 1, gap: 1 },
  previewLabel: { color: theme.colors.mutedText, ...theme.typography.caption },
  previewName: { color: theme.colors.primaryText, ...theme.typography.rowTitle },
  previewMeta: { color: theme.colors.secondaryText, ...theme.typography.meta },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  note: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
