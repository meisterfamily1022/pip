import type { ToyFormInput } from './toy-service';
import { validateToyForm } from './toy-service';

const validToy: ToyFormInput = {
  categories: ['building'],
  imageUri: null,
  isAvailable: true,
  name: 'Magnetic Tiles',
  roomId: 1,
  storageSpotId: 2,
};

describe('toy form validation', () => {
  it('accepts a valid toy without a photo', () => {
    expect(validateToyForm(validToy)).toEqual({});
  });

  it.each([
    ['name', { name: '  ' }, 'Enter a name for this toy.'],
    ['roomId', { roomId: null }, 'Choose the room where this toy belongs.'],
    ['storageSpotId', { storageSpotId: null }, 'Choose the storage spot where this toy belongs.'],
  ] as const)('reports a missing %s', (field, override, message) => {
    expect(validateToyForm({ ...validToy, ...override })).toMatchObject({ [field]: message });
  });

  it('reports all invalid fields in one pass', () => {
    expect(validateToyForm({
      ...validToy,
      categories: [],
      name: '',
      roomId: null,
      storageSpotId: null,
    })).toEqual({
      categories: 'Choose at least one play category.',
      name: 'Enter a name for this toy.',
      roomId: 'Choose the room where this toy belongs.',
      storageSpotId: 'Choose the storage spot where this toy belongs.',
    });
  });
});
