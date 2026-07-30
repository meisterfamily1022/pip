import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { SearchIcon } from '@/design/icons';
import { EmptyState, PrimaryButton, Screen } from '@/design/primitives';

export default function NotFoundRoute() {
  return (
    <Screen contentStyle={styles.fill} mode="parent" scroll={false}>
      <EmptyState
        action={<PrimaryButton label="Go to start" onPress={() => router.replace('/')} />}
        description="That screen is not part of PlayMap."
        icon={SearchIcon}
        title="We could not find that page"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, justifyContent: 'center' } });
