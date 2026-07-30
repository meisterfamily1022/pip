import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '@/database/client';
import { LocationArrowIcon, LockIcon } from '@/design/icons';
import {
  Body,
  Card,
  ConfirmButton,
  ErrorText,
  Eyebrow,
  LoadingState,
  PrimaryButton,
  Screen,
  ScreenTitle,
  SecondaryButton,
  TextField,
  TextLink,
  TintPanel,
} from '@/design/primitives';
import { colors, fontSizes, fonts, spacing } from '@/design/tokens';
import { verifyParentPin } from '@/features/parent-access/parent-pin';
import { finishPlaying, loadCurrentToy, type CurrentToy } from '@/features/play/play-service';

/**
 * The cleanup routine the child completes before choosing another toy.
 *
 * Everything here is on-device and on-screen: "I Need Help" reassures the child
 * and points them at a grown-up, and the grown-up override is a PIN check.
 */

const CLEANUP_STEPS = [
  'Put the pieces back.',
  'Put the toy in its storage location.',
  'Confirm that everything is put away.',
] as const;

const digitsOnly = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

export default function CleanupRoute() {
  const [current, setCurrent] = useState<CurrentToy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [overrideVisible, setOverrideVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const database = await initializeDatabase();
      setCurrent(await loadCurrentToy(database));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load your toy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const putItAway = async (): Promise<void> => {
    setFinishing(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      await finishPlaying(database);
      router.replace('/child/home');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not put this toy away.');
      setFinishing(false);
    }
  };

  const stillPlaying = (): void => {
    router.replace('/child/current-toy');
  };

  const closeOverride = (): void => {
    setOverrideVisible(false);
    setPin('');
    setPinError(null);
  };

  const submitOverride = async (): Promise<void> => {
    setPinError(null);
    try {
      if (!(await verifyParentPin(pin))) {
        setPinError("That PIN doesn't look right — try again.");
        setPin('');
        return;
      }
      const database = await initializeDatabase();
      await finishPlaying(database);
      router.replace('/child/home');
    } catch (caught: unknown) {
      setPinError(caught instanceof Error ? caught.message : 'Could not check that PIN.');
    }
  };

  if (loading) {
    return (
      <Screen mode="child">
        <LoadingState label="Getting ready to tidy up…" />
      </Screen>
    );
  }

  return (
    <Screen mode="child">
      <Eyebrow>CLEANUP TIME</Eyebrow>
      <ScreenTitle style={styles.heading}>Let&apos;s put it away.</ScreenTitle>

      {current ? (
        <TintPanel style={styles.locationPanel} tint="mint">
          <View
            accessible
            accessibilityLabel={`${current.toy.name} goes in the ${current.toy.roomName}, in the ${current.toy.storageSpotName}`}
            style={styles.locationInner}
          >
            <Text style={styles.toyName}>{current.toy.name}</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationPart}>{current.toy.roomName}</Text>
              <LocationArrowIcon color={colors.greenDeep} size={20} />
              <Text style={styles.locationPart}>{current.toy.storageSpotName}</Text>
            </View>
          </View>
        </TintPanel>
      ) : null}

      <Card style={styles.stepsCard}>
        {CLEANUP_STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </Card>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={styles.actions}>
        <ConfirmButton
          disabled={finishing}
          label="Yes, All Done"
          onPress={() => {
            void putItAway();
          }}
        />
        <SecondaryButton label="I Need Help" onPress={() => setHelpVisible(true)} style={styles.choice} />
        <SecondaryButton label="I'm Still Playing" onPress={stillPlaying} style={styles.choice} />
      </View>

      {helpVisible ? (
        <TintPanel style={styles.helpPanel} tint="butter">
          <Text accessibilityLiveRegion="polite" style={styles.helpTitle}>
            That&apos;s okay.
          </Text>
          <Body>Go and find a grown-up. Show them this screen and they will help you put the toy away.</Body>
          <SecondaryButton label="Okay" onPress={() => setHelpVisible(false)} style={styles.helpDismiss} />
        </TintPanel>
      ) : null}

      {overrideVisible ? (
        <TintPanel style={styles.overridePanel} tint="lilac">
          <View style={styles.overrideHeader}>
            <LockIcon color={colors.purpleDeep} size={20} />
            <Text style={styles.overrideTitle}>Grown-up override</Text>
          </View>
          <TextField
            autoFocus
            error={pinError}
            keyboardType="number-pad"
            label="Parent PIN"
            maxLength={4}
            onChangeText={(value) => {
              setPin(digitsOnly(value));
              setPinError(null);
            }}
            secureTextEntry
            value={pin}
          />
          <PrimaryButton
            disabled={pin.length < 4}
            label="Skip cleanup"
            onPress={() => {
              void submitOverride();
            }}
          />
          <SecondaryButton label="Cancel" onPress={closeOverride} />
        </TintPanel>
      ) : (
        <TextLink label="Grown-up: skip cleanup" onPress={() => setOverrideVisible(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md, marginTop: spacing.xl },
  choice: { minHeight: 52 },
  heading: { fontSize: fontSizes.heading, lineHeight: 38, marginBottom: spacing.lg, marginTop: spacing.sm },
  helpDismiss: { marginTop: spacing.sm },
  helpPanel: { gap: spacing.md, marginTop: spacing.xl },
  helpTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.sectionTitle, fontWeight: '700' },
  locationInner: { alignItems: 'center', gap: spacing.sm },
  locationPanel: { marginBottom: spacing.lg },
  locationPart: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.cardTitle, fontWeight: '700' },
  locationRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  overrideHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  overridePanel: { gap: spacing.lg, marginTop: spacing.xl },
  overrideTitle: { color: colors.textPrimary, fontSize: fontSizes.label, fontWeight: '700' },
  step: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stepNumberText: { color: colors.greenDeep, fontFamily: fonts.heading, fontSize: fontSizes.bodyLarge, fontWeight: '700' },
  stepText: { color: colors.textPrimary, flex: 1, fontSize: fontSizes.bodyLarge, lineHeight: 26 },
  stepsCard: { gap: spacing.lg },
  toyName: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.subheading, fontWeight: '700', textAlign: 'center' },
});
