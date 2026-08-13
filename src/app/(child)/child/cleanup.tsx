import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ChildButton, ChildModeHeader, ChildPage, LocationPanel, ToyImage } from '@/components/child-ui';
import { PipIcon } from '@/components/pip-icon';
import { Banner, PinInput, PrimaryButton, SecondaryButton, SkeletonRows } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { verifyParentPin } from '@/features/child/parent-access';
import {
  beginCleanup,
  completeCleanup,
  completeCleanupWithParentOverride,
  loadCleanupState,
  requestCleanupHelp,
  saveCleanupStep,
} from '@/features/child/cleanup-service';
import { displayChildName, displayToyName, presentLocation } from '@/domain/presentation';
import { getActiveChildProfile } from '@/repositories/child-profiles-repository';
import type { ActivePlaySession } from '@/repositories/play-sessions-repository';
import { pinStorage } from '@/services/pin-storage';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Putting the toy away.
 *
 * Three steps, advanced only by the child. Nothing counts down, nothing
 * expires, and nothing auto-advances — the reassurance that there is no hurry
 * is on the screen, in words, because that is the part children are told least
 * often. Asking for a grown-up is always available and is never framed as
 * giving up.
 */
const steps = [
  { key: 'pieces', label: 'Pieces', title: 'Find all the pieces', body: "Look around for all the pieces. Don't forget to check underneath things!" },
  { key: 'back', label: 'Put it back', title: 'Put it back where it lives', body: null },
  { key: 'done', label: 'All done', title: 'All done', body: 'Everything is back where it lives.' },
] as const;

type HelpMode = 'child' | 'asking' | 'parent';

