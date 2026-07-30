import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { LocationFormScreen } from '@/components/location-ui';
import { initializeDatabase } from '@/database/client';
import { createParentRoom, createParentStorageSpot, getParentRoom } from '@/features/locations/location-service';

/**
 * Creates a room, or — with `?type=storage&roomId=` — a storage spot inside one.
 * Adding keeps you on this screen with a confirmation so several rooms or spots
 * can be added in a row; Rooms & Storage reloads when you navigate back to it.
 */
export default function AddLocationRoute() {
  const { type, roomId: roomIdParam } = useLocalSearchParams<{ type?: string; roomId?: string }>();
  const isStorage = type === 'storage';
  const roomId = roomIdParam ? Number(roomIdParam) : NaN;
  const invalidRoomId = isStorage && !Number.isInteger(roomId);
  const [name, setName] = useState('');
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(invalidRoomId ? 'The selected room is invalid.' : null);
  const [added, setAdded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isStorage) return;
    if (!Number.isInteger(roomId)) return;
    initializeDatabase()
      .then((database) => getParentRoom(database, roomId))
      .then((room) => setRoomLabel(room.name))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load the room.'));
  }, [isStorage, roomId]);

  const changeName = (value: string): void => {
    setName(value);
    setError(null);
    setAdded(null);
  };

  const save = (): void => {
    const submitted = name.trim();
    setSaving(true);
    setError(null);
    setAdded(null);
    const operation = isStorage
      ? Number.isInteger(roomId)
        ? initializeDatabase().then((database) => createParentStorageSpot(database, roomId, submitted))
        : Promise.reject(new Error('The selected room is invalid.'))
      : initializeDatabase().then((database) => createParentRoom(database, submitted));
    operation
      .then(() => {
        setName('');
        setAdded(submitted);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not save location.'))
      .finally(() => setSaving(false));
  };

  return (
    <LocationFormScreen
      description={
        isStorage
          ? `Add a storage spot inside ${roomLabel ?? 'the selected room'}.`
          : 'Create a room where toys can belong.'
      }
      error={error}
      fieldLabel={isStorage ? 'Storage spot name' : 'Room name'}
      onChangeText={changeName}
      onSubmit={save}
      placeholder={isStorage ? 'Blue Bin' : 'e.g. Playroom'}
      submitLabel={isStorage ? 'Add Storage Spot' : 'Add Room'}
      submitting={saving}
      success={added ? `${added} added to Rooms & Storage.` : null}
      title={isStorage ? 'Add Storage Spot' : 'Add Room'}
      value={name}
    />
  );
}
