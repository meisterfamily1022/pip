import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { playmapTheme as theme } from '@/theme/playmap-theme';
import { PageShell, StepEyebrow } from './playmap-ui';

/**
 * The shape every setup step shares.
 *
 * The step rule and the back control sit on one line above the title, the
 * primary action sits in a sticky footer that rides above the keyboard, and the
 * body scrolls between them. That is what stops the last field of a form from
 * hiding underneath the button that submits it.
 *
 * The first step deliberately has no back control: there is nothing behind it.
 */
type OnboardingScreenProps = PropsWithChildren<{
  /** 1-based. Omit on screens outside the numbered run, like Welcome. */
  step?: number;
  totalSteps?: number;
  title: string;
  description?: string;
  footer?: ReactNode;
  onBack?(): void;
}>;

export function OnboardingScreen({
  step,
  totalSteps = 3,
  title,
  description,
  children,
  footer,
  onBack,
}: OnboardingScreenProps) {
  return (
    <PageShell footer={footer}>
      {step ? <StepEyebrow current={step} onBack={onBack} total={totalSteps} /> : null}
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  copy: { gap: 6 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  description: { color: theme.colors.secondaryText, ...theme.typography.body },
  body: { gap: theme.spacing[16] },
});
