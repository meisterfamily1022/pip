import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { BackButton, Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { initializeDatabase } from '@/database/client';
import { createParentRoom, createParentStorageSpot, getParentRoom } from '@/features/locations/location-service';

function returnToLocations(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/parent/locations');
}

export default function AddLocationRoute() {
  const { type, roomId: roomIdParam } = useLocalSearchParams<{ type?: string; roomId?: string }>();
  const isStorage = type === 'storage';
  const roomId = roomIdParam ? Number(roomIdParam) : NaN;
  const invalidRoomId = isStorage && !Number.isInteger(roomId);
  const [name, setName] = useState('');
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(invalidRoomId ? 'The selected room is invalid.' : null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!isStorage) return;
    if (!Number.isInteger(roomId)) return;
    initializeDatabase().then((database) => getParentRoom(database, roomId)).then((room) => setRoomLabel(room.name)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load the room.'));
  }, [isStorage, roomId]);
  const save = (): void => {
    setSaving(true); setError(null);
    const operation = isStorage
      ? Number.isInteger(roomId) ? initializeDatabase().then((database) => createParentStorageSpot(database, roomId, name)) : Promise.reject(new Error('The selected room is invalid.'))
      : initializeDatabase().then((database) => createParentRoom(database, name));
    operation.then(returnToLocations).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not save location.')).finally(() => setSaving(false));
  };
  return <OnboardingScreen title={isStorage ? 'Add storage spot' : 'Add room'} description={isStorage ? `Add a storage spot inside ${roomLabel ?? 'the selected room'}.` : 'Create a room where toys can belong.'} footer={<PrimaryButton label={saving ? 'Saving…' : 'Save'} disabled={saving} onPress={save} />}><BackButton onPress={returnToLocations} /><Field label={isStorage ? 'Storage spot name' : 'Room name'} value={name} onChangeText={(value) => { setName(value); setError(null); }} placeholder={isStorage ? 'Blue Bin' : 'Playroom'} error={error} />{isStorage && roomLabel && <Field label="Room" value={roomLabel} onChangeText={() => {}} />}</OnboardingScreen>;
}
