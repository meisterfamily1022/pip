import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { PipBrandMark } from '@/components/pip-brand-mark';
import { ConsentCheckbox, NoticeBanner } from '@/components/auth-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import {
  availableFeatures,
  earlyAccessForm,
  landingFamilies,
  landingFinalCta,
  landingHero,
  landingNav,
  landingPrivacy,
  landingProblem,
  landingSteps,
} from './landing-copy';

/**
 * The public marketing page.
 *
 * Renders without the local database so a visitor, or a crawler, never waits on
 * SQLite. Every claim on this page comes from `landing-copy`, where feature
 * availability is flagged, so the page cannot advertise something the app does
 * not do yet.
 */

type SubmitState = 'idle' | 'submitting' | 'done';

function useColumns(): number {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 3;
  if (width >= 680) return 2;
  return 1;
}

function SectionHeading({ children, id }: { children: string; id?: string }) {
  return (
    <Text accessibilityRole="header" nativeID={id} style={styles.sectionHeading}>
      {children}
    </Text>
  );
}

function EarlyAccessForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setState('submitting');
    setError(null);
    try {
      const response = await fetch('/v1/early-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // `company` is the honeypot: a real person never fills it in.
        body: JSON.stringify({ email, acceptedUpdates: consent, company }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        const message = (body as { error?: { message?: string } }).error?.message;
        setError(message ?? 'Something went wrong. Try again shortly.');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <View style={styles.formCard}>
        <NoticeBanner message={earlyAccessForm.successBody} title={earlyAccessForm.successHeading} tone="success" />
      </View>
    );
  }

  return (
    <View style={styles.formCard}>
      <SectionHeading>{earlyAccessForm.heading}</SectionHeading>
      <Text style={styles.body}>{earlyAccessForm.body}</Text>

      {error ? <NoticeBanner message={error} tone="error" /> : null}

      <View style={styles.field}>
        <Text nativeID="early-access-email-label" style={styles.label}>
          {earlyAccessForm.emailLabel}
        </Text>
        <TextInput
          accessibilityLabel={earlyAccessForm.emailLabel}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.mutedText}
          style={styles.input}
          value={email}
        />
      </View>

      {/*
        Honeypot. Hidden from sight and from assistive technology, so only an
        automated submitter fills it in.
      */}
      <TextInput
        accessibilityElementsHidden
        aria-hidden
        autoComplete="off"
        importantForAccessibility="no-hide-descendants"
        onChangeText={setCompany}
        style={styles.honeypot}
        tabIndex={-1}
        value={company}
      />

      <ConsentCheckbox label={earlyAccessForm.consentLabel} onValueChange={setConsent} value={consent} />

      <Pressable
        accessibilityLabel={earlyAccessForm.submitLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: state === 'submitting' }}
        disabled={state === 'submitting'}
        onPress={() => {
          void submit();
        }}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, state === 'submitting' && styles.disabled]}
      >
        <Text style={styles.primaryButtonText}>
          {state === 'submitting' ? 'Joining…' : earlyAccessForm.submitLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export function LandingPage() {
  const columns = useColumns();

  return (
    <ScrollView contentContainerStyle={styles.page} style={styles.scroll}>
      <View style={styles.column}>
        <View accessibilityRole="header" style={styles.nav}>
          <PipBrandMark style={styles.navLogo} variant="wordmark" />
          <View style={styles.navLinks}>
            {landingNav.links.map((link) => (
              <Text key={link.id} style={styles.navLink}>
                {link.label}
              </Text>
            ))}
            <Pressable
              accessibilityLabel={landingNav.signIn.label}
              accessibilityRole="link"
              onPress={() => {
                void Linking.openURL(landingNav.signIn.href);
              }}
            >
              <Text style={styles.navSignIn}>{landingNav.signIn.label}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.heroHeadline}>
            {landingHero.headline}
          </Text>
          <Text style={styles.heroBody}>{landingHero.body}</Text>
        </View>

        <EarlyAccessForm />

        <View style={styles.section}>
          <SectionHeading id="how">{landingProblem.heading}</SectionHeading>
          <View style={[styles.grid, columns === 1 && styles.gridSingle]}>
            {landingProblem.points.map((point) => (
              <View key={point.title} style={[styles.card, { width: columns === 1 ? '100%' : `${100 / Math.min(columns, 2) - 2}%` }]}>
                <Text style={styles.cardTitle}>{point.title}</Text>
                <Text style={styles.body}>{point.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading>{landingSteps.heading}</SectionHeading>
          <View style={styles.steps}>
            {landingSteps.steps.map((step, index) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.cardTitle}>{step.title}</Text>
                  <Text style={styles.body}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading id="families">{landingFamilies.heading}</SectionHeading>
          <Text style={styles.body}>{landingFamilies.body}</Text>
          <View style={styles.list}>
            {landingFamilies.points.map((point) => (
              <Text key={point} style={styles.listItem}>
                {`• ${point}`}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading>What Pip does today</SectionHeading>
          <View style={[styles.grid, columns === 1 && styles.gridSingle]}>
            {availableFeatures().map((feature) => (
              <View
                key={feature.id}
                style={[styles.featureCard, { width: columns === 1 ? '100%' : `${100 / columns - 2}%` }]}
              >
                <Text style={styles.cardTitle}>{feature.title}</Text>
                <Text style={styles.body}>{feature.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.privacySection]}>
          <SectionHeading id="privacy">{landingPrivacy.heading}</SectionHeading>
          <View style={styles.list}>
            {landingPrivacy.points.map((point) => (
              <Text key={point} style={styles.listItem}>
                {`• ${point}`}
              </Text>
            ))}
          </View>
          <Text style={styles.note}>{landingPrivacy.note}</Text>
        </View>

        <View style={styles.section}>
          <SectionHeading>{landingFinalCta.heading}</SectionHeading>
          <Text style={styles.body}>{landingFinalCta.body}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{`${pipBrand.name} — ${pipBrand.primaryTagline}`}</Text>
          <Pressable
            accessibilityLabel="Read the privacy notice"
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL('/privacy');
            }}
          >
            <Text style={styles.footerLink}>Privacy notice</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { color: theme.colors.secondaryText, ...theme.typography.body },
  card: {
    backgroundColor: theme.colors.surfaceSage,
    borderRadius: theme.radii.large,
    gap: theme.spacing[8],
    padding: theme.spacing[20],
  },
  cardTitle: { color: theme.colors.primaryText, ...theme.typography.label },
  column: { alignSelf: 'center', gap: theme.spacing[40], maxWidth: 960, width: '100%' },
  disabled: { opacity: 0.6 },
  featureCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.large,
    borderWidth: 1,
    gap: theme.spacing[8],
    padding: theme.spacing[20],
  },
  field: { gap: theme.spacing[8] },
  footer: {
    alignItems: 'center',
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    gap: theme.spacing[8],
    paddingTop: theme.spacing[24],
  },
  footerLink: { color: theme.colors.brandInk, textDecorationLine: 'underline', ...theme.typography.supporting },
  footerText: { color: theme.colors.mutedText, ...theme.typography.supporting },
  formCard: {
    backgroundColor: theme.colors.surfaceMint,
    borderRadius: theme.radii.card,
    gap: theme.spacing[16],
    padding: theme.spacing[24],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[16] },
  gridSingle: { flexDirection: 'column' },
  hero: { gap: theme.spacing[16] },
  heroBody: { color: theme.colors.secondaryText, ...theme.typography.body, fontSize: 19, lineHeight: 28 },
  heroHeadline: { color: theme.colors.primaryText, ...theme.typography.display },
  honeypot: { height: 0, opacity: 0, position: 'absolute', width: 0 },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.medium,
    borderWidth: 1,
    color: theme.colors.primaryText,
    minHeight: theme.measurements.inputHeight,
    paddingHorizontal: theme.spacing[16],
    ...theme.typography.body,
  },
  label: { color: theme.colors.primaryText, ...theme.typography.label },
  list: { gap: theme.spacing[8] },
  listItem: { color: theme.colors.secondaryText, ...theme.typography.body },
  nav: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[16], justifyContent: 'space-between' },
  navLink: { color: theme.colors.brandInk, ...theme.typography.label },
  navLinks: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[16] },
  navSignIn: { color: theme.colors.brandInk, textDecorationLine: 'underline', ...theme.typography.label },
  navLogo: { width: 96 },
  note: { color: theme.colors.mutedText, ...theme.typography.supporting },
  page: { backgroundColor: theme.colors.backgroundCream, padding: theme.spacing[24], paddingBottom: theme.spacing[40] },
  pressed: { opacity: 0.85 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radii.medium,
    justifyContent: 'center',
    minHeight: theme.measurements.primaryButtonHeight,
    paddingHorizontal: theme.spacing[24],
  },
  primaryButtonText: { color: theme.colors.white, ...theme.typography.button },
  privacySection: {
    backgroundColor: theme.colors.surfaceLavender,
    borderRadius: theme.radii.card,
    padding: theme.spacing[24],
  },
  scroll: { backgroundColor: theme.colors.backgroundCream, flex: 1 },
  section: { gap: theme.spacing[16] },
  sectionHeading: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
  step: { flexDirection: 'row', gap: theme.spacing[16] },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceYellow,
    borderRadius: theme.radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepNumberText: { color: theme.colors.warning, ...theme.typography.label },
  stepText: { flex: 1, gap: theme.spacing[4] },
  steps: { gap: theme.spacing[20] },
});
