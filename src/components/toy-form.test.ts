import { createElement } from 'react';
import { TextInput } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import type { Room, StorageSpot } from '@/domain/models';
import { ToyForm } from './toy-form';

const mockInitializeDatabase = jest.fn(async () => ({}));
const mockListRooms = jest.fn<Promise<Room[]>, []>();
const mockListStorageSpots = jest.fn<Promise<StorageSpot[]>, [unknown, number]>();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  useCameraPermissions: () => [{ granted: false }, jest.fn()],
  useMediaLibraryPermissions: () => [{ granted: false }, jest.fn()],
}));

jest.mock('@/database/client', () => ({
  initializeDatabase: () => mockInitializeDatabase(),
}));

jest.mock('@/repositories/rooms-repository', () => ({
  listRooms: () => mockListRooms(),
  listStorageSpots: (database: unknown, roomId: number) => mockListStorageSpots(database, roomId),
}));

const room: Room = {
  id: 1,
  name: 'Playroom',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const spot: StorageSpot = {
  id: 2,
  roomId: room.id,
  name: 'Blue Bin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function renderForm(onSubmit = jest.fn(async () => undefined)): Promise<{
  onSubmit: jest.Mock;
  renderer: ReactTestRenderer;
}> {
  mockListRooms.mockResolvedValue([room]);
  mockListStorageSpots.mockResolvedValue([spot]);
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(createElement(ToyForm, { onSubmit, submitLabel: 'Add Toy' }));
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { onSubmit, renderer: renderer! };
}

function control(
  renderer: ReactTestRenderer,
  label: string,
  handler: 'onPress' | 'onChangeText' = 'onPress',
): ReactTestInstance {
  if (handler === 'onChangeText') return renderer.root.findByType(TextInput);
  const matches = renderer.root.findAll(
    (node) =>
      node.props.accessibilityLabel === label &&
      typeof node.props[handler] === 'function' &&
      node.props.accessibilityRole !== undefined,
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe('ToyForm validation and submission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders useful field errors and blocks an invalid submission', async () => {
    const { onSubmit, renderer } = await renderForm();

    await act(async () => {
      control(renderer, 'Add Toy').props.onPress();
    });

    const errors = renderer.root
      .findAll((node) => node.props.accessibilityLiveRegion === 'polite')
      .map((node) => node.props.children);
    expect(errors).toEqual(expect.arrayContaining([
      'Enter a name for this toy.',
      'Choose the room where this toy belongs.',
      'Choose the storage spot where this toy belongs.',
      'Choose at least one play category.',
    ]));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid toy without requiring a photo', async () => {
    const { onSubmit, renderer } = await renderForm();

    act(() => {
      control(renderer, 'Toy name', 'onChangeText').props.onChangeText('Magnetic Tiles');
      control(renderer, 'Playroom').props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      control(renderer, 'Blue Bin').props.onPress();
      control(renderer, 'Building').props.onPress();
    });
    await act(async () => {
      control(renderer, 'Add Toy').props.onPress();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      categories: ['building'],
      imageUri: null,
      isAvailable: true,
      name: 'Magnetic Tiles',
      roomId: 1,
      storageSpotId: 2,
    });
  });
});
