import { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import type { Room } from '@/domain/models';
import type { LocationTreeItem } from '@/features/locations/location-service';
import type { ToyFormInput } from '@/features/toys/toy-service';
import type { ParentToy } from '@/repositories/toys-repository';
import { ToyButton, ToyImagePreview } from './toy-ui';
import { playmapTheme as theme, screenContentStyle } from '@/theme/playmap-theme';

const CATEGORY_LABELS: Record<PlayCategory, string> = {
  quiet: 'Quiet',
  active: 'Active',
  creative: 'Creative',
  building: 'Building',
  pretend: 'Pretend',
  sensory: 'Sensory',
  independent: 'Independent',
  together: 'Play Together',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
};

type ToyFormProps = {
  locations: LocationTreeItem[];
  toy?: ParentToy;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit(input: ToyFormInput): Promise<void>;
};

function roomLabel(room: Room): string {
  return room.name;
}

export function ToyForm({ locations, toy, saving, error, submitLabel, onSubmit }: ToyFormProps) {
  const [name, setName] = useState(toy?.name ?? '');
  const [sourceImageUri, setSourceImageUri] = useState<string | null>(null);
  const [existingImageUri, setExistingImageUri] = useState<string | null>(toy?.imageUri ?? null);
  const [roomId, setRoomId] = useState<number | null>(toy?.roomId ?? locations[0]?.id ?? null);
  const availableSpots = useMemo(() => locations.find((room) => room.id === roomId)?.storageSpots ?? [], [locations, roomId]);
  const [storageSpotId, setStorageSpotId] = useState<number | null>(toy?.storageSpotId ?? availableSpots[0]?.id ?? null);
  const [categories, setCategories] = useState<PlayCategory[]>(toy?.categories ?? []);
  const [cleanupDifficulty, setCleanupDifficulty] = useState<ToyFormInput['cleanupDifficulty']>(toy?.cleanupDifficulty ?? 'easy');
  const [adultHelpRequired, setAdultHelpRequired] = useState(toy?.adultHelpRequired ?? false);
  const [isAvailable, setIsAvailable] = useState(toy?.isAvailable ?? true);

  const selectedImageUri = sourceImageUri ?? existingImageUri;
  const effectiveStorageSpotId = availableSpots.some((spot) => spot.id === storageSpotId) ? storageSpotId : availableSpots[0]?.id ?? null;

  const chooseFromLibrary = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled) setSourceImageUri(result.assets[0]?.uri ?? null);
  };

  const takePhoto = async (): Promise<void> => {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled) setSourceImageUri(result.assets[0]?.uri ?? null);
  };

  const toggleCategory = (category: PlayCategory): void => {
    setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  };

  const submit = async (): Promise<void> => {
    await onSubmit({ name, sourceImageUri, existingImageUri, roomId, storageSpotId: effectiveStorageSpotId, categories, cleanupDifficulty, adultHelpRequired, isAvailable });
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      <View style={styles.section}>
        <Text style={styles.label}>Photo</Text>
        <ToyImagePreview uri={selectedImageUri} />
        <View style={styles.actions}>
          {Platform.OS !== 'web' && <ToyButton label="Take Photo" onPress={() => { void takePhoto(); }} />}
          <ToyButton label={Platform.OS === 'web' ? 'Select Image' : 'Choose Photo'} onPress={() => { void chooseFromLibrary(); }} />
          {selectedImageUri && <ToyButton label="Replace Photo" onPress={() => { setExistingImageUri(null); void chooseFromLibrary(); }} />}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Toy name</Text>
        <TextInput accessibilityLabel="Toy name" onChangeText={setName} placeholder="Magnetic Tiles" style={styles.input} value={name} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Room</Text>
        <View style={styles.optionRow}>
          {locations.map((room) => <Pressable key={room.id} accessibilityRole="button" onPress={() => { setRoomId(room.id); setStorageSpotId(room.storageSpots[0]?.id ?? null); }} style={[styles.option, room.id === roomId && styles.optionSelected]}><Text style={styles.optionText}>{roomLabel(room)}</Text></Pressable>)}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Storage spot</Text>
        <View style={styles.optionRow}>
          {availableSpots.map((spot) => <Pressable key={spot.id} accessibilityRole="button" onPress={() => setStorageSpotId(spot.id)} style={[styles.option, spot.id === effectiveStorageSpotId && styles.optionSelected]}><Text style={styles.optionText}>{spot.name}</Text></Pressable>)}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Categories</Text>
        <View style={styles.optionRow}>
          {PLAY_CATEGORIES.map((category) => <Pressable key={category} accessibilityRole="checkbox" accessibilityState={{ checked: categories.includes(category) }} onPress={() => toggleCategory(category)} style={[styles.option, categories.includes(category) && styles.optionSelected]}><Text style={styles.optionText}>{CATEGORY_LABELS[category]}</Text></Pressable>)}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Cleanup difficulty</Text>
        <View style={styles.optionRow}>
          {(['easy', 'medium', 'big'] as const).map((difficulty) => <Pressable key={difficulty} accessibilityRole="button" onPress={() => setCleanupDifficulty(difficulty)} style={[styles.option, cleanupDifficulty === difficulty && styles.optionSelected]}><Text style={styles.optionText}>{difficulty}</Text></Pressable>)}
        </View>
      </View>

      <View style={styles.switchRow}><Text style={styles.switchText}>Adult help required</Text><Switch value={adultHelpRequired} onValueChange={setAdultHelpRequired} /></View>
      <View style={styles.switchRow}><Text style={styles.switchText}>Available to child</Text><Switch value={isAvailable} onValueChange={setIsAvailable} /></View>
      <ToyButton disabled={saving} label={saving ? 'Saving…' : submitLabel} onPress={() => { void submit(); }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  content: { ...screenContentStyle, gap: 20 },
  error: { backgroundColor: theme.colors.errorSoft, borderRadius: theme.radii.md, color: theme.colors.danger, fontSize: 15, padding: 12 },
  input: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, borderWidth: 1, color: theme.colors.text, fontSize: 17, minHeight: theme.sizes.input, paddingHorizontal: 16 },
  label: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  option: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionSelected: { backgroundColor: theme.colors.mintSoft, borderColor: theme.colors.primary },
  optionText: { color: theme.colors.text, fontSize: 15, textTransform: 'capitalize' },
  section: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: 12, padding: 16 },
  switchRow: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 16 },
  switchText: { fontSize: 16, fontWeight: '600' },
});
