import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type LocationButtonProps = { label: string; onPress(): void; destructive?: boolean };
export function LocationButton({ label, onPress, destructive = false }: LocationButtonProps) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, destructive && styles.destructiveButton, pressed && styles.pressed]}><Text style={[styles.buttonText, destructive && styles.destructiveText]}>{label}</Text></Pressable>;
}

export function LocationError({ message, onRetry }: { message: string; onRetry(): void }) {
  return <View style={styles.errorBox}><Text accessibilityLiveRegion="polite" style={styles.errorText}>{message}</Text><LocationButton label="Retry" onPress={onRetry} /></View>;
}

export function LocationLoading() { return <View style={styles.center}><Text>Loading locations…</Text></View>; }

export function LocationEmpty({ onAddRoom }: { onAddRoom(): void }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>No rooms yet</Text><Text>Add your first room to start organizing where toys belong.</Text><LocationButton label="Add Room" onPress={onAddRoom} /></View>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.primary, borderRadius: theme.radii.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  buttonText: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
  destructiveButton: { borderColor: theme.colors.danger }, destructiveText: { color: theme.colors.danger }, pressed: { opacity: 0.75 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  empty: { alignItems: 'center', gap: 14, justifyContent: 'center', padding: 24 }, emptyTitle: { fontSize: 20, fontWeight: '700' },
  errorBox: { alignItems: 'center', gap: 12, padding: 24 }, errorText: { color: theme.colors.danger, textAlign: 'center' },
});
