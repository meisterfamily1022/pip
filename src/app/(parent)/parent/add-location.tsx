import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ParentModeHeader } from '@/components/parent-ui';
import { FormCard, PageShell, PrimaryButton, ReadOnlyValue, RoundedTextInput } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { createParentRoom, createParentStorageSpot, getParentRoom } from '@/features/locations/location-service';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { validateRequiredName } from '@/features/onboarding/validation';

export default function AddLocationRoute() {
  const { type, roomId: roomIdParam } = useLocalSearchParams<{ type?: string; roomId?: string }>();
  const isStorage = type === 'storage';
  const roomId = roomIdParam ? Number(roomIdParam) : NaN;
  const invalidRoomId = isStorage && (!Number.isInteger(roomId) || roomId < 1);
  const [name, setName] = useState('');
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(invalidRoomId ? 'The selected room is invalid.' : null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isStorage || invalidRoomId) return;
    initializeDatabase().then((database) => getParentRoom(database, roomId)).then((room) => setRoomLabel(room.name)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load the room.'));
  }, [invalidRoomId, isStorage, roomId]);

  const save = async (): Promise<void> => {
    if (savingRef.current) return;
    const validationError = validateRequiredName(name, isStorage ? 'Storage spot name' : 'Room name');
    if (validationError) { setError(validationError); return; }
    if (isStorage && !roomLabel) { setError('Choose a valid room before adding a storage spot.'); return; }
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const database = await initializeDatabase();
      if (isStorage) await createParentStorageSpot(database, roomId, name);
      else await createParentRoom(database, name);
      router.replace('/parent/locations');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not save location.');
    } finally {
      savingRef.current = false; setSaving(false);
    }
  };

  return <PageShell>
    <ParentModeHeader backLabel="Rooms & Storage" backTo={parentBackTargets.addLocation} subtitle={isStorage ? `Add a storage spot inside ${roomLabel ?? 'the selected room'}.` : 'Create a room where toys can belong.'} title={isStorage ? 'Add Storage Spot' : 'Add Room'} />
    <FormCard tone="surface">
      <RoundedTextInput error={error} label={isStorage ? 'Storage spot name' : 'Room name'} onChangeText={(value) => { setName(value); setError(null); }} placeholder={isStorage ? 'Blue Bin' : 'Playroom'} value={name} />
      {isStorage && roomLabel && <ReadOnlyValue label="Room" value={roomLabel} />}
      <View style={styles.actions}><PrimaryButton disabled={saving || !name.trim() || invalidRoomId || (isStorage && !roomLabel)} label={saving ? 'Saving…' : isStorage ? 'Add Storage Spot' : 'Add Room'} onPress={() => { void save(); }} /></View>
    </FormCard>
  </PageShell>;
}

const styles = StyleSheet.create({
  actions: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap' },
});
