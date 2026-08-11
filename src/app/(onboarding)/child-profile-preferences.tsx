import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { OptionCard, ToggleRow } from '@/components/playmap-ui';
import { READING_SUPPORTS, type ReadingSupport } from '@/domain/child-avatars';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Step 2, second half: how this child reads, and whether tidying comes first.
 *
 * Photos are always shown. These options only decide what accompanies them, so
 * the wording describes the addition rather than framing "pictures only" as a
 * lesser setting.
 */
const readingDescriptions: Record<ReadingSupport, { title: string; description: string }> = {
  pictures: { title: 'Pictures only', description: 'For children who don’t read yet' },
  'pictures-words': { title: 'Pictures and words', description: 'Toy names appear under each photo' },
  'pictures-words-audio': { title: 'Pictures, words and speech', description: 'A speaker button reads each name aloud' },
};

export default function ChildProfilePreferencesRoute() {
  const { draft, updateDraft } = useOnboarding();
  const name = draft.childNickname.trim() || 'your child';

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/child-profile-setup');
  };

  return (
    <OnboardingScreen
      description="Photos are always shown. Choose what goes with them."
      footer={
        <PrimaryButton
          label={`Save ${draft.childNickname.trim() ? `${draft.childNickname.trim()}’s` : 'this'} profile`}
          onPress={() => router.push('/first-location-setup')}
        />
      }
      onBack={goBack}
      step={2}
      title={`How ${name} sees toys`}
    >
      <View accessibilityRole="radiogroup" style={styles.options}>
        {READING_SUPPORTS.map((support) => (
          <OptionCard
            description={readingDescriptions[support].description}
            key={support}
            onPress={() => updateDraft({ childReadingSupport: support })}
            selected={draft.childReadingSupport === support}
            title={readingDescriptions[support].title}
          />
        ))}
      </View>

      <ToggleRow
        description="Pip walks through putting the last toy away first."
        label="Tidy up before the next toy"
        onValueChange={(cleanupRequired) => updateDraft({ cleanupRequired })}
        value={draft.cleanupRequired}
      />

      <Text style={styles.note}>Both of these can change at any time in Settings.</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  options: { gap: theme.spacing[8] },
  note: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
