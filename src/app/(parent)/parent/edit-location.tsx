import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { BackButton, Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { initializeDatabase } from '@/database/client';
import { getParentRoom, getParentStorageSpot, renameParentRoom, renameParentStorageSpot } from '@/features/locations/location-service';

function returnToLocations(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/parent/locations');
}

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
  const save = (): void => {
    setSaving(true); setError(null);
    const operation = isStorage ? initializeDatabase().then((database) => renameParentStorageSpot(database, id, currentName)) : initializeDatabase().then((database) => renameParentRoom(database, id, currentName));
    operation.then(returnToLocations).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not save location.')).finally(() => setSaving(false));
  };
  if (loading) return <OnboardingScreen title="Edit location"><Text>Loading…</Text></OnboardingScreen>;
  return <OnboardingScreen title={isStorage ? 'Edit storage spot' : 'Edit room'} description={isStorage ? `This storage spot belongs to ${roomLabel ?? 'the selected room'}.` : 'Rename this room without changing its storage spots.'} footer={<PrimaryButton label={saving ? 'Saving…' : 'Save'} disabled={saving || Boolean(error && !currentName)} onPress={save} />}><BackButton onPress={returnToLocations} /><Field label={isStorage ? 'Storage spot name' : 'Room name'} value={currentName} onChangeText={(value) => { setCurrentName(value); setError(null); }} error={error} />{isStorage && roomLabel && <Field label="Room" value={roomLabel} onChangeText={() => {}} />}</OnboardingScreen>;
}
