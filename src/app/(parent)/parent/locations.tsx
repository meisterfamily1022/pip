import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LocationButton, LocationEmpty, LocationError, LocationLoading } from '@/components/location-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import { Card, ConfirmationDialog, PageShell } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { getParentRoomDeletionImpact, getParentStorageSpotDeletionImpact, loadLocationTree, removeParentRoom, removeParentStorageSpot } from '@/features/locations/location-service';
import type { LocationTreeItem } from '@/features/locations/location-service';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function ParentLocationsRoute() {
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<{ id: number; kind: 'room' | 'storage'; message: string; title: string } | null>(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { const database = await initializeDatabase(); setLocations(await loadLocationTree(database)); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not load locations.'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const deleteRoom = async (room: LocationTreeItem): Promise<void> => {
    setError(null);
    try {
      const database = await initializeDatabase();
      const impact = await getParentRoomDeletionImpact(database, room.id);
      if (!impact.canDelete) { setError(`${room.name} cannot be deleted. ${impact.message}`); return; }
      setPendingDeletion({ id: room.id, kind: 'room', message: `${impact.message} Delete ${room.name}? This cannot be undone.`, title: 'Delete Room?' });
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not prepare room deletion.'); }
  };
  const deleteStorageSpot = async (roomName: string, spotId: number, spotName: string): Promise<void> => {
    setError(null);
    try {
      const database = await initializeDatabase();
      const impact = await getParentStorageSpotDeletionImpact(database, spotId);
      if (!impact.canDelete) { setError(`${roomName} → ${spotName} cannot be deleted. ${impact.message}`); return; }
      setPendingDeletion({ id: spotId, kind: 'storage', message: `${impact.message} Delete ${roomName} → ${spotName}? This cannot be undone.`, title: 'Delete Storage Spot?' });
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not prepare storage spot deletion.'); }
  };
  const confirmDeletion = async (): Promise<void> => {
    const request = pendingDeletion;
    if (!request) return;
    setPendingDeletion(null); setError(null);
    try {
      const database = await initializeDatabase();
      if (request.kind === 'room') await removeParentRoom(database, request.id);
      else await removeParentStorageSpot(database, request.id);
      await reload();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not delete location.'); }
  };
  if (loading) return <LocationLoading />;
  if (error && locations.length === 0) return <LocationError message={error} onRetry={() => { void reload(); }} />;
  return <PageShell><ParentModeHeader action={<LocationButton primary label="Add Room" onPress={() => router.push('/parent/add-location')} />} backTo={parentBackTargets.locations} subtitle="Organize where toys belong so your child can find them and put them back." title="Rooms & Storage" />{error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}{locations.length === 0 ? <LocationEmpty onAddRoom={() => router.push('/parent/add-location')} /> : <View style={styles.rooms}>{locations.map((room) => <Card key={room.id} style={styles.room}><View style={styles.row}><View style={styles.roomHeading}><Text style={styles.roomIcon}>⌂</Text><Text style={styles.roomName}>{room.name}</Text></View><View style={styles.actions}><LocationButton label={`Edit ${room.name}`} onPress={() => router.push(`/parent/edit-location?type=room&id=${room.id}`)} /><LocationButton label={`Delete ${room.name}`} destructive onPress={() => { void deleteRoom(room); }} /></View></View><View style={styles.inlineAction}><LocationButton label={`Add storage spot to ${room.name}`} onPress={() => router.push(`/parent/add-location?type=storage&roomId=${room.id}`)} /></View>{room.storageSpots.length === 0 ? <Text style={styles.emptySpots}>No storage spots yet.</Text> : <View style={styles.spots}>{room.storageSpots.map((spot) => <View key={spot.id} style={styles.spot}><Text style={styles.spotName}>↳  {spot.name}</Text><View style={styles.actions}><LocationButton label={`Edit ${spot.name}`} onPress={() => router.push(`/parent/edit-location?type=storage&id=${spot.id}`)} /><LocationButton label={`Delete ${spot.name}`} destructive onPress={() => { void deleteStorageSpot(room.name, spot.id, spot.name); }} /></View></View>)}</View>}</Card>)}</View>}<ConfirmationDialog confirmLabel={pendingDeletion?.kind === 'room' ? 'Delete Room' : 'Delete Storage Spot'} destructive message={pendingDeletion?.message ?? ''} onCancel={() => setPendingDeletion(null)} onConfirm={() => { void confirmDeletion(); }} title={pendingDeletion?.title ?? 'Confirm deletion'} visible={pendingDeletion !== null} /></PageShell>;
}

const styles = StyleSheet.create({ rooms: { gap: 16 }, room: { gap: 14 }, row: { gap: 12 }, roomHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 }, roomIcon: { color: theme.colors.sageAction, fontSize: 24 }, roomName: { color: theme.colors.text, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: '100%' }, inlineAction: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap' }, spots: { gap: 10 }, spot: { alignItems: 'stretch', backgroundColor: theme.colors.sageSoft, borderRadius: theme.radii.md, gap: 10, padding: 12 }, spotName: { color: theme.colors.secondaryText, fontSize: 17 }, emptySpots: { color: theme.colors.mutedText, fontStyle: 'italic' }, error: { color: theme.colors.danger }, });
