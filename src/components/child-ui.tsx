import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export function ChildButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress(): void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

export function ToyImage({ uri }: { uri: string | null }) {
  return uri ? <Image accessibilityIgnoresInvertColors accessibilityLabel="Toy photo" source={{ uri }} style={styles.image} /> : <View accessibilityLabel="Toy photo unavailable" style={[styles.image, styles.imageFallback]}><Text style={styles.fallbackText}>Toy photo</Text></View>;
}

export function ToyCard({ toy, onPress }: { toy: ChildToy; onPress(): void }) {
  return <View style={styles.card}><ToyImage uri={toy.imageUri} /><Text style={styles.toyName}>{toy.name}</Text><Text style={styles.location}>{toy.roomName} → {toy.storageSpotName}</Text><ChildButton label="Play With This" onPress={onPress} /></View>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.lg, justifyContent: 'center', minHeight: 60, paddingHorizontal: 20, width: '100%' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '700' }, secondary: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary, borderWidth: 1 }, secondaryText: { color: theme.colors.primary }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.82 },
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: 10, padding: 12, width: '48%' }, image: { backgroundColor: theme.colors.photoFallback, borderRadius: theme.radii.md, height: 150, width: '100%' }, imageFallback: { alignItems: 'center', justifyContent: 'center' }, fallbackText: { color: theme.colors.mutedText, fontWeight: '700' }, toyName: { color: theme.colors.text, fontSize: 20, fontWeight: '700' }, location: { color: theme.colors.mutedText, fontSize: 15, minHeight: 40 },
});
