import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChildPage } from '@/components/child-ui';
import { PipIcon, type PipIconName } from '@/components/pip-icon';
import { ProfileAvatar } from '@/components/profile-ui';
import { Banner, SkeletonRows } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { displayChildName, displayToyName } from '@/domain/presentation';
import { getActiveChildProfile } from '@/repositories/child-profiles-repository';
import { getActivePlaySession, type ActivePlaySession } from '@/repositories/play-sessions-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Child Home.
 *
 * Three things a child can do, in the order they are most likely to want them.
 * The only way to Parent Mode is the PIN, and it sits at the bottom as a small,
 * plain link rather than a button competing with the choices.
 */
export default function ChildHomeRoute() {
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [session, setSession] = useState<ActivePlaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const database = await initializeDatabase();
      const profile = await getActiveChildProfile(database);
      setChild(profile);
      setSession(await getActivePlaySession(database, profile.id));
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not get ready.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (loading) {
    return (
      <ChildPage>
        <SkeletonRows label="Getting Pip ready…" rows={3} />
      </ChildPage>
    );
  }

  const name = child ? displayChildName(child.name) : null;

  return (
    <ChildPage
      /*
       * The way out to Parent Mode is pinned to the bottom of the screen rather
       * than trailing the choices, as the approved design has it. It sits
       * outside the scroll view, so it covers nothing and the choices keep
       * their own scroll room at large text sizes.
       */
      footer={
        <View style={styles.grownUpsRow}>
          <Pressable
            accessibilityHint="Opens the parent PIN screen"
            accessibilityLabel="Parent mode"
            accessibilityRole="button"
            onPress={() => router.push('/child/parent-return')}
            style={({ pressed }) => [styles.grownUps, pressed && styles.pressed]}
          >
            <PipIcon color={theme.colors.mutedText} name="lock" size={16} />
            <Text style={styles.grownUpsText}>Parent mode</Text>
          </Pressable>
        </View>
      }
      footerPlain
    >
      {error ? <Banner message={error} tone="alert" /> : null}

      <View style={styles.greeting}>
        {child ? <ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} decorative size={56} /> : null}
        <View style={styles.greetingCopy}>
          <Text style={styles.hello}>{name ? `Hi, ${name}!` : 'Hi!'}</Text>
          <Text accessibilityRole="header" style={styles.title}>What do you want to play with?</Text>
        </View>
      </View>

      <View style={styles.choices}>
        <Choice
          detail="Choose what looks fun"
          icon="library"
          onPress={() => router.push('/child/categories')}
          title="Pick a toy"
          tone="primary"
        />
        <Choice
          detail="Let Pip pick one"
          icon="sparkle"
          onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: 'anything', surprise: '1' } })}
          title="Surprise me"
          tone="sunshine"
        />
        {session ? (
          <Choice
            detail={session.toy ? displayToyName(session.toy.name) : 'See the toy that is out'}
            icon="check"
            onPress={() => router.push('/child/current-toy')}
            title="Playing now"
            tone="plain"
          />
        ) : null}
      </View>

    </ChildPage>
  );
}

function Choice({
  title, detail, icon, tone, onPress, disabled = false,
}: {
  title: string;
  detail: string;
  icon: PipIconName;
  tone: 'primary' | 'sunshine' | 'plain';
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityHint={disabled ? undefined : detail}
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        tone === 'primary' && styles.choicePrimary,
        tone === 'sunshine' && styles.choiceSunshine,
        disabled && styles.choiceDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.choiceIcon, disabled && styles.choiceIconDisabled]}>
        <PipIcon color={disabled ? theme.colors.disabledText : theme.colors.brandInk} name={icon} size={24} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceTitle, disabled && styles.disabledText]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.choiceDetail, disabled && styles.disabledText]}>{detail}</Text>
      </View>
      {disabled ? null : <PipIcon color={theme.colors.brandInk} name="chevron-right" size={20} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  disabledText: { color: theme.colors.disabledText },
  greeting: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12], paddingVertical: theme.spacing[8] },
  greetingCopy: { flex: 1, gap: 2 },
  hello: { color: theme.colors.secondaryText, ...theme.typography.rowTitle },
  title: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 30, lineHeight: 34 },
  choices: { gap: theme.spacing[12] },
  choice: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sheet,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[16],
    minHeight: 92,
    padding: theme.spacing[16],
  },
  choicePrimary: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.infoBorder },
  choiceSunshine: { backgroundColor: theme.colors.surfaceSunshine, borderColor: theme.colors.borderSunshine },
  choiceDisabled: { backgroundColor: theme.colors.mutedSurface, borderColor: theme.colors.mutedBorder },
  choiceIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.card,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  choiceIconDisabled: { backgroundColor: theme.colors.neutralSurface },
  choiceCopy: { flex: 1, gap: 2 },
  choiceTitle: { color: theme.colors.primaryText, ...theme.typography.sectionTitle, fontSize: 22 },
  choiceDetail: { color: theme.colors.secondaryText, ...theme.typography.body },
  grownUpsRow: { alignItems: 'flex-end' },
  grownUps: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: theme.measurements.minimumTouchTarget,
    paddingHorizontal: theme.spacing[8],
  },
  grownUpsText: { color: theme.colors.mutedText, ...theme.typography.label, fontSize: 14 },
});
