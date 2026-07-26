import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type OnboardingScreenProps = PropsWithChildren<{ step?: string; title: string; description?: string; footer?: ReactNode }>;

export function OnboardingScreen({ step, title, description, children, footer }: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step && <Text style={styles.step}>{step}</Text>}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
          <View style={styles.body}>{children}</View>
        </ScrollView>
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  keyboardAvoidingView: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 36 },
  step: { color: theme.colors.mutedText, fontSize: 14, fontWeight: '600', marginBottom: 16 },
  title: { color: theme.colors.text, fontSize: theme.type.title, fontWeight: '700', lineHeight: 38 },
  description: { color: theme.colors.mutedText, fontSize: 17, lineHeight: 25, marginTop: 14 },
  body: { flex: 1, gap: 16, marginTop: 32 },
  footer: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border, borderTopWidth: 1, padding: 16 },
});
