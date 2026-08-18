import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PipBrandMark } from '@/components/pip-brand-mark';
import type { PipIconName } from '@/components/pip-icon';
import type { ParentBackTarget } from '@/features/navigation/parent-navigation';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { BackNavigation, PageHeader, PageShell, TabBar } from './playmap-ui';

/**
 * Parent Mode's chrome.
 *
 * Navigation in Parent Mode is the tab bar and nothing else — no floating gear,
 * no floating add button. Screens that sit under a tab render {@link ParentScreen};
 * screens pushed on top of one render {@link ParentDetailScreen}, which trades
 * the tab bar for a single back control.
 */

export type ParentTabKey = 'home' | 'library' | 'add' | 'spaces' | 'settings';

const tabs: { key: ParentTabKey; label: string; icon: PipIconName; route: string; emphasised?: boolean }[] = [
  { key: 'home', label: 'Home', icon: 'home', route: '/parent/home' },
  { key: 'library', label: 'Library', icon: 'library', route: '/parent/toy-library' },
  { key: 'add', label: 'Add', icon: 'add', route: '/parent/add-toy', emphasised: true },
  { key: 'spaces', label: 'Spaces', icon: 'spaces', route: '/parent/locations' },
  { key: 'settings', label: 'Settings', icon: 'settings', route: '/parent/settings' },
];

export function ParentTabBar({ current }: { current: ParentTabKey }) {
  return (
    <TabBar
      items={tabs}
      onSelect={(key) => {
        const tab = tabs.find((candidate) => candidate.key === key);
        if (!tab || tab.key === current) return;
        // Tabs replace rather than push, so the back stack never grows a chain
        // of sibling tabs the parent has to unwind one at a time.
        router.replace(tab.route as ParentBackTarget);
      }}
      selected={current}
    />
  );
}

/** The greeting header on Parent Home: the day, a welcome, and the compact mark. */
export function ParentGreeting({ greeting, day }: { greeting: string; day: string }) {
  return (
    <View style={styles.greetingRow}>
      <View style={styles.greetingCopy}>
        <Text maxFontSizeMultiplier={1.6} style={styles.greetingDay}>{day}</Text>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={styles.greetingTitle}>{greeting}</Text>
      </View>
      <PipBrandMark variant="wordmark" width={54} />
    </View>
  );
}

/** A screen that sits under a tab. */
export function ParentScreen({
  tab,
  children,
  footer,
  scroll = true,
}: {
  tab: ParentTabKey;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  return (
    <PageShell footer={footer} scroll={scroll} tabBar={<ParentTabBar current={tab} />}>
      {children}
    </PageShell>
  );
}

/** A screen pushed on top of a tab, reached and left by one back control. */
export function ParentDetailScreen({
  backTo,
  backLabel = 'Back',
  children,
  footer,
  scroll = true,
}: {
  backTo: ParentBackTarget;
  backLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  return (
    <PageShell footer={footer} scroll={scroll}>
      <BackNavigation label={backLabel} onPress={() => router.replace(backTo)} />
      {children}
    </PageShell>
  );
}

export function ParentModeHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Home',
  action,
}: {
  title: string;
  subtitle?: string;
  backTo?: ParentBackTarget;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {backTo ? <BackNavigation label={backLabel} onPress={() => router.replace(backTo)} /> : null}
      <PageHeader action={action} subtitle={subtitle} title={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[4] },
  greetingRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12], justifyContent: 'space-between' },
  greetingCopy: { flex: 1, gap: 2 },
  greetingDay: { color: theme.colors.mutedText, ...theme.typography.meta },
  greetingTitle: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
});
