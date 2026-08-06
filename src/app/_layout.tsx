import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { ErrorStateCard, LoadingState, PageShell, PrimaryButton } from '@/components/playmap-ui';
import { getRouteAccessSnapshot, initializeRouteAccess, subscribeRouteAccess } from '@/startup/route-access';

export default function RootLayout() {
  const segments = useSegments();
  const access = useSyncExternalStore(subscribeRouteAccess, getRouteAccessSnapshot, getRouteAccessSnapshot);

  useEffect(() => {
    void initializeRouteAccess();
  }, []);

  if (!access.initialized) return <SafeAreaProvider initialMetrics={initialWindowMetrics}><PageShell scroll={false}><LoadingState label="Starting PlayMap…" /></PageShell></SafeAreaProvider>;
  if (access.initializationError) return <SafeAreaProvider initialMetrics={initialWindowMetrics}><PageShell scroll={false}><ErrorStateCard action={<PrimaryButton label="Try Again" onPress={() => { void initializeRouteAccess(); }} />} message={access.initializationError} /></PageShell></SafeAreaProvider>;
  const group = segments[0];
  if (!access.onboardingComplete && (group === '(parent)' || group === '(child)')) return <Redirect href="/onboarding" />;
  if (access.onboardingComplete && group === '(onboarding)') return <Redirect href={access.childModeLocked ? '/child/home' : '/parent/home'} />;
  if (access.childModeLocked && group === '(parent)') return <Redirect href="/child/parent-return" />;
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>;
}
