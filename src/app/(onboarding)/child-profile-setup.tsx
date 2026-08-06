import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { BackButton, ChoiceControls, Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { AccentColorPicker, AvatarPicker, ProfileAvatar } from '@/components/profile-ui';
import { QuietButton } from '@/components/playmap-ui';
import { ToyButton } from '@/components/toy-ui';
import { READING_SUPPORTS, READING_SUPPORT_LABELS } from '@/domain/child-avatars';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validateChildNickname } from '@/features/onboarding/validation';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The first child profile.
 *
 * Optional by design: a parent can skip and add profiles later from Settings,
 * because Pip works without any. Nothing here asks for a birthday, a legal
 * name, a school, or anything diagnostic.
 */
export default function ChildProfileSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const continueToLocation = (): void => {
    const validationError = validateChildNickname(draft.childNickname);
    if (validationError) {
      setError(validationError);
      return;
    }
    router.push('/first-location-setup');
  };

  const skip = (): void => {
    // A placeholder profile keeps Child Mode usable straight away; the parent
    // can rename it, or add more, from Settings.
    updateDraft({ childNickname: 'My child' });
    router.push('/first-location-setup');
  };

  return (
    <OnboardingScreen
      step="Step 2 of 3"
      title={`Who will use ${pipBrand.name}?`}
      description="A nickname and a look, so your child recognises their own space. You can add more children later."
      footer={<PrimaryButton label="Continue" onPress={continueToLocation} />}
    >
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/parent-pin-setup'))} />

      <View style={styles.preview}>
        <ProfileAvatar
          accentColorId={draft.childAccentColorId}
          avatarId={draft.childAvatarId}
          name={draft.childNickname || 'This profile'}
          size={72}
        />
      </View>

      <Field
        label="Child nickname"
        value={draft.childNickname}
        onChangeText={(value) => {
          updateDraft({ childNickname: value });
          setError(null);
        }}
        placeholder="For example, Sam"
        error={error}
      />

      <AvatarPicker
        accentColorId={draft.childAccentColorId}
        onChange={(childAvatarId) => updateDraft({ childAvatarId })}
        value={draft.childAvatarId}
      />
      <AccentColorPicker
        onChange={(childAccentColorId) => updateDraft({ childAccentColorId })}
        value={draft.childAccentColorId}
      />

      <View style={styles.group}>
        <Text style={styles.label}>Words and pictures</Text>
        <View style={styles.row}>
          {READING_SUPPORTS.map((support) => (
            <ToyButton
              key={support}
              label={READING_SUPPORT_LABELS[support]}
              onPress={() => updateDraft({ childReadingSupport: support })}
              selected={draft.childReadingSupport === support}
            />
          ))}
        </View>
      </View>

      <ChoiceControls
        choiceLimit={draft.choiceLimit}
        onChoiceLimitChange={(choiceLimit) => updateDraft({ choiceLimit })}
        cleanupRequired={draft.cleanupRequired}
        onCleanupRequiredChange={(cleanupRequired) => updateDraft({ cleanupRequired })}
      />

      <View style={styles.skip}>
        <QuietButton label="Skip for now" onPress={skip} />
        <Text style={styles.skipText}>
          {`${pipBrand.name} works without profiles. Add or rename children any time in Settings.`}
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.spacing[8] },
  label: { color: theme.colors.primaryText, ...theme.typography.label },
  preview: { alignItems: 'center', paddingVertical: theme.spacing[8] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  skip: { alignItems: 'flex-start', gap: theme.spacing[8] },
  skipText: { color: theme.colors.mutedText, ...theme.typography.supporting },
});
