import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { PrimaryButton, SecondaryButton, ToyImage as SharedToyImage } from './playmap-ui';

export function ChildButton({ label, onPress, secondary = false, disabled = false, tint }: { label: string; onPress(): void; secondary?: boolean; disabled?: boolean; tint?: string }) {
  return secondary ? <SecondaryButton disabled={disabled} label={label} onPress={onPress} style={tint ? { backgroundColor: tint, borderColor: tint } : undefined} /> : <PrimaryButton disabled={disabled} label={label} onPress={onPress} style={[styles.childButton, tint ? { backgroundColor: tint } : undefined]} />;
}

export function ToyImage({ uri }: { uri: string | null }) {
  return <SharedToyImage accessibilityLabel="Toy photo" uri={uri} />;
}

export function ChildPage({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return <View style={[styles.page, centered && styles.centered]}>{children}</View>;
}

export function LocationPanel({ room, spot }: { room: string; spot: string }) {
  return <View accessibilityLabel={`Stored in ${room}, ${spot}`} style={styles.locationPanel}><Text style={styles.locationKicker}>WHERE TO FIND IT</Text><Text style={styles.locationValue}>{room} <Text style={styles.locationArrow}>→</Text> {spot}</Text></View>;
}

export function ChildLink({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.link}><Text style={styles.linkText}>{label}</Text></Pressable>;
}

export function ToyCard({ toy, onPress }: { toy: ChildToy; onPress(): void }) {
  return <View style={styles.card}><ToyImage uri={toy.imageUri} /><Text style={styles.toyName}>{toy.name}</Text><Text style={styles.location}>{toy.roomName} → {toy.storageSpotName}</Text><ChildButton label="Play With This" onPress={onPress} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.childBackground, gap: 18, padding: theme.spacing[20], paddingTop: theme.spacing[24] },
  centered: { alignItems: 'center', justifyContent: 'center' },
  childButton: { minHeight: theme.sizes.childButton, width: '100%' },
  card: { ...theme.shadows.card, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, flex: 1, gap: 12, minWidth: 250, padding: 14 }, toyName: { color: theme.colors.text, fontSize: 22, fontWeight: '700' }, location: { color: theme.colors.mutedText, fontSize: 15, minHeight: 40 },
  locationPanel: { backgroundColor: theme.colors.surfaceSage, borderRadius: theme.radii.large, gap: 6, padding: 18, width: '100%' }, locationKicker: { color: theme.colors.sageAction, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }, locationValue: { color: theme.colors.primaryText, fontSize: 20, fontWeight: '700' }, locationArrow: { color: theme.colors.coralAction }, link: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 12 }, linkText: { color: theme.colors.secondaryText, fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
});
