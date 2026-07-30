import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { LocationFormScreen, goBackToLocations } from '@/components/location-ui';
import { initializeDatabase } from '@/database/client';
import { LoadingState, Screen } from '@/design/primitives';
import {
  getParentRoom,
  getParentStorageSpot,
  renameParentRoom,
  renameParentStorageSpot,
} from '@/features/locations/location-service';

/** Renames one room or storage spot, addressed by `?type=room|storage&id=`. */
export default function EditLocationRoute() {
  const { type, id: idParam } = useLocalSearchParams<{ type?: string; id?: string }>();
  const isStorage = type === 'storage';
  const id = idParam ? Number(idParam) : NaN;
  const invalidRoute = !Number.isInteger(id) || (type !== 'room' && type !== 'storage');
  const [currentName, setCurrentName] = useState('');
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(invalidRoute ? 'This location link is invalid.' : null);
  const [loading, setLoading] = useState(!invalidRoute);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invalidRoute) return;
    initializeDatabase()
      .then(async (database) => {
        if (isStorage) {
          const spot = await getParentStorageSpot(database, id);
          setCurrentName(spot.name);
          setRoomLabel(spot.roomName);
        } else {
          const room = await getParentRoom(database, id);
          setCurrentName(room.name);
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load location.'))
      .finally(() => setLoading(false));
  }, [id, invalidRoute, isStorage]);

  const save = (): void => {
    setSaving(true);
    setError(null);
    const operation = isStorage
      ? initializeDatabase().then((database) => renameParentStorageSpot(database, id, currentName))
      : initializeDatabase().then((database) => renameParentRoom(database, id, currentName));
    operation
      .then(() => goBackToLocations())
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not save location.'))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <Screen contentStyle={styles.fill} mode="parent" scroll={false}>
        <LoadingState label="Loading location…" />
      </Screen>
    );
  }

  return (
    <LocationFormScreen
      description={
        isStorage
          ? `This storage spot belongs to ${roomLabel ?? 'the selected room'}.`
          : 'Rename this room without changing its storage spots.'
      }
      error={error}
      fieldLabel={isStorage ? 'Storage spot name' : 'Room name'}
      onChangeText={(value) => {
        setCurrentName(value);
        setError(null);
      }}
      onSubmit={save}
      submitLabel="Save Changes"
      submitting={saving}
      title={isStorage ? 'Edit Storage Spot' : 'Edit Room'}
      value={currentName}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
