import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ParentBackTarget } from '@/features/navigation/parent-navigation';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { BackNavigation, PageHeader } from './playmap-ui';

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
      {backTo && <BackNavigation label={backLabel} onPress={() => router.replace(backTo)} />}
      <PageHeader action={action} eyebrow="PARENT MODE" subtitle={subtitle} title={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[8] },
});
