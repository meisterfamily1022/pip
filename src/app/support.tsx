import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pipBrand } from '@/brand/pip-brand';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The public support page.
 *
 * Linked from the App Store and the landing page footer.
 * Provides contact info and getting-started guidance.
 */
export default function SupportRoute() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} contentInsetAdjustmentBehavior="automatic" style={styles.scroll}>
        <View style={styles.column}>
          {Platform.OS === 'web' ? null : (
            <Pressable
              accessibilityLabel="Back to Settings"
              accessibilityRole="button"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/parent/settings'))}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.backLabel}>‹ Back</Text>
            </Pressable>
          )}
          <Text accessibilityRole="header" style={styles.title}>
            {`${pipBrand.name} Support`}
          </Text>

          <Text accessibilityRole="header" style={styles.heading}>
            Getting started
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>
              • Confirm the app is updated to the latest available version.
            </Text>
            <Text style={styles.listItem}>
              • Confirm the toy, room, and storage spot still exist in Parent Mode.
            </Text>
            <Text style={styles.listItem}>
              • Restart the app if a local browser or simulator session appears stale.
            </Text>
          </View>

          <Text accessibilityRole="header" style={styles.heading}>
            Known V1 limits
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>
              • No account or cloud backup.
            </Text>
            <Text style={styles.listItem}>
              • No PIN recovery flow.
            </Text>
            <Text style={styles.listItem}>
              • Toy photos and data are stored on device.
            </Text>
            <Text style={styles.listItem}>
              • Deleting the app may delete local data.
            </Text>
          </View>

          <Text accessibilityRole="header" style={styles.heading}>
            Need help?
          </Text>
          <Text style={styles.body}>
            Contact support at{' '}
            <Text style={styles.email}>sarah.meister22@gmail.com</Text>
          </Text>

          <Text accessibilityRole="header" style={styles.heading}>
            Privacy & legal
          </Text>
          <Text style={styles.body}>
            For information about how {pipBrand.name} handles your data, see the{' '}
            <Text
              style={styles.link}
              onPress={() => router.push('/privacy')}
              accessibilityRole="link"
            >
              privacy notice
            </Text>
            .
          </Text>

          <Text style={styles.footer}>{`${pipBrand.name} — ${pipBrand.primaryTagline}`}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  backLabel: { color: theme.colors.brandInk, ...theme.typography.label },
  body: { color: theme.colors.secondaryText, ...theme.typography.body },
  column: {
    alignSelf: 'center',
    gap: theme.spacing[16],
    maxWidth: 720,
    width: '100%',
  },
  email: { color: theme.colors.brandInk, fontWeight: '600' },
  footer: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    color: theme.colors.mutedText,
    paddingTop: theme.spacing[16],
    ...theme.typography.supporting,
  },
  heading: { color: theme.colors.primaryText, marginTop: theme.spacing[8], ...theme.typography.sectionTitle },
  link: { color: theme.colors.brandInk, textDecorationLine: 'underline' },
  list: { gap: theme.spacing[8] },
  listItem: { color: theme.colors.secondaryText, ...theme.typography.body },
  page: {
    backgroundColor: theme.colors.backgroundCream,
    padding: theme.spacing[24],
    paddingBottom: theme.spacing[40],
    paddingTop: Platform.OS === 'web' ? theme.spacing[40] : theme.spacing[24],
  },
  scroll: { backgroundColor: theme.colors.backgroundCream, flex: 1 },
  safeArea: { backgroundColor: theme.colors.backgroundCream, flex: 1 },
  pressed: { opacity: 0.72 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
});
