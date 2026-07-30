import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '@/database/client';
import { HouseIcon, LocationArrowIcon, PencilIcon, PlusIcon, TrashIcon } from '@/design/icons';
import {
  BackLink,
  Body,
  Caption,
  Card,
  DangerButton,
  EmptyState,
  ErrorState,
  ErrorText,
  IconWell,
  LoadingState,
  ModeBadge,
  PrimaryButton,
  QuietButton,
  Screen,
  ScreenTitle,
} from '@/design/primitives';
import { colors, fontSizes, fonts, radii, spacing } from '@/design/tokens';
import { confirmLocationDeletion } from '@/features/locations/confirmation';
import { loadLocationTree, removeParentRoom, removeParentStorageSpot } from '@/features/locations/location-service';
import type { LocationTreeItem } from '@/features/locations/location-service';

/**
 * Rooms & Storage — the parent's map of where toys belong. Each room card owns
 * its rename/delete actions and the storage spots nested underneath it.
 */
export default function ParentLocationsRoute() {
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      setLocations(await loadLocationTree(database));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load locations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const deleteRoom = async (room: LocationTreeItem): Promise<void> => {
    if (!(await confirmLocationDeletion('Delete room?', `Delete ${room.name}?`))) return;
    try {
      const database = await initializeDatabase();
      await removeParentRoom(database, room.id);
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not delete room.');
    }
  };

  const deleteStorageSpot = async (roomName: string, spotId: number, spotName: string): Promise<void> => {
    if (!(await confirmLocationDeletion('Delete storage spot?', `Delete ${roomName} → ${spotName}?`))) return;
    try {
      const database = await initializeDatabase();
      await removeParentStorageSpot(database, spotId);
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not delete storage spot.');
    }
  };

  const goHome = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/parent/home');
  };

  if (loading) {
    return (
      <Screen contentStyle={styles.fill} mode="parent" scroll={false}>
        <LoadingState label="Loading rooms…" />
      </Screen>
    );
  }

  if (error && locations.length === 0) {
    return (
      <Screen contentStyle={styles.fill} mode="parent" scroll={false}>
        <ErrorState
          message={error}
          onRetry={() => {
            void reload();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content} mode="parent">
      <BackLink label="Home" onPress={goHome} />
      <View style={styles.heading}>
        <ModeBadge mode="parent" />
        <ScreenTitle>Rooms & Storage</ScreenTitle>
        <Body>Organize where toys belong so your child can find them and put them back.</Body>
      </View>
      <PrimaryButton
        icon={PlusIcon}
        label="Add Room"
        onPress={() => router.push('/parent/add-location')}
        style={styles.addRoom}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {locations.length === 0 ? (
        <EmptyState
          description="Add your first room to start organizing where toys belong."
          icon={HouseIcon}
          title="No rooms yet"
        />
      ) : (
        <View style={styles.rooms}>
          {locations.map((room) => (
            <Card key={room.id}>
              <View style={styles.roomHeader}>
                <IconWell size={38} tint="sage">
                  <HouseIcon color={colors.green} size={19} />
                </IconWell>
                <Text style={styles.roomName}>{room.name}</Text>
              </View>
              <View style={styles.roomActions}>
                <QuietButton
                  accessibilityLabel={`Edit ${room.name}`}
                  icon={PencilIcon}
                  label="Edit"
                  onPress={() => router.push(`/parent/edit-location?type=room&id=${room.id}`)}
                />
                <DangerButton
                  accessibilityLabel={`Delete ${room.name}`}
                  icon={TrashIcon}
                  label="Delete"
                  onPress={() => {
                    void deleteRoom(room);
                  }}
                />
                <QuietButton
                  accessibilityLabel={`Add storage spot to ${room.name}`}
                  icon={PlusIcon}
                  label="Add storage spot"
                  onPress={() => router.push(`/parent/add-location?type=storage&roomId=${room.id}`)}
                />
              </View>
              <View style={styles.spots}>
                {room.storageSpots.length === 0 ? (
                  <Caption>No storage spots yet.</Caption>
                ) : (
                  room.storageSpots.map((spot) => (
                    <View key={spot.id} style={styles.spot}>
                      <View style={styles.spotLabel}>
                        <LocationArrowIcon color={colors.textSecondary} size={15} />
                        <Text style={styles.spotName}>{spot.name}</Text>
                      </View>
                      <View style={styles.spotActions}>
                        <QuietButton
                          accessibilityLabel={`Edit ${spot.name}`}
                          label="Edit"
                          onPress={() => router.push(`/parent/edit-location?type=storage&id=${spot.id}`)}
                          style={styles.spotEditButton}
                        />
                        <DangerButton
                          accessibilityLabel={`Delete ${spot.name}`}
                          label="Delete"
                          onPress={() => {
                            void deleteStorageSpot(room.name, spot.id, spot.name);
                          }}
                          style={styles.spotButton}
                        />
                      </View>
                    </View>
                  ))
                )}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addRoom: { alignSelf: 'flex-start' },
  content: { gap: spacing.lg },
  fill: { flex: 1 },
  heading: { gap: spacing.sm },

  rooms: { gap: spacing.lg },
  roomActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  roomHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  roomName: { color: colors.textPrimary, flex: 1, fontFamily: fonts.heading, fontSize: fontSizes.cardTitle, fontWeight: '700' },

  spot: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: radii.action,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  spotActions: { flexDirection: 'row', gap: spacing.sm },
  spotButton: { paddingHorizontal: spacing.md },
  spotEditButton: { backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  spotLabel: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  spotName: { color: colors.textPrimary, fontSize: fontSizes.bodySmall, fontWeight: '700' },
  spots: {
    borderLeftColor: colors.border,
    borderLeftWidth: 2,
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
  },
});
