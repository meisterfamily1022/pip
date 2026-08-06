import { Redirect, Stack, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useSyncExternalStore } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { ErrorStateCard, PageShell, PrimaryButton } from '@/components/playmap-ui';
import { PipLaunchState } from '@/components/pip-brand-mark';
import { pipBrand } from '@/brand/pip-brand';
import { getSessionSnapshot, restoreSession, subscribeSession } from '@/features/auth/session-state';
import { getRouteAccessSnapshot, initializeRouteAccess, subscribeRouteAccess } from '@/startup/route-access';
import { isPublicGroup, resolveRouteGuard, type RouteGroup } from '@/startup/route-guards';

function PipWebHead() {
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
  const access = useSyncExternalStore(subscribeRouteAccess, getRouteAccessSnapshot, getRouteAccessSnapshot);
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  const group = segments[0] as RouteGroup;

  useEffect(() => {
    void restoreSession();
  }, []);

  // Public pages render without local startup, so the marketing surface never
  // waits on SQLite. Every other surface needs the database open first.
  useEffect(() => {
    if (!isPublicGroup(group)) void initializeRouteAccess();
  }, [group]);

  const decision = resolveRouteGuard({
    group,
    initialized: access.initialized,
    initializationError: access.initializationError,
    onboardingComplete: access.onboardingComplete,
    childModeLocked: access.childModeLocked,
    sessionStatus: session.status,
  });

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

  if (decision.kind === 'redirect') {
    return (
      <>
        <PipWebHead />
        <Redirect href={decision.href} />
      </>
    );
  }

  return (
    <Frame>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </Frame>
  );
}