export default function CleanupRoute() {
  const [session, setSession] = useState<ActivePlaySession | null>(null);
  const [childId, setChildId] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [helpMode, setHelpMode] = useState<HelpMode>('child');
  const [pin, setPin] = useState('');
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const database = await initializeDatabase();
        const child = await getActiveChildProfile(database);
        const state = await loadCleanupState(database, child.id);
        // Marking cleanup as started is what lets a parent see, on Home, that
        // tidying is under way rather than untouched.
        const active = state.activeSession && state.cleanupRequired
          ? await beginCleanup(database, child.id)
          : state.activeSession;
        if (!mounted) return;
        setChildId(child.id);
        setSession(active);
        setStep(active?.cleanupStep ?? 0);
      } catch (caught: unknown) {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Pip could not open tidy-up.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const finish = useCallback(async (parentOverride = false): Promise<void> => {
    if (saving || childId === null) return;
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      if (parentOverride) await completeCleanupWithParentOverride(database, childId);
      else await completeCleanup(database, childId);
      setFinished(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not finish tidy-up.');
    } finally {
      setSaving(false);
    }
  }, [childId, saving]);

  const askForHelp = async (): Promise<void> => {
    if (childId === null) return;
    setHelpMode('asking');
    try {
      const database = await initializeDatabase();
      // Recorded so a parent can see help was asked for, even if they were not
      // in the room at the time.
      setSession(await requestCleanupHelp(database, childId));
    } catch {
      // Failing to record the request must not block asking for one.
    }
  };

  const verifyPin = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (!(await verifyParentPin(pinStorage, pin))) {
        setError('That PIN doesn’t match.');
        setPin('');
        return;
      }
      setHelpMode('parent');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not check that PIN.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ChildPage>
        <ChildModeHeader backLabel="Back" onBack={() => router.replace('/child/home')} />
        <SkeletonRows label="Opening tidy-up…" rows={2} />
      </ChildPage>
    );
  }

  if (!session?.toy && !finished) {
    return (
      <ChildPage>
        <ChildModeHeader backLabel="Back" onBack={() => router.replace('/child/home')} />
        {error ? <Banner message={error} tone="alert" /> : null}
        <Text accessibilityRole="header" style={styles.title}>Nothing to tidy up</Text>
        <Text style={styles.body}>No toy is out right now.</Text>
        <ChildButton label="Find a toy" onPress={() => router.replace('/child/categories')} />
      </ChildPage>
    );
  }

  const toy = session?.toy;

  if (finished) {
    return (
      <ChildPage
        footer={
          <>
            <ChildButton label="Find another toy" onPress={() => router.replace('/child/categories')} />
            <ChildButton label="I’m finished for now" onPress={() => router.replace('/child/home')} secondary />
          </>
        }
      >
        <View style={styles.doneBlock}>
          <View style={styles.doneMark}>
            <PipIcon color={theme.colors.success} name="check" size={30} strokeWidth={2.6} />
          </View>
          <Text accessibilityRole="header" style={styles.doneTitle}>All done</Text>
          <Text style={styles.doneBody}>
            {toy ? `${displayToyName(toy.name)} is back where it lives.` : 'Everything is back where it lives.'}
          </Text>
        </View>
      </ChildPage>
    );
  }

  if (helpMode === 'asking') {
    return (
      <ChildPage
        footer={
          <>
            <PrimaryButton
              busy={saving}
              disabled={pin.length !== 4}
              label="Continue"
              onPress={() => {
                void verifyPin();
              }}
            />
            <SecondaryButton label="Never mind, I’ll keep going" onPress={() => { setHelpMode('child'); setPin(''); setError(null); }} />
          </>
        }
      >
        <ChildModeHeader backLabel="Back" onBack={() => { setHelpMode('child'); setPin(''); }} />
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>Ask a grown-up</Text>
          <Text style={styles.body}>A grown-up can finish tidy-up for you with their PIN.</Text>
        </View>
        {error ? <Banner message={error} tone="alert" /> : null}
        <PinInput accessibilityLabel="Parent PIN" error={error ? '' : null} onChangeText={(value) => { setPin(value); setError(null); }} value={pin} />
      </ChildPage>
    );
  }

  if (helpMode === 'parent') {
    return (
      <ChildPage
        footer={
          <>
            <PrimaryButton
              busy={saving}
              label="Mark it tidied up"
              onPress={() => {
                void finish(true);
              }}
            />
            <SecondaryButton label="Back to tidy-up" onPress={() => setHelpMode('child')} />
          </>
        }
      >
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>Finish tidy-up for {displayChildName(session?.childName, 'this child')}?</Text>
          <Text style={styles.body}>
            {toy ? `${displayToyName(toy.name)} goes back to ${presentLocation(toy.roomName, toy.storageSpotName).instruction}.` : 'The toy will be marked as put away.'}
            {' This is recorded as a grown-up finishing it.'}
          </Text>
        </View>
        {error ? <Banner message={error} tone="alert" /> : null}
      </ChildPage>
    );
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const moveToStep = async (nextStep: number): Promise<void> => {
    if (childId === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      setSession(await saveCleanupStep(database, childId, nextStep));
      setStep(nextStep);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not save tidy-up progress.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ChildPage
      footer={
        <>
          <ChildButton
            disabled={saving}
            label={step === 0 ? 'I found all the pieces' : step === 1 ? "It's put away" : 'All done'}
            onPress={() => { if (isLast) void finish(); else void moveToStep(step + 1); }}
          />
          <ChildButton label="I need a grown-up" onPress={() => { void askForHelp(); }} secondary />
        </>
      }
    >
      <ChildModeHeader
        backLabel="Back"
        onBack={() => { if (step === 0) router.replace('/child/current-toy'); else void moveToStep(step - 1); }}
      />

      {error ? <Banner message={error} tone="alert" /> : null}

      <View accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${current.label}`} accessibilityRole="progressbar" style={styles.steps}>
        {steps.map((candidate, index) => (
          <View key={candidate.key} accessibilityElementsHidden style={styles.stepItem}>
            <View style={[styles.stepMark, index <= step && styles.stepMarkActive]}>
              {index < step
                ? <PipIcon color={theme.colors.white} name="check" size={13} strokeWidth={3} />
                : <Text style={[styles.stepNumber, index === step && styles.stepNumberActive]}>{index + 1}</Text>}
            </View>
            <Text numberOfLines={1} style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{candidate.label}</Text>
          </View>
        ))}
      </View>

      <Text accessibilityRole="header" style={styles.stepTitle}>
        {step === 1 && toy ? `Put ${displayToyName(toy.name)} back where it lives` : current.title}
      </Text>
      {current.body ? <Text style={styles.body}>{current.body}</Text> : null}

      {toy ? (
        <>
          <View style={styles.photoFrame}>
            <ToyImage uri={toy.imageUri} />
          </View>
          {step === 1 ? <LocationPanel room={toy.roomName} spot={toy.storageSpotName} /> : null}
        </>
      ) : null}

      {step === 0 ? (
        <View style={styles.reassurance}>
          <Text style={styles.reassuranceText}>Take your time. There&apos;s no timer.</Text>
        </View>
      ) : null}

      {session?.helpRequested ? (
        <Banner message="A grown-up has been asked to help. You can keep going while you wait." tone="info" />
      ) : null}
    </ChildPage>
  );
}

const styles = StyleSheet.create({
  copy: { gap: 6, paddingTop: theme.spacing[16] },
  title: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 28, lineHeight: 33 },
  body: { color: theme.colors.secondaryText, ...theme.typography.body },

  steps: { flexDirection: 'row', gap: theme.spacing[8] },
  stepItem: { alignItems: 'center', flex: 1, gap: 6 },
  stepMark: {
    alignItems: 'center',
    backgroundColor: theme.colors.neutralSurface,
    borderRadius: theme.radii.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  stepMarkActive: { backgroundColor: theme.colors.brandInk },
  stepNumber: { color: theme.colors.secondaryText, ...theme.typography.label, fontSize: 14 },
  stepNumberActive: { color: theme.colors.white },
  stepLabel: { color: theme.colors.secondaryText, ...theme.typography.meta },
  stepLabelActive: { color: theme.colors.brandInk, fontFamily: theme.fonts.bold },

  stepTitle: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 28, lineHeight: 33 },
  photoFrame: { alignSelf: 'center', borderRadius: theme.radii.sheet, overflow: 'hidden', width: '54%' },
  reassurance: {
    backgroundColor: theme.colors.surfaceSunshine,
    borderColor: theme.colors.borderSunshine,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    padding: theme.spacing[16],
  },
  reassuranceText: { color: theme.colors.primaryText, ...theme.typography.body },

  doneBlock: { alignItems: 'center', gap: theme.spacing[12], paddingTop: theme.spacing[40] },
  doneMark: {
    alignItems: 'center',
    backgroundColor: theme.colors.successMark,
    borderRadius: theme.radii.pill,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  doneTitle: { color: theme.colors.primaryText, textAlign: 'center', ...theme.typography.childTitle },
  doneBody: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.body },
});
