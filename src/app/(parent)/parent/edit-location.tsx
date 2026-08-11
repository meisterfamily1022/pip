import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ParentModeHeader } from '@/components/parent-ui';
import { ErrorStateCard, FormCard, LoadingState, PageShell, PrimaryButton, ReadOnlyValue, RoundedTextInput } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { getParentRoom, getParentStorageSpot, renameParentRoom, renameParentStorageSpot } from '@/features/locations/location-service';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { validateRequiredName } from '@/features/onboarding/validation';

export default function EditLocationRoute() {
  const { type, id: idParam } = useLocalSearchParams<{ type?: string; id?: string }>();
  const isStorage = type === 'storage';
  const id = idParam ? Number(idParam) : NaN;
  const invalidRoute = !Number.isInteger(id) || id < 1 || (type !== 'room' && type !== 'storage');
  const [currentName, setCurrentName] = useState('');
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(invalidRoute ? 'This location link is invalid.' : null);
  const [loading, setLoading] = useState(!invalidRoute);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (invalidRoute) return;
    initializeDatabase().then(async (database) => {
      if (isStorage) {
        const spot = await getParentStorageSpot(database, id);
        setCurrentName(spot.name); setRoomLabel(spot.roomName);
      } else {
        const room = await getParentRoom(database, id);
        setCurrentName(room.name);
      }
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load location.')).finally(() => setLoading(false));
  }, [id, invalidRoute, isStorage]);

  const save = async (): Promise<void> => {
    if (savingRef.current) return;
    const validationError = validateRequiredName(currentName, isStorage ? 'Storage spot name' : 'Room name');
    if (validationError) { setError(validationError); return; }
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const database = await initializeDatabase();
      if (isStorage) await renameParentStorageSpot(database, id, currentName);
      else await renameParentRoom(database, id, currentName);
      router.replace('/parent/locations');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not save location.');
    } finally {
      savingRef.current = false; setSaving(false);
    }
  };

  const title = isStorage ? 'Edit Storage Spot' : 'Edit Room';
  const header = <ParentModeHeader backLabel="Rooms & Storage" backTo={parentBackTargets.editLocation} subtitle={isStorage ? `Rename this storage spot in ${roomLabel ?? 'its room'}.` : 'Rename this room without changing its storage spots.'} title={title} />;
  if (loading) return <PageShell scroll={false}>{header}<LoadingState label="Loading location…" /></PageShell>;
  if (invalidRoute || (error && !currentName)) return <PageShell>{header}<ErrorStateCard message={error ?? 'Location not found.'} /></PageShell>;
  return <PageShell>{header}<FormCard tone="surface"><RoundedTextInput error={error} label={isStorage ? 'Storage spot name' : 'Room name'} onChangeText={(value) => { setCurrentName(value); setError(null); }} value={currentName} />{isStorage && roomLabel && <ReadOnlyValue label="Room" value={roomLabel} />}<View style={styles.actions}><PrimaryButton disabled={saving || !currentName.trim()} label={saving ? 'Saving…' : 'Save Changes'} onPress={() => { void save(); }} /></View></FormCard></PageShell>;
}

const styles = StyleSheet.create({
  actions: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap' },
});
