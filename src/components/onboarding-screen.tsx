import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackLink, Body, Eyebrow, Screen, ScreenTitle } from '@/design/primitives';
import { spacing } from '@/design/tokens';

type OnboardingScreenProps = PropsWithChildren<{
  /** Progress label, e.g. "Step 1 of 3". */
  step?: string;
  title: string;
  description?: string;
  /** Destination of the back affordance; omitted on the welcome screen. */
  back?: { label: string; onPress(): void };
  footer?: ReactNode;
}>;

/**
 * Page chrome shared by the four setup steps: the warm cream parent page with
 * an optional back link, progress eyebrow, serif heading and intro copy.
 */
export function OnboardingScreen({ step, title, description, back, footer, children }: OnboardingScreenProps) {
  return (
    <Screen mode="parent" footer={footer}>
      {back ? <BackLink label={back.label} onPress={back.onPress} /> : null}
      {step ? <Eyebrow>{step}</Eyebrow> : null}
      <ScreenTitle style={styles.title}>{title}</ScreenTitle>
      {description ? <Body style={styles.description}>{description}</Body> : null}
      <View style={styles.body}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, marginTop: spacing.xxxl },
  description: { marginTop: spacing.md },
  title: { marginTop: spacing.sm },
});
