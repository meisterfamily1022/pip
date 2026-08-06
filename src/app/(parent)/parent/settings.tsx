import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ToyButton, ToyError, ToyLoading } from '@/components/toy-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import { ConfirmationDialog, DestructiveButton, FormCard, PageShell, PrimaryButton, RoundedTextInput, ToggleRow } from '@/components/playmap-ui';
import { PipBrandMark } from '@/components/pip-brand-mark';
import { pipBrand } from '@/brand/pip-brand';
import { initializeDatabase } from '@/database/client';
import { addChildProfile, changeParentPin, listChildProfiles, loadParentSettings, saveParentSettings, type ChangePinInput } from '@/features/settings/settings-service';
import { pinStorage } from '@/services/pin-storage';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { resetPlayMapData } from '@/features/settings/reset-playmap';
import { resetRouteAccess } from '@/startup/route-access';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import type { ChildProfile } from '@/domain/models';
import { setActiveChild } from '@/repositories/settings-repository';

export default function ParentSettingsRoute() {
  const [nickname, setNickname] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [choiceLimit, setChoiceLimit] = useState<1 | 3 | 5>(3);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [pinInput, setPinInput] = useState<ChangePinInput>({ currentPin: '', newPin: '', confirmation: '' });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const savingSettingsRef = useRef(false);
  const savingPinRef = useRef(false);
  const resettingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const database = await initializeDatabase();
      const [settings, profiles] = await Promise.all([loadParentSettings(database), listChildProfiles(database)]);
      setChildren(profiles); setActiveChildId(settings.activeChildId);
      setNickname(profiles.find((child) => child.id === settings.activeChildId)?.name ?? settings.childNickname ?? '');
      setChoiceLimit(settings.choiceLimit);
      setCleanupRequired(settings.cleanupRequired);
    } catch (caught: unknown) {
      setPageError(caught instanceof Error ? caught.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveSettings = async (): Promise<void> => {
    if (savingSettingsRef.current) return;
    savingSettingsRef.current = true;
    setSavingSettings(true); setSettingsError(null); setSettingsSuccess(null);
    try {
      const database = await initializeDatabase();
      const settings = await saveParentSettings(database, { childNickname: nickname, choiceLimit, cleanupRequired });
      setNickname(settings.childNickname ?? '');
      setChoiceLimit(settings.choiceLimit);
      setCleanupRequired(settings.cleanupRequired);
      setSettingsSuccess('Settings saved.');
    } catch (caught: unknown) {
      setSettingsError(caught instanceof Error ? caught.message : 'Could not save settings.');
    } finally {
      savingSettingsRef.current = false; setSavingSettings(false);
    }
  };

  const chooseChild = async (child: ChildProfile): Promise<void> => {
    try { const database = await initializeDatabase(); await setActiveChild(database, child.id); setActiveChildId(child.id); setNickname(child.name); setSettingsError(null); }
    catch (caught: unknown) { setSettingsError(caught instanceof Error ? caught.message : 'Could not select this child.'); }
  };

  const addChild = async (): Promise<void> => {
    if (savingSettingsRef.current) return;
    savingSettingsRef.current = true; setSavingSettings(true); setSettingsError(null); setSettingsSuccess(null);
    try { const database = await initializeDatabase(); const child = await addChildProfile(database, newChildName); await setActiveChild(database, child.id); setChildren(await listChildProfiles(database)); setActiveChildId(child.id); setNickname(child.name); setNewChildName(''); setSettingsSuccess(`${child.name} was added and selected.`); }
    catch (caught: unknown) { setSettingsError(caught instanceof Error ? caught.message : 'Could not add this child.'); }
    finally { savingSettingsRef.current = false; setSavingSettings(false); }
  };

  const changePin = async (): Promise<void> => {
    if (savingPinRef.current) return;
    savingPinRef.current = true;
    setSavingPin(true); setPinError(null); setPinSuccess(null);
    try {
      await changeParentPin(pinStorage, pinInput);
      setPinInput({ currentPin: '', newPin: '', confirmation: '' });
      setPinSuccess('Parent PIN changed.');
    } catch (caught: unknown) {
      setPinError(caught instanceof Error ? caught.message : 'Could not change PIN.');
    } finally {
      savingPinRef.current = false; setSavingPin(false);
    }
  };

  const resetData = async (): Promise<void> => {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true); setPageError(null);
    try {
      const database = await initializeDatabase();
      await resetPlayMapData(database);
      await resetRouteAccess();
      router.replace('/onboarding');
    } catch (caught: unknown) {
      setPageError(caught instanceof Error ? caught.message : 'Could not reset Pip.');
      setResetConfirming(false);
      resettingRef.current = false; setResetting(false);
    }
  };

  if (loading) return <ToyLoading />;
  if (pageError && !nickname) return <ToyError message={pageError} onRetry={() => { void load(); }} />;

  return (
    <PageShell>
      <ParentModeHeader backTo={parentBackTargets.settings} subtitle="Manage Child Mode choices, parent access, and local data." title="Settings" />
      {pageError && <Text accessibilityLiveRegion="polite" style={styles.error}>{pageError}</Text>}

      <FormCard tone="sage">
        <PipBrandMark style={styles.aboutLogo} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>About Pip</Text>
        <Text style={styles.supporting}>{pipBrand.primaryTagline}</Text>
        <Text style={styles.supporting}>A calm, local-first toy library for simpler choices and easier cleanup.</Text>
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Child Profiles</Text>
        {settingsError && <Text accessibilityLiveRegion="polite" style={styles.inlineError}>{settingsError}</Text>}
        {settingsSuccess && <Text accessibilityLiveRegion="polite" style={styles.success}>{settingsSuccess}</Text>}
        <Text style={styles.supporting}>Select a child to rename them or to open their Child Mode next.</Text>
        <View style={styles.row}>{children.map((child) => <ToyButton key={child.id} label={child.name} selected={activeChildId === child.id} onPress={() => { void chooseChild(child); }} />)}</View>
        <RoundedTextInput accessibilityLabel="Selected child name" label="Selected child name" onChangeText={setNickname} placeholder="Ari" value={nickname} />
        <RoundedTextInput accessibilityLabel="New child name" label="Add another child" onChangeText={setNewChildName} placeholder="Sam" value={newChildName} />
        <PrimaryButton disabled={savingSettings || newChildName.trim().length < 2} label={savingSettings ? 'Adding…' : 'Add Child'} onPress={() => { void addChild(); }} />
      </FormCard>

      <FormCard tone="sage">
        <Text style={styles.sectionTitle}>Child Mode Settings</Text>
        <Text style={styles.label}>Choice limit</Text>
        <View style={styles.row}>{([1, 3, 5] as const).map((limit) => <ToyButton key={limit} label={`${limit} toy${limit === 1 ? '' : 's'}`} selected={choiceLimit === limit} onPress={() => setChoiceLimit(limit)} />)}</View>
        <ToggleRow description="Ask for cleanup before another toy choice." label="Cleanup required" value={cleanupRequired} onValueChange={setCleanupRequired} />
        <PrimaryButton disabled={savingSettings} label={savingSettings ? 'Saving…' : 'Save Settings'} onPress={() => { void saveSettings(); }} />
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Parent Access</Text>
        {pinError && <Text accessibilityLiveRegion="polite" style={styles.inlineError}>{pinError}</Text>}
        {pinSuccess && <Text accessibilityLiveRegion="polite" style={styles.success}>{pinSuccess}</Text>}
        <RoundedTextInput keyboardType="number-pad" label="Current PIN" maxLength={4} onChangeText={(value) => { setPinInput((current) => ({ ...current, currentPin: value.replace(/\D/g, '') })); setPinError(null); }} secureTextEntry value={pinInput.currentPin} />
        <RoundedTextInput keyboardType="number-pad" label="New PIN" maxLength={4} onChangeText={(value) => { setPinInput((current) => ({ ...current, newPin: value.replace(/\D/g, '') })); setPinError(null); }} secureTextEntry value={pinInput.newPin} />
        <RoundedTextInput keyboardType="number-pad" label="Confirm new PIN" maxLength={4} onChangeText={(value) => { setPinInput((current) => ({ ...current, confirmation: value.replace(/\D/g, '') })); setPinError(null); }} secureTextEntry value={pinInput.confirmation} />
        <PrimaryButton disabled={savingPin} label={savingPin ? 'Changing…' : 'Change Parent PIN'} onPress={() => { void changePin(); }} />
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Data & Privacy</Text>
        <Text style={styles.supporting}>Toy records, play history, and original photos are stored locally on this device.</Text>
        <Text style={styles.supporting}>Pip has no account, cloud backup, Face ID unlock, or remote parent dashboard. Child profiles and their checkout state stay on this device.</Text>
        <Text style={styles.supporting}>Resetting removes every Pip room, storage spot, toy, photo, play record, setting, and the parent PIN from this device.</Text>
        <Text style={styles.supporting}>Less mess. More play.</Text>
        <DestructiveButton disabled={resetting} label={resetting ? 'Resetting…' : 'Reset Pip'} onPress={() => setResetConfirming(true)} />
      </FormCard>

      <ConfirmationDialog confirmLabel="Reset Pip" destructive message="This permanently removes all toys, photos, rooms, settings, play history, and the parent PIN from this device." onCancel={() => setResetConfirming(false)} onConfirm={() => { void resetData(); }} title="Reset all Pip data?" visible={resetConfirming} />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  error: { color: theme.colors.danger },
  inlineError: { backgroundColor: theme.colors.errorSoft, borderRadius: theme.radii.md, color: theme.colors.danger, fontSize: 14, fontWeight: '600', padding: 10 },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  aboutLogo: { alignSelf: 'flex-start', maxWidth: 150 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700' },
  supporting: { color: theme.colors.secondaryText, fontSize: 15, lineHeight: 22 },
  success: { color: theme.colors.success },
});
