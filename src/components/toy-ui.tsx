import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ParentToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { DestructiveButton, ErrorStateCard, FilterChip, LoadingState, PageShell, SecondaryButton, ToyImage } from './playmap-ui';

type ToyButtonProps = { label: string; onPress(): void; destructive?: boolean; disabled?: boolean; selected?: boolean; accessibilityLabel?: string };

export function ToyButton({ label, onPress, destructive = false, disabled = false, selected = false, accessibilityLabel }: ToyButtonProps) {
  if (selected) return <FilterChip label={label} onPress={onPress} selected />;
  return destructive ? <DestructiveButton accessibilityLabel={accessibilityLabel} disabled={disabled} label={label} onPress={onPress} /> : <SecondaryButton accessibilityLabel={accessibilityLabel} disabled={disabled} label={label} onPress={onPress} />;
}

export function ToyImagePreview({ uri }: { uri: string | null }) {
  return <ToyImage accessibilityLabel="Toy photo" uri={uri} />;
}

export function ToyGridCard({ toy, onPress }: { toy: ParentToy; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <ToyImagePreview uri={toy.imageUri} />
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardTitle}>{toy.name}</Text>
        <Text numberOfLines={2} style={styles.cardLocation}>{toy.roomName} → {toy.storageSpotName}</Text>
        <View style={styles.badges}>
          {!toy.isAvailable && <Text style={styles.badge}>Hidden</Text>}
          {toy.isArchived && <Text style={styles.badge}>Archived</Text>}
        </View>
      </View>
    </Pressable>
  );
}

export function ToyLoading() {
  return <PageShell scroll={false}><LoadingState label="Loading toys…" /></PageShell>;
}

export function ToyError({ message, onRetry, actionLabel = 'Retry' }: { message: string; onRetry(): void; actionLabel?: string }) {
  return <PageShell><ErrorStateCard action={<ToyButton label={actionLabel} onPress={onRetry} />} message={message} /></PageShell>;
}

const styles = StyleSheet.create({
  badge: { backgroundColor: theme.colors.mintSoft, borderRadius: theme.radii.pill, color: theme.colors.success, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { ...theme.shadows.card, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, flex: 1, minWidth: 150, overflow: 'hidden' },
  cardBody: { gap: 7, minHeight: 112, padding: 12 },
  cardLocation: { color: theme.colors.mutedText, fontSize: 13, lineHeight: 18 },
  cardTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  pressed: { opacity: 0.75 },
});
