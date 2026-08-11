import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ParentScreen } from '@/components/parent-ui';
import { PipIcon, type PipIconName } from '@/components/pip-icon';
import {
  Banner,
  EmptyStateCard,
  PrimaryButton,
  SecondaryButton,
  SkeletonRows,
} from '@/components/playmap-ui';
import { ToyForm } from '@/components/toy-form';
import { initializeDatabase } from '@/database/client';
import type { ToySetupDraft } from '@/domain/models';
import { loadLocationTree, type LocationTreeItem } from '@/features/locations/location-service';
import { saveIntakeQueue } from '@/features/toys/toy-intake-queue';
import { createParentToy, type ToyFormInput } from '@/features/toys/toy-service';
import { listToySetupDrafts } from '@/features/toys/toy-setup-draft-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The Add tab.
 *
 * Opens on the choice of how to add, because a parent arriving here has either
 * a shelf to work through or one toy in their hand, and those are different
 * jobs. Photographing a shelf is the default path: it is the one that scales.
 *
 * A batch already in progress skips the chooser entirely and resumes where it
 * was left, which is what makes "save & finish later" safe to offer.
 */
type Mode = 'choose' | 'batch' | 'manual' | 'camera-blocked';

export default function AddToyRoute() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [mode, setMode] = useState<Mode>(modeParam === 'bulk' ? 'batch' : 'choose');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const database = await initializeDatabase();
      const [tree, drafts] = await Promise.all([loadLocationTree(database), listToySetupDrafts(database)]);
      setLocations(tree);
      // A queue left mid-review is the strongest signal about what the parent
      // was doing; resume it rather than asking the question again.
      if (drafts.length > 0) setMode('batch');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Add Toys could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const submit = async (input: ToyFormInput): Promise<void> => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      await createParentToy(database, input);
      router.replace('/parent/toy-library');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That toy could not be saved.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const submitBulk = async (drafts: readonly ToySetupDraft[]): Promise<ToySetupDraft[]> => {
    if (submitting.current) return [...drafts];
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      return await saveIntakeQueue(database, drafts);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Those toys could not be saved.');
      return [...drafts];
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ParentScreen tab="add">
        <SkeletonRows label="Opening Add Toys…" rows={3} />
      </ParentScreen>
    );
  }

  const hasSomewhereToPutThings = locations.some((room) => room.storageSpots.length > 0);

  if (!hasSomewhereToPutThings) {
    return (
      <ParentScreen tab="add">
        <Text accessibilityRole="header" style={styles.title}>Add toys</Text>
        <EmptyStateCard
          action={<PrimaryButton label="Add a room" onPress={() => router.push('/parent/add-location')} />}
          icon="spaces"
          message="Every toy needs somewhere to live. Add one room and one spot inside it, then come straight back."
          title="Nowhere to put them yet"
        />
      </ParentScreen>
    );
  }

  if (mode === 'camera-blocked') {
    return <CameraBlocked onUsePhotos={() => setMode('batch')} />;
  }

  if (mode === 'choose') {
    return (
      <ParentScreen tab="add">
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Add toys</Text>
          <Text style={styles.subtitle}>Photos stay on this device.</Text>
        </View>

        {error ? <Banner message={error} tone="alert" /> : null}

        <IntakeOption
          description="Camera stays open — one tap per toy, name them all afterwards."
          icon="camera"
          onPress={() => setMode('batch')}
          recommended
          title="Photograph a shelf"
        />
        <IntakeOption
          description="Select as many as you like at once."
          icon="photos"
          onPress={() => setMode('batch')}
          title="Choose from Photos"
        />
        <IntakeOption
          description="No photo needed — add it later."
          icon="plus"
          onPress={() => setMode('manual')}
          title="Add one toy by hand"
        />
      </ParentScreen>
    );
  }

  return (
    <ParentScreen tab="add">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{mode === 'batch' ? 'Review photos' : 'Add one toy'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'batch' ? 'Each photo becomes one toy.' : 'Fill in what you know. Everything can be changed later.'}
        </Text>
      </View>

      {error ? <Banner message={error} tone="alert" /> : null}

      <ToyForm
        error={null}
        locations={locations}
        onBulkSubmit={mode === 'batch' ? submitBulk : undefined}
        onSubmit={submit}
        saving={saving}
        startInBulkMode={mode === 'batch'}
        submitLabel="Save toy"
      />

      <SecondaryButton label="Choose a different way to add" onPress={() => setMode('choose')} />
    </ParentScreen>
  );
}

function IntakeOption({
  title, description, icon, onPress, recommended = false,
}: {
  title: string;
  description: string;
  icon: PipIconName;
  onPress(): void;
  recommended?: boolean;
}) {
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.option, recommended && styles.optionRecommended, pressed && styles.pressed]}
    >
      <View style={[styles.optionIcon, recommended && styles.optionIconRecommended]}>
        <PipIcon color={theme.colors.brandInk} name={icon} size={24} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <PipIcon color={theme.colors.brandInk} name="chevron-right" size={18} />
    </Pressable>
  );
}

/**
 * Camera access has been refused.
 *
 * States what happened without blame, gives the exact three taps that undo it,
 * and — because that is a trip out of the app — offers the path that still
 * works right now.
 */
function CameraBlocked({ onUsePhotos }: { onUsePhotos(): void }) {
  const steps = ['Open Settings › Pip', 'Switch Camera on', 'Come back and keep going'];
  return (
    <ParentScreen tab="add">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>The camera is switched off</Text>
        <Text style={styles.subtitle}>Pip can only open the camera if iOS is allowing it.</Text>
      </View>

      <View style={styles.steps}>
        <Text style={styles.stepsHeading}>To turn it back on</Text>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <Banner
        message="Choosing from Photos needs a different permission and may already be allowed."
        title="You can still add toys"
        tone="info"
      />

      <PrimaryButton
        label="Open iPhone Settings"
        onPress={() => {
          void Linking.openSettings();
        }}
      />
      <SecondaryButton label="Choose from Photos instead" onPress={onUsePhotos} />
    </ParentScreen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  header: { gap: 2 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.meta },

  option: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.neutralBorder,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: 76,
    padding: theme.spacing[16],
  },
  optionRecommended: { borderColor: theme.colors.brandBlue, borderWidth: 2 },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderRadius: theme.radii.control,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  optionIconRecommended: { backgroundColor: theme.colors.brandPrimarySoft },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { color: theme.colors.primaryText, ...theme.typography.rowTitle },
  optionDescription: { color: theme.colors.secondaryText, ...theme.typography.meta },

  steps: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing[12],
    padding: theme.spacing[16],
  },
  stepsHeading: { color: theme.colors.primaryText, ...theme.typography.label },
  step: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12] },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radii.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stepNumberText: { color: theme.colors.brandInk, ...theme.typography.label, fontSize: 13 },
  stepText: { color: theme.colors.primaryText, flex: 1, ...theme.typography.meta, fontSize: 14 },
});
