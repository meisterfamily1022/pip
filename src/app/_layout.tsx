import { Redirect, Stack, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useSyncExternalStore } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { ErrorStateCard, PageShell, PrimaryButton } from '@/components/playmap-ui';
import { PipLaunchState } from '@/components/pip-brand-mark';
import { pipBrand } from '@/brand/pip-brand';
import { getRouteAccessSnapshot, initializeRouteAccess, subscribeRouteAccess } from '@/startup/route-access';

function PipWebHead() {
  return <Head><title>{pipBrand.name} — {pipBrand.primaryTagline}</title></Head>;
}

export default function RootLayout() {
  const segments = useSegments();
  const access = useSyncExternalStore(subscribeRouteAccess, getRouteAccessSnapshot, getRouteAccessSnapshot);

  useEffect(() => {
    void initializeRouteAccess();
  }, []);

  if (!access.initialized) return <><PipWebHead /><SafeAreaProvider initialMetrics={initialWindowMetrics}><PageShell scroll={false}><PipLaunchState /></PageShell></SafeAreaProvider></>;
  if (access.initializationError) return <><PipWebHead /><SafeAreaProvider initialMetrics={initialWindowMetrics}><PageShell scroll={false}><ErrorStateCard action={<PrimaryButton label="Try Again" onPress={() => { void initializeRouteAccess(); }} />} message={access.initializationError} /></PageShell></SafeAreaProvider></>;
  const group = segments[0];
  if (!access.onboardingComplete && (group === '(parent)' || group === '(child)')) return <><PipWebHead /><Redirect href="/onboarding" /></>;
  if (access.onboardingComplete && group === '(onboarding)') return <><PipWebHead /><Redirect href={access.childModeLocked ? '/child/home' : '/parent/home'} /></>;
  if (access.childModeLocked && group === '(parent)') return <><PipWebHead /><Redirect href="/child/parent-return" /></>;
  return <><PipWebHead /><SafeAreaProvider initialMetrics={initialWindowMetrics}><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider></>;
}
