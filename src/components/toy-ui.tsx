import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ParentToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type ToyButtonProps = { label: string; onPress(): void; destructive?: boolean; disabled?: boolean };

export function ToyButton({ label, onPress, destructive = false, disabled = false }: ToyButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, destructive && styles.destructiveButton, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, destructive && styles.destructiveText]}>{label}</Text>
    </Pressable>
  );
}

export function ToyImagePreview({ uri }: { uri: string | null }) {
  return uri ? <Image source={{ uri }} style={styles.image} /> : <View style={[styles.image, styles.imageEmpty]}><Text style={styles.emptyImageText}>Photo required</Text></View>;
}

export function ToyGridCard({ toy, onPress }: { toy: ParentToy; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <ToyImagePreview uri={toy.imageUri} />
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardTitle}>{toy.name}</Text>
        <Text style={styles.cardLocation}>{toy.roomName} → {toy.storageSpotName}</Text>
        <View style={styles.badges}>
          {!toy.isAvailable && <Text style={styles.badge}>Hidden</Text>}
          {toy.isArchived && <Text style={styles.badge}>Archived</Text>}
        </View>
      </View>
    </Pressable>
  );
}

export function ToyLoading() {
  return <View style={styles.center}><Text>Loading toys…</Text></View>;
}

export function ToyError({ message, onRetry }: { message: string; onRetry(): void }) {
  return <View style={styles.center}><Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text><ToyButton label="Retry" onPress={onRetry} /></View>;
}

const styles = StyleSheet.create({
  badge: { backgroundColor: theme.colors.surfaceWarm, borderRadius: theme.radii.sm, color: '#5A4420', fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { alignItems: 'center', borderColor: theme.colors.primary, borderRadius: theme.radii.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  buttonText: { color: theme.colors.primary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, borderWidth: 1, flexBasis: '48%', minWidth: 150, overflow: 'hidden' },
  cardBody: { gap: 6, padding: 10 },
  cardLocation: { color: theme.colors.mutedText, fontSize: 13, lineHeight: 18 },
  cardTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  center: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  destructiveButton: { borderColor: theme.colors.danger },
  destructiveText: { color: theme.colors.danger },
  disabled: { opacity: 0.45 },
  emptyImageText: { color: theme.colors.mutedText, fontWeight: '700' },
  error: { color: theme.colors.danger, textAlign: 'center' },
  image: { aspectRatio: 1.15, backgroundColor: theme.colors.photoFallback, width: '100%' },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
