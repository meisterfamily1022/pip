import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pipBrand } from '@/brand/pip-brand';
import { landingPrivacy } from '@/features/landing/landing-copy';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The public privacy notice.
 *
 * The landing page footer links here, so this must exist rather than 404 — the
 * brief requires privacy links to resolve to a real page. This describes the
 * behavior implemented by the current build in plain language.
 *
 * Every statement here is the same one the landing page makes, drawn from the
 * same module, so the two cannot drift apart.
 */
export default function PrivacyRoute() {
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
              <Text style={styles.backLabel}>‹ Back to Settings</Text>
            </Pressable>
          )}
          <Text accessibilityRole="header" style={styles.title}>
            {`${pipBrand.name} privacy notice`}
          </Text>

        <Text accessibilityRole="header" style={styles.heading}>
          What Pip does
        </Text>
        <View style={styles.list}>
          {landingPrivacy.points.map((point) => (
            <Text key={point} style={styles.listItem}>
              {`• ${point}`}
            </Text>
          ))}
        </View>
        <Text style={styles.body}>{landingPrivacy.note}</Text>

        <Text accessibilityRole="header" style={styles.heading}>
          What is stored, and where
        </Text>
        <Text style={styles.body}>
          Toys, photos, rooms, storage spots, child profiles, and play history are stored on your device. They are not
          uploaded, because Pip has no backup or syncing yet.
        </Text>
        <Text style={styles.body}>
          If you create an optional account, it holds your email address and nothing that identifies a child. An
          account exists so that backup, recovery, and sharing between your own devices are possible later. Pip works
          fully without one.
        </Text>

        <Text accessibilityRole="header" style={styles.heading}>Optional product analytics</Text>
        <Text style={styles.body}>A signed-in parent may choose to share privacy-minimized analytics for product improvement. The choice starts off and can be changed at any time. Guest, sample, and local-only use sends no cloud telemetry.</Text>
        <Text style={styles.body}>If enabled, Pip may collect app version and platform, coarse country and state/province selected by the parent, optional household-size and broad age bands, feature counts in bands, onboarding and session milestones, cleanup outcomes, and categorized errors. Analytics event payloads do not include toy or child names, photos, typed searches, free text, precise location, IP addresses, birthdays, diagnoses, schools, or therapy information.</Text>
        <Text style={styles.body}>Pip does not sell analytics, use it for advertising, or treat a child as an analytics identity. Raw events are retained for up to 13 months. A parent can stop new collection immediately or delete telemetry and reporting-only profile data without deleting the account or on-device family data.</Text>

        <Text accessibilityRole="header" style={styles.heading}>
          What Pip never asks for
        </Text>
        <Text style={styles.body}>
          A child&apos;s legal name, birthday, school, therapy details, or any diagnosis. Children do not sign in and do
          not have accounts or passwords.
        </Text>

        <Text accessibilityRole="header" style={styles.heading}>
          Your controls
        </Text>
        <Text style={styles.body}>
          You can export the structured family data stored by Pip as a readable file, delete a child profile without losing any toys, clear this device entirely, or sign out of an optional account. Exported photo entries refer to files on this device; the photos themselves are not included in the export. Pip does not currently provide in-app account deletion.
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
  footer: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    color: theme.colors.mutedText,
    paddingTop: theme.spacing[16],
    ...theme.typography.supporting,
  },
  heading: { color: theme.colors.primaryText, marginTop: theme.spacing[8], ...theme.typography.sectionTitle },
  list: { gap: theme.spacing[8] },
  listItem: { color: theme.colors.secondaryText, ...theme.typography.body },
  page: {
    backgroundColor: theme.colors.backgroundCream,
    padding: theme.spacing[24],
    paddingBottom: theme.spacing[40],
    // Room for the browser chrome on web; harmless elsewhere.
    paddingTop: Platform.OS === 'web' ? theme.spacing[40] : theme.spacing[24],
  },
  scroll: { backgroundColor: theme.colors.backgroundCream, flex: 1 },
  safeArea: { backgroundColor: theme.colors.backgroundCream, flex: 1 },
  pressed: { opacity: 0.72 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
});
