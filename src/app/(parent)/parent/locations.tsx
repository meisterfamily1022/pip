import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LocationButton, LocationEmpty, LocationError, LocationLoading } from '@/components/location-ui';
import { initializeDatabase } from '@/database/client';
import { loadLocationTree, removeParentRoom, removeParentStorageSpot } from '@/features/locations/location-service';
import { confirmLocationDeletion } from '@/features/locations/confirmation';
import type { LocationTreeItem } from '@/features/locations/location-service';
import { playmapTheme as theme, screenContentStyle } from '@/theme/playmap-theme';

export default function ParentLocationsRoute() {
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { const database = await initializeDatabase(); setLocations(await loadLocationTree(database)); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not load locations.'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const deleteRoom = async (room: LocationTreeItem): Promise<void> => {
    if (!await confirmLocationDeletion('Delete room?', `Delete ${room.name}?`)) return;
    try { const database = await initializeDatabase(); await removeParentRoom(database, room.id); await reload(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not delete room.'); }
  };
  const deleteStorageSpot = async (roomName: string, spotId: number, spotName: string): Promise<void> => {
    if (!await confirmLocationDeletion('Delete storage spot?', `Delete ${roomName} → ${spotName}?`)) return;
    try { const database = await initializeDatabase(); await removeParentStorageSpot(database, spotId); await reload(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not delete storage spot.'); }
  };
  if (loading) return <LocationLoading />;
  if (error && locations.length === 0) return <LocationError message={error} onRetry={() => { void reload(); }} />;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}><Text style={styles.title}>Rooms &amp; Spots</Text><Text style={styles.helper}>Organize where toys belong so your child can find them and put them back.</Text>{error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}<View style={styles.addAction}><LocationButton primary label="＋  Add Room" onPress={() => router.push('/parent/add-location')} /></View>{locations.length === 0 ? <LocationEmpty onAddRoom={() => router.push('/parent/add-location')} /> : <View style={styles.rooms}>{locations.map((room) => <View key={room.id} style={styles.room}><View style={styles.row}><View style={styles.roomHeading}><Text style={styles.roomIcon}>⌂</Text><Text style={styles.roomName}>{room.name}</Text></View><View style={styles.actions}><LocationButton label={`Edit ${room.name}`} onPress={() => router.push(`/parent/edit-location?type=room&id=${room.id}`)} /><LocationButton label={`Delete ${room.name}`} destructive onPress={() => { void deleteRoom(room); }} /></View></View><LocationButton label={`Add storage spot to ${room.name}`} onPress={() => router.push(`/parent/add-location?type=storage&roomId=${room.id}`)} />{room.storageSpots.length === 0 ? <Text style={styles.emptySpots}>No storage spots yet.</Text> : <View style={styles.spots}>{room.storageSpots.map((spot) => <View key={spot.id} style={styles.spot}><Text style={styles.spotName}>↳  {spot.name}</Text><View style={styles.actions}><LocationButton label={`Edit ${spot.name}`} onPress={() => router.push(`/parent/edit-location?type=storage&id=${spot.id}`)} /><LocationButton label={`Delete ${spot.name}`} destructive onPress={() => { void deleteStorageSpot(room.name, spot.id, spot.name); }} /></View></View>)}</View>}</View>)}</View>}</ScrollView>;
}

const styles = StyleSheet.create({ content: { ...screenContentStyle, backgroundColor: theme.colors.background, flexGrow: 1, gap: 16 }, title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 32, fontWeight: '700' }, helper: { color: theme.colors.mutedText, fontSize: 17, lineHeight: 25 }, addAction: { alignSelf: 'flex-start' }, rooms: { gap: 16 }, room: { ...theme.shadows.card, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: 14, padding: 18 }, row: { gap: 12 }, roomHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 }, roomIcon: { color: theme.colors.sageAction, fontSize: 24 }, roomName: { color: theme.colors.text, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, spots: { gap: 10 }, spot: { alignItems: 'center', backgroundColor: theme.colors.sageSoft, borderRadius: theme.radii.md, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', padding: 12 }, spotName: { color: theme.colors.secondaryText, flex: 1, fontSize: 17, minWidth: 140 }, emptySpots: { color: theme.colors.mutedText, fontStyle: 'italic' }, error: { color: theme.colors.danger }, });
