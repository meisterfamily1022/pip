import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '@/database/client';
import {
  BackLink,
  Body,
  ErrorState,
  ErrorText,
  LoadingState,
  ModeBadge,
  PrimaryButton,
  Screen,
  ScreenTitle,
  SecondaryButton,
  SectionTitle,
  SelectPill,
  SuccessText,
  TextField,
  TintPanel,
  ToggleRow,
} from '@/design/primitives';
import { colors, fontSizes, spacing } from '@/design/tokens';
import { changeParentPin } from '@/features/parent-access/parent-pin';
import { validateRequiredName } from '@/features/onboarding/validation';
import { getSettings, updateSettings } from '@/repositories/settings-repository';
import type { ChoiceLimit } from '@/domain/models';

/** How long the Save button keeps its "Saved ✓" confirmation. */
const SAVED_FLASH_MS = 1800;

const CHOICE_LIMITS: ChoiceLimit[] = [1, 3, 5];

const choiceLimitLabel = (limit: ChoiceLimit): string => `${limit} ${limit === 1 ? 'toy' : 'toys'}`;

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

type PinField = 'current' | 'next' | 'confirm';
type PinErrors = Record<PinField, string | null>;

const NO_PIN_ERRORS: PinErrors = { confirm: null, current: null, next: null };

/** Routes a message thrown by `changeParentPin` to the field it belongs under. */
const pinFieldForMessage = (message: string): PinField => {
  if (message.includes('current')) return 'current';
  if (message.includes('match')) return 'confirm';
  return 'next';
};

/**
 * Settings — child experience, Child Mode behaviour and parent access.
 *
 * Everything here is local to the device: the nickname, choice limit and
 * cleanup rule live in SQLite, and the PIN lives in the secure store.
 */
export default function ParentSettingsRoute() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [choiceLimit, setChoiceLimit] = useState<ChoiceLimit>(3);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinErrors, setPinErrors] = useState<PinErrors>(NO_PIN_ERRORS);
  const [pinUpdated, setPinUpdated] = useState(false);

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const database = await initializeDatabase();
      const settings = await getSettings(database);
      setNickname(settings.childNickname ?? '');
      setChoiceLimit(settings.choiceLimit);
      setCleanupRequired(settings.cleanupRequired);
    } catch (caught: unknown) {
      setLoadError(caught instanceof Error ? caught.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const saveSettings = async (): Promise<void> => {
    const validationError = validateRequiredName(nickname, 'Child nickname');
    setNicknameError(validationError);
    if (validationError) return;
    setSaveError(null);
    try {
      const database = await initializeDatabase();
      await updateSettings(database, { childNickname: nickname.trim(), choiceLimit, cleanupRequired });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), SAVED_FLASH_MS);
    } catch (caught: unknown) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save settings.');
    }
  };

  const updatePin = async (): Promise<void> => {
    setPinErrors(NO_PIN_ERRORS);
    setPinUpdated(false);
    try {
      await changeParentPin(currentPin, nextPin, confirmPin);
      setCurrentPin('');
      setNextPin('');
      setConfirmPin('');
      setPinUpdated(true);
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Could not update the PIN.';
      setPinErrors({ ...NO_PIN_ERRORS, [pinFieldForMessage(message)]: message });
    }
  };

  const goHome = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/parent/home');
  };

  if (loading) {
    return (
      <Screen mode="parent" scroll={false}>
        <LoadingState label="Loading settings…" />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen mode="parent" scroll={false}>
        <ErrorState message={loadError} onRetry={() => { void reload(); }} />
      </Screen>
    );
  }

  return (
    <Screen mode="parent">
      <BackLink label="Home" onPress={goHome} />
      <View style={styles.header}>
        <ModeBadge mode="parent" />
        <ScreenTitle>Settings</ScreenTitle>
        <Body>Manage Child Mode choices, parent access, and local data.</Body>
      </View>

      <TintPanel style={styles.panel} tint="peach">
        <SectionTitle>Child Experience</SectionTitle>
        <View style={styles.panelBody}>
          <TextField
            error={nicknameError}
            helper="PlayMap v1 supports one child profile on this device."
            label="Child nickname"
            onChangeText={(value) => { setNickname(value); setNicknameError(null); }}
            value={nickname}
          />
        </View>
      </TintPanel>

      <TintPanel style={styles.panel} tint="sage">
        <SectionTitle>Child Mode Settings</SectionTitle>
        <View style={styles.panelBody}>
          <Text style={styles.fieldLabel}>Choice limit</Text>
          <View accessibilityRole="radiogroup" style={styles.pills}>
            {CHOICE_LIMITS.map((limit) => (
              <SelectPill
                accessibilityLabel={`Offer ${choiceLimitLabel(limit)}`}
                key={limit}
                label={choiceLimitLabel(limit)}
                onPress={() => setChoiceLimit(limit)}
                selected={choiceLimit === limit}
              />
            ))}
          </View>
          <ToggleRow
            description="Ask for cleanup before another toy choice."
            onValueChange={setCleanupRequired}
            title="Cleanup required"
            value={cleanupRequired}
          />
          <PrimaryButton
            accessibilityLabel="Save settings"
            label={saved ? 'Saved ✓' : 'Save Settings'}
            onPress={() => { void saveSettings(); }}
          />
          {saveError ? <ErrorText>{saveError}</ErrorText> : null}
        </View>
      </TintPanel>

      <TintPanel tint="lilac">
        <SectionTitle>Parent Access</SectionTitle>
        <View style={styles.panelBody}>
          <TextField
            error={pinErrors.current}
            keyboardType="number-pad"
            label="Current PIN"
            maxLength={4}
            onChangeText={(value) => { setCurrentPin(digitsOnly(value)); setPinErrors(NO_PIN_ERRORS); setPinUpdated(false); }}
            placeholder="••••"
            secureTextEntry
            value={currentPin}
          />
          <TextField
            error={pinErrors.next}
            keyboardType="number-pad"
            label="New PIN"
            maxLength={4}
            onChangeText={(value) => { setNextPin(digitsOnly(value)); setPinErrors(NO_PIN_ERRORS); setPinUpdated(false); }}
            placeholder="••••"
            secureTextEntry
            value={nextPin}
          />
          <TextField
            error={pinErrors.confirm}
            keyboardType="number-pad"
            label="Confirm new PIN"
            maxLength={4}
            onChangeText={(value) => { setConfirmPin(digitsOnly(value)); setPinErrors(NO_PIN_ERRORS); setPinUpdated(false); }}
            placeholder="••••"
            secureTextEntry
            value={confirmPin}
          />
          <SecondaryButton label="Update PIN" onPress={() => { void updatePin(); }} />
          {pinUpdated ? <SuccessText>Your PIN has been updated.</SuccessText> : null}
        </View>
      </TintPanel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { color: colors.textPrimary, fontSize: fontSizes.label, fontWeight: '700' },
  header: { gap: spacing.sm, marginBottom: spacing.xxl, marginTop: spacing.sm },
  panel: { marginBottom: spacing.xl },
  panelBody: { gap: spacing.lg, marginTop: spacing.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm },
});
