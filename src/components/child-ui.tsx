import { StyleSheet, Text, View } from 'react-native';
import type { ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { PrimaryButton, SecondaryButton, ToyImage as SharedToyImage } from './playmap-ui';

export function ChildButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress(): void; secondary?: boolean; disabled?: boolean }) {
  return secondary ? <SecondaryButton disabled={disabled} label={label} onPress={onPress} /> : <PrimaryButton disabled={disabled} label={label} onPress={onPress} style={styles.childButton} />;
}

export function ToyImage({ uri }: { uri: string | null }) {
  return <SharedToyImage accessibilityLabel="Toy photo" uri={uri} />;
}

export function ToyCard({ toy, onPress }: { toy: ChildToy; onPress(): void }) {
  return <View style={styles.card}><ToyImage uri={toy.imageUri} /><Text style={styles.toyName}>{toy.name}</Text><Text style={styles.location}>{toy.roomName} → {toy.storageSpotName}</Text><ChildButton label="Play With This" onPress={onPress} /></View>;
}

const styles = StyleSheet.create({
  childButton: { minHeight: theme.sizes.childButton, width: '100%' },
  card: { ...theme.shadows.card, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, flex: 1, gap: 12, minWidth: 250, padding: 14 }, image: { aspectRatio: theme.images.hero, backgroundColor: theme.colors.photoFallback, borderRadius: theme.radii.md, width: '100%' }, imageFallback: { alignItems: 'center', justifyContent: 'center' }, fallbackText: { color: theme.colors.mutedText, fontWeight: '700' }, toyName: { color: theme.colors.text, fontSize: 22, fontWeight: '700' }, location: { color: theme.colors.mutedText, fontSize: 15, minHeight: 40 },
});
