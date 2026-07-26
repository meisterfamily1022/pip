import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChildToy } from '@/repositories/toys-repository';

export function ChildButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress(): void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

export function ToyImage({ uri }: { uri: string | null }) {
  return uri ? <Image accessibilityIgnoresInvertColors accessibilityLabel="Toy photo" source={{ uri }} style={styles.image} /> : <View accessibilityLabel="Toy photo unavailable" style={[styles.image, styles.imageFallback]}><Text style={styles.fallbackText}>Toy photo</Text></View>;
}

export function ToyCard({ toy, onPress }: { toy: ChildToy; onPress(): void }) {
  return <View style={styles.card}><ToyImage uri={toy.imageUri} /><Text style={styles.toyName}>{toy.name}</Text><Text style={styles.location}>{toy.roomName} → {toy.storageSpotName}</Text><ChildButton label="Play With This" onPress={onPress} /></View>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: '#2166D1', borderRadius: 14, justifyContent: 'center', minHeight: 58, paddingHorizontal: 20, width: '100%' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '700' }, secondary: { backgroundColor: '#EAF1FF', borderColor: '#2166D1', borderWidth: 1 }, secondaryText: { color: '#2166D1' }, disabled: { opacity: 0.45 },
  card: { backgroundColor: '#F5F7FC', borderRadius: 18, gap: 10, padding: 14, width: '48%' }, image: { backgroundColor: '#E4E8F1', borderRadius: 14, height: 150, width: '100%' }, imageFallback: { alignItems: 'center', justifyContent: 'center' }, fallbackText: { color: '#5C6270' }, toyName: { color: '#1A1A1F', fontSize: 20, fontWeight: '700' }, location: { color: '#4B4B55', fontSize: 15, minHeight: 40 },
});
