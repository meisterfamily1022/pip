import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ParentToy } from '@/repositories/toys-repository';

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
  badge: { backgroundColor: '#EFE7D3', borderRadius: 6, color: '#5A4420', fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { alignItems: 'center', borderColor: '#2166D1', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  buttonText: { color: '#2166D1', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#D9DDE7', borderRadius: 8, borderWidth: 1, flexBasis: '48%', minWidth: 150, overflow: 'hidden' },
  cardBody: { gap: 6, padding: 10 },
  cardLocation: { color: '#575B66', fontSize: 13, lineHeight: 18 },
  cardTitle: { color: '#1A1A1F', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  center: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  destructiveButton: { borderColor: '#C62828' },
  destructiveText: { color: '#C62828' },
  disabled: { opacity: 0.45 },
  emptyImageText: { color: '#6B6F7A', fontWeight: '700' },
  error: { color: '#C62828', textAlign: 'center' },
  image: { aspectRatio: 1.15, backgroundColor: '#EEF1F6', width: '100%' },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
