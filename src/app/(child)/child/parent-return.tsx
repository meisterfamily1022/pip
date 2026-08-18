import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChildPage } from '@/components/child-ui';
import { PipIcon } from '@/components/pip-icon';
import { Banner, PinInput, PrimaryButton } from '@/components/playmap-ui';
import {
  clearPinGate,
  describePinAttempt,
  initialPinGateState,
  isPinGateCoolingDown,
  registerFailedPinAttempt,
  verifyParentPin,
  type PinGateState,
} from '@/features/child/parent-access';
import { parentAccessPreferences } from '@/services/parent-access-preferences';
import { pinStorage } from '@/services/pin-storage';
import { leaveChildMode } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The only way out of Child Mode.
 *
 * Three tries, then a short pause — long enough to stop a child guessing their
 * way through, short enough that a parent who mistyped is not stuck. Nothing
 * here says the child did something wrong, and nothing locks permanently.
 */
export default function ParentReturnRoute() {
  const [pin, setPin] = useState('');
  const [gate, setGate] = useState<PinGateState>(initialPinGateState);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const coolingDown = isPinGateCoolingDown(gate, now);

  // Ticks only while a pause is running, so the countdown is live but the
  // screen is otherwise completely still.
  useEffect(() => {
    if (!isPinGateCoolingDown(gate, Date.now())) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [gate]);

  const submit = async (): Promise<void> => {
    if (submittingRef.current || coolingDown) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (await verifyParentPin(pinStorage, pin)) {
        setGate(clearPinGate());
        parentAccessPreferences.markVerified(Date.now());
        await leaveChildMode();
        router.replace('/parent/home');
        return;
      }
      const next = registerFailedPinAttempt(gate, Date.now());
      setGate(next);
      setNow(Date.now());
      setPin('');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not check that PIN.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const message = describePinAttempt(gate, now);

  return (
    <ChildPage
      footer={
        <PrimaryButton
          busy={submitting}
          disabled={pin.length !== 4 || coolingDown}
          label={coolingDown ? 'Waiting a moment…' : 'Continue'}
          onPress={() => {
            void submit();
          }}
        />
      }
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to play"
          accessibilityRole="button"
          onPress={() => router.replace('/child/home')}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <PipIcon color={theme.colors.brandInk} name="chevron-left" size={20} />
          <Text style={styles.backLabel}>Back to play</Text>
        </Pressable>
      </View>

      <View style={styles.lockRow}>
        <View style={styles.lockTile}>
          <PipIcon color={theme.colors.brandInk} name="lock" size={26} />
        </View>
      </View>

      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>Parent mode</Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN.</Text>
      </View>

      {error ? <Banner message={error} tone="alert" /> : null}
      {message ? <Banner message={message} tone="alert" /> : null}

      <PinInput
        accessibilityLabel="Parent PIN"
        // The keyboard opens on arrival, as it does on the two other PIN
        // screens. A parent reaching for Parent Mode is here to type, and
        // without this the boxes look like a display rather than a field.
        autoFocus
        error={message ? '' : null}
        onChangeText={(value) => {
          setPin(value);
          setError(null);
        }}
        value={pin}
      />
    </ChildPage>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  header: { flexDirection: 'row' },
  back: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: theme.measurements.minimumTouchTarget,
    paddingRight: theme.spacing[8],
  },
  backLabel: { color: theme.colors.brandInk, ...theme.typography.label },
  lockRow: { alignItems: 'center', paddingTop: theme.spacing[24] },
  lockTile: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radii.card,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  copy: { alignItems: 'center', gap: 6 },
  title: { color: theme.colors.primaryText, textAlign: 'center', ...theme.typography.pageTitle, fontSize: 26, lineHeight: 31 },
  subtitle: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.body },
});
