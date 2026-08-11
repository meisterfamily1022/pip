import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocationEmpty, LocationError, LocationLoading } from '@/components/location-ui';
import { ParentScreen } from '@/components/parent-ui';
import { PipIcon } from '@/components/pip-icon';
import {
  Banner,
  ConfirmationDialog,
  DestructiveButton,
  ListCard,
  ListRow,
  PrimaryButton,
  SecondaryButton,
  Sheet,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import {
  getParentRoomDeletionImpact,
  getParentStorageSpotDeletionImpact,
  loadLocationTree,
  removeParentRoom,
  removeParentRoomWithReassignment,
  removeParentStorageSpot,
  removeParentStorageSpotWithReassignment,
  type LocationTreeItem,
} from '@/features/locations/location-service';
import { countToysAssignedToRoom, countToysAssignedToStorageSpot } from '@/repositories/rooms-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type Counts = { rooms: Map<number, number>; spots: Map<number, number> };

/** What the parent is removing, and where its toys have to go first. */
type Removal = {
  kind: 'room' | 'spot';
  id: number;
  name: string;
  roomName: string;
  toyCount: number;
  spotCount: number;
};

export default function ParentLocationsRoute() {
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ rooms: new Map(), spots: new Map() });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [destination, setDestination] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const database = await initializeDatabase();
      const tree = await loadLocationTree(database);
      const roomCounts = await Promise.all(tree.map(async (room) => [room.id, await countToysAssignedToRoom(database, room.id)] as const));
      const spotCounts = await Promise.all(
        tree.flatMap((room) => room.storageSpots).map(async (spot) => [spot.id, await countToysAssignedToStorageSpot(database, spot.id)] as const),
      );
      setLocations(tree);
      setCounts({ rooms: new Map(roomCounts), spots: new Map(spotCounts) });
      setExpanded((current) => (current.size === 0 && tree[0] ? new Set([tree[0].id]) : current));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Your spaces could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const toggleRoom = (id: number): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const beginRemoval = async (target: Removal): Promise<void> => {
    setError(null);
    try {
      const database = await initializeDatabase();
      const impact = target.kind === 'room'
        ? await getParentRoomDeletionImpact(database, target.id)
        : await getParentStorageSpotDeletionImpact(database, target.id);
      setRemoval({ ...target, toyCount: impact.toyCount, spotCount: impact.storageSpotCount });
      setDestination(null);
      // Nothing to rehome means the confirmation can be asked straight away.
      if (impact.toyCount === 0) setConfirming(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That could not be prepared.');
    }
  };

  const finishRemoval = async (): Promise<void> => {
    if (!removal) return;
    setBusy(true);
    try {
      const database = await initializeDatabase();
      if (removal.toyCount === 0) {
        if (removal.kind === 'room') await removeParentRoom(database, removal.id);
        else await removeParentStorageSpot(database, removal.id);
      } else if (destination !== null) {
        if (removal.kind === 'room') await removeParentRoomWithReassignment(database, removal.id, destination);
        else await removeParentStorageSpotWithReassignment(database, removal.id, destination);
      }
      setConfirming(false);
      setRemoval(null);
      setDestination(null);
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That could not be removed.');
      setConfirming(false);
      setRemoval(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LocationLoading />;
  if (error && locations.length === 0) return <LocationError message={error} onRetry={() => { void reload(); }} />;

  const totalSpots = locations.reduce((total, room) => total + room.storageSpots.length, 0);
  const totalToys = [...counts.rooms.values()].reduce((total, count) => total + count, 0);

  // Every spot except the ones being removed is a candidate new home.
  const destinations = locations
    .flatMap((room) => room.storageSpots.map((spot) => ({ ...spot, roomName: room.name, toyCount: counts.spots.get(spot.id) ?? 0 })))
    .filter((spot) => (removal?.kind === 'room' ? spot.roomId !== removal.id : spot.id !== removal?.id));

  return (
    <ParentScreen tab="spaces">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>Spaces</Text>
          <Text style={styles.subtitle}>
            {`${locations.length} ${locations.length === 1 ? 'room' : 'rooms'} · ${totalSpots} storage ${totalSpots === 1 ? 'spot' : 'spots'} · ${totalToys} ${totalToys === 1 ? 'toy' : 'toys'}`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Add a room"
          accessibilityRole="button"
          onPress={() => router.push('/parent/add-location')}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <PipIcon color={theme.colors.brandPrimaryLabel} name="plus" size={22} strokeWidth={2.4} />
        </Pressable>
      </View>

      {error ? <Banner message={error} tone="alert" /> : null}

      {locations.length === 0 ? (
        <LocationEmpty onAddRoom={() => router.push('/parent/add-location')} />
      ) : (
        locations.map((room) => {
          const open = expanded.has(room.id);
          const roomToys = counts.rooms.get(room.id) ?? 0;
          return (
            <ListCard key={room.id} style={styles.roomCard}>
              <Pressable
                accessibilityHint={open ? 'Hides the storage spots' : 'Shows the storage spots'}
                accessibilityLabel={`${room.name}. ${room.storageSpots.length} ${room.storageSpots.length === 1 ? 'spot' : 'spots'}, ${roomToys} ${roomToys === 1 ? 'toy' : 'toys'}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => toggleRoom(room.id)}
                style={({ pressed }) => [styles.roomRow, pressed && styles.pressed]}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.meta}>
                    {`${room.storageSpots.length} ${room.storageSpots.length === 1 ? 'spot' : 'spots'} · ${roomToys === 0 ? 'no toys yet' : `${roomToys} ${roomToys === 1 ? 'toy' : 'toys'}`}`}
                  </Text>
                </View>
                <PipIcon color={theme.colors.mutedText} name={open ? 'chevron-down' : 'chevron-right'} size={18} />
              </Pressable>

              {open ? (
                <>
                  {room.storageSpots.map((spot) => {
                    const spotToys = counts.spots.get(spot.id) ?? 0;
                    return (
                      <ListRow
                        detail={spotToys === 0 ? 'No toys yet' : `${spotToys} ${spotToys === 1 ? 'toy' : 'toys'}`}
                        indented
                        key={spot.id}
                        onPress={() => router.push(`/parent/edit-location?type=storage&id=${spot.id}`)}
                        title={spot.name}
                      />
                    );
                  })}
                  <ListRow
                    accessory="none"
                    icon="plus"
                    indented
                    onPress={() => router.push(`/parent/add-location?type=storage&roomId=${room.id}`)}
                    title="Add a storage spot"
                  />
                  <View style={styles.roomActions}>
                    <SecondaryButton
                      label="Rename room"
                      onPress={() => router.push(`/parent/edit-location?type=room&id=${room.id}`)}
                      style={styles.roomAction}
                    />
                    <DestructiveButton
                      label="Delete room"
                      onPress={() => {
                        void beginRemoval({ kind: 'room', id: room.id, name: room.name, roomName: room.name, toyCount: roomToys, spotCount: room.storageSpots.length });
                      }}
                      style={styles.roomAction}
                    />
                  </View>
                </>
              ) : null}
            </ListCard>
          );
        })
      )}

      {/* Rehoming comes before the confirmation, so the toys are never the surprise. */}
      <Sheet
        onDismiss={() => setRemoval(null)}
        subtitle={removal ? `${removal.toyCount} ${removal.toyCount === 1 ? 'toy needs' : 'toys need'} a new home before ${removal.name} can go.` : undefined}
        title={removal ? `Move ${removal.toyCount} ${removal.toyCount === 1 ? 'toy' : 'toys'} to` : ''}
        visible={removal !== null && !confirming && removal.toyCount > 0}
      >
        <ListCard>
          {destinations.map((spot) => (
            <ListRow
              accessory={destination === spot.id ? 'check' : 'none'}
              detail={spot.toyCount > 0 ? `${spot.toyCount} ${spot.toyCount === 1 ? 'toy' : 'toys'} already here` : 'Empty'}
              key={spot.id}
              onPress={() => setDestination(spot.id)}
              title={`${spot.roomName} · ${spot.name}`}
            />
          ))}
        </ListCard>
        {destinations.length === 0 ? (
          <Banner
            message="There is nowhere else to put them yet. Add another room and spot first, then come back."
            tone="alert"
          />
        ) : null}
        <PrimaryButton
          disabled={destination === null}
          label="Continue"
          onPress={() => setConfirming(true)}
        />
        <SecondaryButton label="Keep the room" onPress={() => setRemoval(null)} />
      </Sheet>

      <ConfirmationDialog
        busy={busy}
        cancelLabel={removal?.kind === 'room' ? 'Keep the room' : 'Keep the spot'}
        confirmLabel={removal && removal.toyCount > 0 ? 'Move toys & delete' : 'Delete'}
        destructive
        message={removal ? describeRemoval(removal, destinations.find((spot) => spot.id === destination)) : ''}
        onCancel={() => {
          setConfirming(false);
          setRemoval(null);
        }}
        onConfirm={() => {
          void finishRemoval();
        }}
        title={removal ? `Delete ${removal.name}?` : 'Delete?'}
        visible={confirming}
      />
    </ParentScreen>
  );
}

function describeRemoval(removal: Removal, target?: { roomName: string; name: string }): string {
  const where = target ? `${target.roomName} · ${target.name}` : 'their new home';
  if (removal.toyCount === 0) {
    return removal.kind === 'room'
      ? `${removal.name} is empty. Deleting it removes the room and its spots from Pip. This cannot be undone.`
      : `${removal.name} is empty. Deleting it removes the spot from Pip. This cannot be undone.`;
  }
  const spots = removal.kind === 'room' && removal.spotCount > 0
    ? ` and its ${removal.spotCount} ${removal.spotCount === 1 ? 'spot' : 'spots'}`
    : '';
  return `This cannot be undone. ${removal.name}${spots} will be removed from Pip. ${removal.toyCount} ${removal.toyCount === 1 ? 'toy moves' : 'toys move'} to ${where} and keep their photos and history.`;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  header: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12] },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.meta },
  addButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radii.control,
    height: theme.measurements.minimumTouchTarget,
    justifyContent: 'center',
    width: theme.measurements.minimumTouchTarget,
  },
  roomCard: { marginBottom: theme.spacing[4] },
  roomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: 56,
    paddingHorizontal: theme.spacing[16],
    paddingVertical: theme.spacing[12],
  },
  rowCopy: { flex: 1, gap: 2 },
  roomName: { color: theme.colors.primaryText, ...theme.typography.rowTitle },
  meta: { color: theme.colors.secondaryText, ...theme.typography.meta },
  roomActions: {
    borderTopColor: theme.colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: theme.spacing[8],
    padding: theme.spacing[12],
  },
  roomAction: { flex: 1, minHeight: theme.measurements.minimumTouchTarget },
});
