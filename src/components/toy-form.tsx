import { useCallback, useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  useCameraPermissions,
  useMediaLibraryPermissions,
} from 'expo-image-picker';

import { ToyPhoto } from '@/components/toy-photo';
import { initializeDatabase } from '@/database/client';
import { CameraIcon, HouseIcon, PlusIcon, TrashIcon } from '@/design/icons';
import {
  Card,
  Caption,
  EmptyState,
  ErrorText,
  LoadingState,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
  SelectPill,
  TextField,
  TintPanel,
  ToggleRow,
} from '@/design/primitives';
import { colors, fontSizes, radii, spacing } from '@/design/tokens';
import type { Room, StorageSpot } from '@/domain/models';
import { PLAY_CATEGORIES, playCategoryLabel, type PlayCategory } from '@/domain/play-category';
import {
  ToyValidationError,
  validateToyForm,
  type ToyFormInput,
  type ToyFormValidationErrors,
} from '@/features/toys/toy-service';
import { listRooms, listStorageSpots } from '@/repositories/rooms-repository';

/**
 * The shared Add Toy / Edit Toy form.
 *
 * Both routes render this so a toy is described the same way whichever door the
 * parent came through: a photo, a name, where it lives, what kind of play it is
 * for, and whether the child may be offered it.
 */

export type ToyFormProps = {
  /** Label for the terracotta save action, e.g. "Save Toy". */
  submitLabel: string;
  /** Values to prefill. Read once, so render the form only after they load. */
  initialValue?: ToyFormInput;
  /** Persists the toy. Throw to show a message; resolve once the caller has navigated away. */
  onSubmit(input: ToyFormInput): Promise<void>;
  /** Extra action rendered under the form, e.g. Edit Toy's delete button. */
  footer?: ReactNode;
};

const EMPTY_TOY: ToyFormInput = {
  name: '',
  imageUri: null,
  roomId: null,
  storageSpotId: null,
  categories: [],
  isAvailable: true,
};

/** Matches the 1.1:1 frame `ToyPhoto` draws, so the crop is what the parent sees. */
const PHOTO_ASPECT: [number, number] = [11, 10];

const FieldLabel = ({ children }: PropsWithChildren) => <Text style={styles.fieldLabel}>{children}</Text>;

