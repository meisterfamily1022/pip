import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { Banner, OptionCard, ToggleRow } from '@/components/playmap-ui';
import { READING_SUPPORTS, type ReadingSupport } from '@/domain/child-avatars';
import { displayChildName } from '@/domain/presentation';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { initializeDatabase } from '@/database/client';
import { saveFirstChildProfile } from '@/features/onboarding/onboarding-progress';

/**
 * Step 2, second half: how this child reads, and whether tidying comes first.
 *
 * Photos are always shown. These options only decide what accompanies them, so
 * the wording describes the addition rather than framing "pictures only" as a
 * lesser setting.
 */
const readingDescriptions: Record<ReadingSupport, { title: string; description: string }> = {
  pictures: { title: 'Pictures only', description: "Best for children who don't read yet" },
  'pictures-words': { title: 'Pictures and words', description: "Show the toy's picture and name" },
  'pictures-words-audio': { title: 'Pictures, words and speech', description: 'A speaker button reads each name aloud' },
};

export default function ChildProfilePreferencesRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const name = displayChildName(draft.childNickname, 'your child');

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/child-profile-setup');
  };

  return (
    <OnboardingScreen
      description="Photos are always shown. Choose what goes with them."
      footer={
        <PrimaryButton
          busy={saving}
          label={saving ? 'Adding child…' : 'Add child'}
          onPress={() => void saveProfile()}
        />
      }
      onBack={goBack}
      step={2}
      title="How should toys appear?"
    >
      {saveError ? <Banner message={saveError} tone="alert" /> : null}
      <View accessibilityRole="radiogroup" style={styles.options}>
        {READING_SUPPORTS.filter((support) => support !== 'pictures-words-audio').map((support) => (
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

      <Text style={styles.note}>{`You can change ${name}’s choices later in Settings.`}</Text>
    </OnboardingScreen>
  );

  async function saveProfile(): Promise<void> {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const database = await initializeDatabase();
      await saveFirstChildProfile(database, {
        name: draft.childNickname,
        avatarId: draft.childAvatarId,
        accentColorId: draft.childAccentColorId,
        choiceLimit: draft.choiceLimit,
        readingSupport: draft.childReadingSupport,
        cleanupRequired: draft.cleanupRequired,
      });
      router.replace('/first-location-setup');
    } catch (caught: unknown) {
      setSaveError(caught instanceof Error ? caught.message : 'This profile could not be saved. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
}

const styles = StyleSheet.create({
  options: { gap: theme.spacing[8] },
  note: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
