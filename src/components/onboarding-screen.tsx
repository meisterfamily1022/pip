import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type OnboardingScreenProps = PropsWithChildren<{ step?: string; title: string; description?: string; footer?: ReactNode }>;

export function OnboardingScreen({ step, title, description, children, footer }: OnboardingScreenProps) {
  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step && <Text style={styles.step}>{step}</Text>}
          {step && <View accessibilityLabel={`${step} progress`} style={styles.progress}><View style={[styles.progressFill, { width: step.startsWith('Step 1') ? '33%' : step.startsWith('Step 2') ? '66%' : '100%' }]} /></View>}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
          <View style={styles.body}>{children}</View>
        </ScrollView>
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  keyboardAvoidingView: { flex: 1 },
  content: { alignSelf: 'center', flexGrow: 1, maxWidth: 680, padding: 24, paddingTop: 44, width: '100%' },
  step: { color: theme.colors.mutedText, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  progress: { backgroundColor: theme.colors.surfacePeach, borderRadius: theme.radii.pill, height: 6, marginBottom: 24, overflow: 'hidden', width: '100%' }, progressFill: { backgroundColor: theme.colors.coral, borderRadius: theme.radii.pill, height: '100%' },
  title: { color: theme.colors.text, fontFamily: 'Georgia', fontSize: theme.type.title, fontWeight: '700', lineHeight: 40 },
  description: { color: theme.colors.mutedText, fontSize: 17, lineHeight: 25, marginTop: 14 },
  body: { flex: 1, gap: 16, marginTop: 32 },
  footer: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border, borderTopWidth: 1, padding: 16 },
});
