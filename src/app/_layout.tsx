import { useFonts } from 'expo-font';
import { router, Stack, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { ErrorStateCard, PageShell, PrimaryButton } from '@/components/playmap-ui';
import { PipLaunchState } from '@/components/pip-brand-mark';
import { pipBrand } from '@/brand/pip-brand';
import { pipFontAssets } from '@/theme/fonts';
import { createSessionRestorer } from '@/features/auth/auth-client';
import { getSessionSnapshot, restoreSession, subscribeSession } from '@/features/auth/session-state';
import {
  getPendingVerificationSnapshot,
  restorePendingVerification,
  subscribePendingVerification,
} from '@/features/auth/sign-up-form';
import { getOnboardingDestination, getRouteAccessSnapshot, initializeRouteAccess, subscribeRouteAccess } from '@/startup/route-access';
import { isPublicGroup, resolveRouteGuard, type RouteGroup } from '@/startup/route-guards';

/**
 * The document title, on web only.
 *
 * `expo-router/head` sets the page title in a browser, but on native the same
 * component drives Handoff, which requires an `origin` in the Expo config and
 * throws `Add the handoff origin to the Expo Config` when there isn't one. That
 * threw during the root layout's first render, so the app died on launch before
 * any screen appeared. A page title is a web concern; native never renders it.
 */
function PipWebHead() {
  if (Platform.OS !== 'web') return null;
  return (
    <Head>
      <title>
        {pipBrand.name} — {pipBrand.primaryTagline}
      </title>
    </Head>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PipWebHead />
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>{children}</SafeAreaProvider>
    </>
  );
}

export default function RootLayout() {
  const segments = useSegments();
  // Montserrat carries every label in the app, so the first frame waits for it
  // rather than painting in the system face and reflowing a moment later. A
  // font that fails to load is not fatal: `error` releases the gate and the
  // platform face stands in.
  const [fontsLoaded, fontError] = useFonts(pipFontAssets);
  const access = useSyncExternalStore(subscribeRouteAccess, getRouteAccessSnapshot, getRouteAccessSnapshot);
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  const pendingVerification = useSyncExternalStore(
    subscribePendingVerification,
    getPendingVerificationSnapshot,
    getPendingVerificationSnapshot,
  );
  const lastRedirect = useRef<string | null>(null);
  const group = segments[0] as RouteGroup;
  // On web the root path is the public landing page; on native it is app
  // startup, which must wait for the local database.
  const isPublic = isPublicGroup(group) || (Platform.OS === 'web' && group === undefined);

  useEffect(() => {
    // A stored session is restored once per launch; failure degrades to
    // signed out, which is a fully usable local-only state.
    void restoreSession(createSessionRestorer());
  }, []);

  // Public pages render without local startup, so the marketing surface never
  // waits on SQLite. Every other surface needs the database open first.
  useEffect(() => {
    if (!isPublic) {
      void initializeRouteAccess();
      void restorePendingVerification();
    }
  }, [isPublic]);

  const decision = resolveRouteGuard({
    group,
    isPublic,
    initialized: access.initialized,
    initializationError: access.initializationError,
    onboardingComplete: access.onboardingComplete,
    onboardingDestination: getOnboardingDestination(session.status === 'signedIn'),
    childModeLocked: access.childModeLocked,
    sessionStatus: session.status,
    pendingVerificationStatus: pendingVerification.status === 'restoring'
      ? 'restoring'
      : pendingVerification.email
        ? 'pending'
        : 'none',
  });
  const redirectHref = decision.kind === 'redirect' ? decision.href : null;

  useEffect(() => {
    if (!redirectHref) {
      lastRedirect.current = null;
      return;
    }
    const redirectKey = `${String(group)}:${redirectHref}`;
    if (lastRedirect.current === redirectKey) return;
    lastRedirect.current = redirectKey;
    router.replace(redirectHref);
  }, [group, redirectHref]);

  if (!fontsLoaded && !fontError) {
    return (
      <Frame>
        <PageShell scroll={false}>
          <PipLaunchState />
        </PageShell>
      </Frame>
    );
  }

  if (decision.kind === 'launching') {
    return (
      <Frame>
        <PageShell scroll={false}>
          <PipLaunchState />
        </PageShell>
      </Frame>
    );
  }

  if (decision.kind === 'error') {
    return (
      <Frame>
        <PageShell scroll={false}>
          <ErrorStateCard
            action={
              <PrimaryButton
                label="Try Again"
                onPress={() => {
                  void initializeRouteAccess();
                }}
              />
            }
            message={decision.message}
          />
        </PageShell>
      </Frame>
    );
  }

  return (
    <Frame>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </Frame>
  );
}
