import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ParentToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { DestructiveButton, ErrorStateCard, FilterChip, LoadingState, SecondaryButton, ToyImage } from './playmap-ui';

type ToyButtonProps = { label: string; onPress(): void; destructive?: boolean; disabled?: boolean; selected?: boolean };

export function ToyButton({ label, onPress, destructive = false, disabled = false, selected = false }: ToyButtonProps) {
  if (selected) return <FilterChip label={label} onPress={onPress} selected />;
  return destructive ? <DestructiveButton disabled={disabled} label={label} onPress={onPress} /> : <SecondaryButton disabled={disabled} label={label} onPress={onPress} />;
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
  return <LoadingState label="Loading toys…" />;
}

export function ToyError({ message, onRetry }: { message: string; onRetry(): void }) {
  return <ErrorStateCard action={<ToyButton label="Retry" onPress={onRetry} />} message={message} />;
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
