import { useCallback, useState } from 'react';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ToyButton, ToyError, ToyLoading } from '@/components/toy-ui';
import { initializeDatabase } from '@/database/client';
import { changeParentPin, loadParentSettings, saveParentSettings, type ChangePinInput } from '@/features/settings/settings-service';
import { pinStorage } from '@/services/pin-storage';
import { playmapTheme as theme, screenContentStyle } from '@/theme/playmap-theme';

export default function ParentSettingsRoute() {
  const [nickname, setNickname] = useState('');
  const [choiceLimit, setChoiceLimit] = useState<1 | 3 | 5>(3);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [pinInput, setPinInput] = useState<ChangePinInput>({ currentPin: '', newPin: '', confirmation: '' });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const database = await initializeDatabase();
      const settings = await loadParentSettings(database);
      setNickname(settings.childNickname ?? '');
      setChoiceLimit(settings.choiceLimit);
      setCleanupRequired(settings.cleanupRequired);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveSettings = async (): Promise<void> => {
    if (savingSettings) return;
    setSavingSettings(true); setError(null); setSuccess(null);
    try {
      const database = await initializeDatabase();
      const settings = await saveParentSettings(database, { childNickname: nickname, choiceLimit, cleanupRequired });
      setNickname(settings.childNickname ?? '');
      setChoiceLimit(settings.choiceLimit);
      setCleanupRequired(settings.cleanupRequired);
      setSuccess('Settings saved.');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const changePin = async (): Promise<void> => {
    if (savingPin) return;
    setSavingPin(true); setError(null); setSuccess(null);
    try {
      await changeParentPin(pinStorage, pinInput);
      setPinInput({ currentPin: '', newPin: '', confirmation: '' });
      setSuccess('Parent PIN changed.');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not change PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  if (loading) return <ToyLoading />;
  if (error && !nickname) return <ToyError message={error} onRetry={() => { void load(); }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>Settings</Text>
        {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        {success && <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text>}

        <View style={[styles.section, styles.childSection]}>
          <Text style={styles.sectionTitle}>Child Experience</Text>
          <Text style={styles.label}>Child nickname</Text>
          <TextInput accessibilityLabel="Child nickname" onChangeText={setNickname} placeholder="Ari" style={styles.input} value={nickname} />
          <Text style={styles.label}>Choice limit</Text>
          <View style={styles.row}>{([1, 3, 5] as const).map((limit) => <ToyButton key={limit} label={`${limit} toy${limit === 1 ? '' : 's'}`} onPress={() => setChoiceLimit(limit)} />)}</View>
          <View style={styles.switchRow}><Text style={styles.switchText}>Cleanup required</Text><Switch value={cleanupRequired} onValueChange={setCleanupRequired} /></View>
          <ToyButton disabled={savingSettings} label={savingSettings ? 'Saving…' : 'Save Settings'} onPress={() => { void saveSettings(); }} />
        </View>

        <View style={[styles.section, styles.accessSection]}>
          <Text style={styles.sectionTitle}>Parent Access</Text>
          <TextInput accessibilityLabel="Current PIN" keyboardType="number-pad" maxLength={4} onChangeText={(value) => setPinInput((current) => ({ ...current, currentPin: value.replace(/\D/g, '') }))} placeholder="Current PIN" secureTextEntry style={styles.input} value={pinInput.currentPin} />
          <TextInput accessibilityLabel="New PIN" keyboardType="number-pad" maxLength={4} onChangeText={(value) => setPinInput((current) => ({ ...current, newPin: value.replace(/\D/g, '') }))} placeholder="New PIN" secureTextEntry style={styles.input} value={pinInput.newPin} />
          <TextInput accessibilityLabel="Confirm new PIN" keyboardType="number-pad" maxLength={4} onChangeText={(value) => setPinInput((current) => ({ ...current, confirmation: value.replace(/\D/g, '') }))} placeholder="Confirm new PIN" secureTextEntry style={styles.input} value={pinInput.confirmation} />
          <ToyButton disabled={savingPin} label={savingPin ? 'Changing…' : 'Change Parent PIN'} onPress={() => { void changePin(); }} />
        </View>

        <View style={[styles.section, styles.dataSection]}>
          <Text style={styles.sectionTitle}>Data and Privacy</Text>
          <Text>PlayMap stores your toy library and photos on this device.</Text>
          <Text>Deleting PlayMap may delete your saved toy library.</Text>
          <Text>PlayMap V1 does not upload toy photos or require an account.</Text>
        </View>

        <View style={[styles.section, styles.supportSection]}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Text>App version: {Constants.expoConfig?.version ?? '1.0.0'}</Text>
          <Text>Privacy Policy: Not configured yet.</Text>
          <Text>Support: Not configured yet.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.background, flex: 1 },
  content: { ...screenContentStyle, gap: 18 },
  error: { color: theme.colors.danger },
  input: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, borderWidth: 1, color: theme.colors.text, fontSize: 17, minHeight: theme.sizes.input, paddingHorizontal: 16 },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { ...theme.shadows.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: 12, padding: 18 }, childSection: { backgroundColor: theme.colors.peachSoft }, accessSection: { backgroundColor: theme.colors.lavenderSoft }, dataSection: { backgroundColor: theme.colors.sageSoft }, supportSection: { backgroundColor: theme.colors.yellowSoft },
  sectionTitle: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700' },
  success: { color: theme.colors.success },
  switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  switchText: { fontSize: 16, fontWeight: '600' },
  title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 32, fontWeight: '700' },
});
