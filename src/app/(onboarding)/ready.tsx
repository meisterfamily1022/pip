import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { PipIcon } from '@/components/pip-icon';
import { PageShell, PrimaryButton, QuietButton } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { countToys } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Setup is done.
 *
 * A checklist of what now exists, then straight into photographing toys —
 * which is the only thing left that Pip cannot do for the parent. "Look around
 * first" is offered plainly, not buried, because a parent who wants to see the
 * app before committing photos to it should not have to guess how.
 */
function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <View accessibilityLabel={`${label}. ${done ? 'Done' : 'Not yet'}`} accessible style={styles.row}>
      <View style={[styles.mark, done && styles.markDone]}>
        {done ? <PipIcon color={theme.colors.success} name="check" size={13} strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.rowLabel, !done && styles.rowLabelPending]}>{label}</Text>
    </View>
  );
}

export default function ReadyRoute() {
  const { draft } = useOnboarding();
  const [toyCount, setToyCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const database = await initializeDatabase();
          setToyCount(await countToys(database));
        } catch {
          // The count is reassurance, not a gate. A failure here must not block
          // a parent from leaving this screen.
        }
      })();
    }, []),
  );

  const childName = draft.childNickname.trim();
  const room = draft.roomName.trim();
  const spot = draft.storageSpotName.trim();
  const place = room && spot ? `the ${room} has a ${spot}` : 'your first spot is set';

  return (
    <PageShell
      footer={
        <>
          <PrimaryButton label="Add my first toys" onPress={() => router.replace('/parent/add-toy')} />
          <QuietButton label="Look around first" onPress={() => router.replace('/parent/home')} />
        </>
      }
    >
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>{`${pipBrand.name} is ready`}</Text>
        <Text style={styles.summary}>
          {childName
            ? `${childName}’s profile is set and ${place}. Next, photograph what’s on it.`
            : `Your setup is saved and ${place}. Next, photograph what’s on it.`}
        </Text>
      </View>

      <View style={styles.checklist}>
        <ChecklistRow done label="Parent PIN set" />
        <ChecklistRow done={Boolean(childName)} label={childName ? `${childName}’s profile created` : 'Child profile — add one any time'} />
        <ChecklistRow done={Boolean(room && spot)} label={room && spot ? `${room} · ${spot} added` : 'First room and spot added'} />
        <ChecklistRow
          done={toyCount > 0}
          label={toyCount > 0 ? `${toyCount} ${toyCount === 1 ? 'toy' : 'toys'} in the library` : 'No toys yet'}
        />
      </View>

      <Text style={styles.note}>Everything here can be changed later from Settings.</Text>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: theme.spacing[8], paddingTop: theme.spacing[32] },
  title: { color: theme.colors.primaryText, textAlign: 'center', ...theme.typography.pageTitle },
  summary: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.body },
  checklist: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing[12],
    marginTop: theme.spacing[16],
    padding: theme.spacing[16],
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12] },
  mark: {
    alignItems: 'center',
    borderColor: theme.colors.neutralBorder,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  markDone: { backgroundColor: theme.colors.successMark, borderColor: theme.colors.successMark },
  rowLabel: { color: theme.colors.primaryText, flex: 1, ...theme.typography.label, fontSize: 14 },
  rowLabelPending: { color: theme.colors.secondaryText, fontFamily: theme.fonts.regular },
  note: { color: theme.colors.mutedText, textAlign: 'center', ...theme.typography.meta },
});