export function ToyForm({ submitLabel, initialValue, onSubmit, footer }: ToyFormProps) {
  const initial = initialValue ?? EMPTY_TOY;
  const [name, setName] = useState(initial.name);
  const [imageUri, setImageUri] = useState<string | null>(initial.imageUri);
  const [roomId, setRoomId] = useState<number | null>(initial.roomId);
  const [storageSpotId, setStorageSpotId] = useState<number | null>(initial.storageSpotId);
  const [categories, setCategories] = useState<readonly PlayCategory[]>(initial.categories);
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [storageSpots, setStorageSpots] = useState<StorageSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ToyFormValidationErrors>({});
  const [saving, setSaving] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [libraryPermission, requestLibraryPermission] = useMediaLibraryPermissions();

  const loadRooms = useCallback(async (): Promise<void> => {
    try {
      const database = await initializeDatabase();
      const list = await listRooms(database);
      setRooms(list);
      setRoomId((current) => (current !== null && list.some((room) => room.id === current) ? current : null));
      setLoadError(null);
    } catch (caught: unknown) {
      setLoadError(caught instanceof Error ? caught.message : 'Could not load your rooms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRooms();
    }, [loadRooms]),
  );

  useEffect(() => {
    if (roomId === null) return;
    let active = true;
    void (async () => {
      try {
        const database = await initializeDatabase();
        const list = await listStorageSpots(database, roomId);
        if (!active) return;
        setStorageSpots(list);
        setStorageSpotId((current) => (current !== null && list.some((spot) => spot.id === current) ? current : null));
      } catch (caught: unknown) {
        if (!active) return;
        setStorageSpots([]);
        setLoadError(caught instanceof Error ? caught.message : 'Could not load storage spots.');
      }
    })();
    return () => {
      active = false;
    };
  }, [roomId]);

  const selectRoom = (id: number): void => {
    if (id === roomId) return;
    setRoomId(id);
    setStorageSpotId(null);
    setValidationErrors((current) => ({ ...current, roomId: undefined, storageSpotId: undefined }));
  };

  const toggleCategory = (category: PlayCategory): void => {
    setValidationErrors((current) => ({ ...current, categories: undefined }));
    setCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  };

  const takePhoto = async (): Promise<void> => {
    setPhotoError(null);
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      setPhotoError(
        permission.canAskAgain
          ? 'PlayMap needs camera access to take a photo. Choose a photo from your library instead, or allow the camera when asked.'
          : 'Camera access is turned off. Turn it on in your device settings, or choose a photo from your library.',
      );
      return;
    }
    try {
      const result = await launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: PHOTO_ASPECT,
        quality: 0.8,
      });
      if (result.canceled) return;
      const [asset] = result.assets;
      if (asset) setImageUri(asset.uri);
    } catch (caught: unknown) {
      setPhotoError(caught instanceof Error ? caught.message : 'Could not open the camera.');
    }
  };

  const choosePhoto = async (): Promise<void> => {
    setPhotoError(null);
    const permission = libraryPermission?.granted ? libraryPermission : await requestLibraryPermission();
    if (!permission.granted) {
      setPhotoError(
        permission.canAskAgain
          ? 'PlayMap needs photo library access to choose a photo. Take a new photo instead, or allow access when asked.'
          : 'Photo library access is turned off. Turn it on in your device settings, or take a new photo.',
      );
      return;
    }
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: PHOTO_ASPECT,
        quality: 0.8,
      });
      if (result.canceled) return;
      const [asset] = result.assets;
      if (asset) setImageUri(asset.uri);
    } catch (caught: unknown) {
      setPhotoError(caught instanceof Error ? caught.message : 'Could not open your photo library.');
    }
  };

  const submit = async (): Promise<void> => {
    const input = { name, imageUri, roomId, storageSpotId, categories, isAvailable };
    const errors = validateToyForm(input);
    setSaveError(null);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit(input);
    } catch (caught: unknown) {
      if (caught instanceof ToyValidationError) setValidationErrors(caught.errors);
      else setSaveError(caught instanceof Error ? caught.message : 'Could not save this toy.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <LoadingState label="Loading your rooms…" />
      </View>
    );
  }

  if (rooms.length === 0) {
    return (
      <EmptyState
        action={
          <PrimaryButton icon={PlusIcon} label="Add Room" onPress={() => router.push('/parent/add-location')} />
        }
        description="Every toy belongs to a room and a storage spot, so add a room first. Then this toy has somewhere to live."
        icon={HouseIcon}
        title="No rooms yet"
      />
    );
  }

  const photoLabel = name.trim() || 'This toy';
  /** Only the spots of the room chosen right now, so switching rooms never shows the old room's spots. */
  const spotsForRoom = storageSpots.filter((spot) => spot.roomId === roomId);

  return (
    <View style={styles.form}>
      <Card style={styles.photoCard}>
        <FieldLabel>Photo</FieldLabel>
        <View style={styles.photoFrame}>
          <ToyPhoto label={photoLabel} rounded uri={imageUri} />
        </View>
        <View style={styles.photoButtons}>
          <SecondaryButton
            icon={CameraIcon}
            label="Take Photo"
            onPress={() => {
              void takePhoto();
            }}
            style={styles.photoButton}
          />
          <SecondaryButton
            label="Choose Photo"
            onPress={() => {
              void choosePhoto();
            }}
            style={styles.photoButton}
          />
        </View>
        {imageUri ? (
          <QuietButton
            accessibilityLabel={`Remove photo of ${photoLabel}`}
            icon={TrashIcon}
            label="Remove Photo"
            onPress={() => setImageUri(null)}
            style={styles.removePhoto}
          />
        ) : (
          <Caption>A photo is optional, but it is how your child recognises the toy.</Caption>
        )}
        {photoError ? <ErrorText>{photoError}</ErrorText> : null}
      </Card>

      <TintPanel style={styles.panel} tint="peach">
        <TextField
          error={validationErrors.name}
          label="Toy name"
          onChangeText={(value) => {
            setName(value);
            setValidationErrors((current) => ({ ...current, name: undefined }));
          }}
          placeholder="e.g. Magnetic Tile Set"
          value={name}
        />

        <View style={styles.field}>
          <FieldLabel>Room</FieldLabel>
          <View style={styles.pills}>
            {rooms.map((room) => (
              <SelectPill
                key={room.id}
                label={room.name}
                onPress={() => selectRoom(room.id)}
                selected={room.id === roomId}
              />
            ))}
          </View>
          {validationErrors.roomId ? <ErrorText>{validationErrors.roomId}</ErrorText> : null}
        </View>

        <View style={styles.field}>
          <FieldLabel>Storage spot</FieldLabel>
          {roomId === null ? (
            <Caption>Choose a room first.</Caption>
          ) : spotsForRoom.length === 0 ? (
            <View style={styles.emptySpots}>
              <Caption>This room has no storage spots yet.</Caption>
              <QuietButton
                icon={PlusIcon}
                label="Add storage spot"
                onPress={() => router.push(`/parent/add-location?type=storage&roomId=${roomId}`)}
                style={styles.inlineAction}
              />
            </View>
          ) : (
            <View style={styles.pills}>
              {spotsForRoom.map((spot) => (
                <SelectPill
                  key={spot.id}
                  label={spot.name}
                  onPress={() => {
                    setStorageSpotId(spot.id);
                    setValidationErrors((current) => ({ ...current, storageSpotId: undefined }));
                  }}
                  selected={spot.id === storageSpotId}
                />
              ))}
            </View>
          )}
          {validationErrors.storageSpotId ? <ErrorText>{validationErrors.storageSpotId}</ErrorText> : null}
        </View>

        <View style={styles.field}>
          <FieldLabel>Play categories</FieldLabel>
          <Caption>Pick every kind of play this toy suits.</Caption>
          <View style={styles.pills}>
            {PLAY_CATEGORIES.map((category) => (
              <SelectPill
                key={category}
                label={playCategoryLabel(category)}
                onPress={() => toggleCategory(category)}
                role="checkbox"
                selected={categories.includes(category)}
              />
            ))}
          </View>
          {validationErrors.categories ? <ErrorText>{validationErrors.categories}</ErrorText> : null}
        </View>

        <ToggleRow
          description="Hidden toys stay in your library but are never suggested in Child Mode."
          onValueChange={setIsAvailable}
          title="Available to my child"
          value={isAvailable}
        />

        {loadError ? <ErrorText>{loadError}</ErrorText> : null}
        {saveError ? <ErrorText>{saveError}</ErrorText> : null}

        <PrimaryButton
          disabled={saving}
          label={saving ? 'Saving…' : submitLabel}
          onPress={() => {
            void submit();
          }}
          style={styles.submit}
        />
      </TintPanel>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  emptySpots: { alignItems: 'flex-start', gap: spacing.sm },
  field: { gap: 6 },
  fieldLabel: { color: colors.textPrimary, fontSize: fontSizes.label, fontWeight: '700' },
  form: { gap: spacing.xl },
  inlineAction: { alignSelf: 'flex-start' },
  loading: { minHeight: 160 },
  panel: { gap: spacing.xl },
  photoButton: { flexGrow: 1, flexShrink: 1 },
  photoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  photoCard: { gap: spacing.md },
  photoFrame: {
    alignSelf: 'center',
    borderColor: colors.border,
    borderRadius: radii.hero,
    borderWidth: 1,
    maxWidth: 320,
    overflow: 'hidden',
    width: '100%',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  removePhoto: { alignSelf: 'flex-start' },
  submit: { marginTop: spacing.xs },
});
