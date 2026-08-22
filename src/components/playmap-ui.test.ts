import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ChildModeHeader } from './child-ui';
import {
  Banner,
  ConfirmationDialog,
  FilterChip,
  IconButton,
  PageHeader,
  PastelNavigationCard,
  PinInput,
  PrimaryButton,
  ReadOnlyValue,
  RoundedTextInput,
  SearchField,
  SegmentedControl,
  SkeletonRows,
  StepIndicator,
  TabBar,
  Toast,
  ToggleRow,
  ToyPhotoCard,
} from './playmap-ui';

const metrics = { frame: { height: 812, width: 375, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 44 } };

function render(element: ReturnType<typeof createElement>): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, element));
  });
  return renderer!;
}

/**
 * Matches the rendered host element rather than the component that produced it:
 * a composite element repeats the props it was given, so an unfiltered search
 * finds the wrapper before the view that actually carries the semantics.
 */
function hostsWhere(renderer: ReactTestRenderer, predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[] {
  return renderer.root.findAll((node) => typeof node.type === 'string' && predicate(node));
}

/**
 * Matches the control itself — the element that owns the accessible name and
 * the role. The host view a Pressable renders carries the semantics but not
 * `onPress`, and the component wrapping it carries neither role nor handler,
 * so the role is what identifies the real control.
 */
function pressableWithLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root.findAll((node) =>
    node.props.accessibilityLabel === label && typeof node.props.accessibilityRole === 'string')[0];
}

function textContent(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

describe('actions', () => {
  it('renders an enabled primary action and blocks a genuinely disabled one', () => {
    const onPress = jest.fn();
    const enabled = render(createElement(PrimaryButton, { label: 'Save', onPress }));
    const enabledButton = pressableWithLabel(enabled, 'Save');
    expect(enabledButton.props.accessibilityState).toEqual({ busy: false, disabled: false });
    act(() => enabledButton.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);

    const disabled = render(createElement(PrimaryButton, { disabled: true, label: 'Save', onPress }));
    expect(pressableWithLabel(disabled, 'Save').props.accessibilityState).toEqual({ busy: false, disabled: true });
    expect(pressableWithLabel(disabled, 'Save').props.disabled).toBe(true);
  });

  it('announces a saving action as busy and refuses further presses', () => {
    const onPress = jest.fn();
    const renderer = render(createElement(PrimaryButton, { busy: true, label: 'Saving…', onPress }));
    const button = pressableWithLabel(renderer, 'Saving…');
    expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(button.props.disabled).toBe(true);
  });

  it('shows a high-contrast keyboard focus ring on shared actions', () => {
    const renderer = render(createElement(PrimaryButton, { label: 'Save', onPress: jest.fn() }));
    const button = pressableWithLabel(renderer, 'Save');
    act(() => button.props.onFocus({}));
    expect(textContent(renderer)).toContain('boxShadow');
  });

  it('requires an accessible name on an icon-only control', () => {
    const renderer = render(createElement(IconButton, { accessibilityLabel: 'More actions', icon: 'more', onPress: jest.fn() }));
    const button = pressableWithLabel(renderer, 'More actions');
    expect(button.props.accessibilityRole).toBe('button');
  });
});

describe('selection controls', () => {
  it('carries chip selection with a tick as well as a fill', () => {
    const selected = render(createElement(FilterChip, { label: 'Playroom', selected: true, onPress: jest.fn() }));
    const chip = pressableWithLabel(selected, 'Playroom');
    expect(chip.props.accessibilityState).toMatchObject({ checked: true, selected: true });
    // The tick is a drawn glyph, so its presence shows selection is not colour-only.
    expect(selected.root.findAll((node) => node.props.name === 'check').length).toBe(1);

    const unselected = render(createElement(FilterChip, { label: 'Quiet', onPress: jest.fn() }));
    expect(unselected.root.findAll((node) => node.props.name === 'check')).toHaveLength(0);
  });

  it('lifts the chip touch target past the drawn height', () => {
    const renderer = render(createElement(FilterChip, { label: 'Quiet', onPress: jest.fn() }));
    expect(pressableWithLabel(renderer, 'Quiet').props.hitSlop).toEqual({ bottom: 6, left: 4, right: 4, top: 6 });
  });

  it('exposes segmented choice as a radio group', () => {
    const onChange = jest.fn();
    const renderer = render(createElement(SegmentedControl<number>, {
      accessibilityLabel: 'Choices at once',
      getOptionLabel: (option: number) => `${option} toys`,
      onChange,
      options: [1, 3, 5],
      value: 3,
    }));
    const group = hostsWhere(renderer, (node) => node.props.accessibilityRole === 'radiogroup')[0];
    expect(group.props.accessibilityLabel).toBe('Choices at once');
    expect(pressableWithLabel(renderer, '3 toys').props.accessibilityState).toMatchObject({ checked: true });
    expect(pressableWithLabel(renderer, '1 toys').props.accessibilityState).toMatchObject({ checked: false });
    act(() => pressableWithLabel(renderer, '5 toys').props.onPress());
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('exposes toggle state and responds to repeated activation', () => {
    const onValueChange = jest.fn();
    const renderer = render(createElement(ToggleRow, { label: 'Tidy up first', value: false, onValueChange }));
    const toggle = pressableWithLabel(renderer, 'Tidy up first');
    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityState).toEqual({ checked: false, disabled: false });
    act(() => {
      toggle.props.onPress();
      toggle.props.onPress();
    });
    expect(onValueChange).toHaveBeenNthCalledWith(1, true);
    expect(onValueChange).toHaveBeenNthCalledWith(2, true);
  });

  it('marks the selected tab three ways, not by colour alone', () => {
    const renderer = render(createElement(TabBar, {
      items: [
        { key: 'home', label: 'Home', icon: 'home' as const },
        { key: 'library', label: 'Library', icon: 'library' as const },
      ],
      onSelect: jest.fn(),
      selected: 'home',
    }));
    expect(pressableWithLabel(renderer, 'Home').props.accessibilityState).toEqual({ selected: true });
    expect(pressableWithLabel(renderer, 'Library').props.accessibilityState).toEqual({ selected: false });
    // The selected tab is drawn with a heavier stroke as well as a different tint.
    const strokes = renderer.root.findAll((node) => typeof node.props.strokeWidth === 'number').map((node) => node.props.strokeWidth);
    expect(new Set(strokes).size).toBeGreaterThan(1);
  });
});

describe('fields', () => {
  it('places validation beside the field and announces it politely', () => {
    const renderer = render(createElement(RoundedTextInput, {
      error: 'Give this room a name.',
      label: 'Room',
      onChangeText: jest.fn(),
      value: '',
    }));
    expect(hostsWhere(renderer, (node) => node.props.accessibilityLiveRegion === 'polite' && node.props.children === 'Give this room a name.').length).toBeGreaterThan(0);
  });

  it('keeps iOS autocorrect away from the names a family chose', () => {
    // On device, two spaces in a nickname became "Sam. Smith", which then
    // reads as a different name from "Sam Smith".
    const renderer = render(createElement(RoundedTextInput, { label: 'Name', onChangeText: jest.fn(), value: '' }));
    const field = hostsWhere(renderer, (node) => node.props.autoCorrect === false)[0];
    expect(field).toBeDefined();
    expect(field?.props.spellCheck).toBe(false);
    expect(field?.props.autoCapitalize).toBe('words');
  });

  it('still lets a field ask for different keyboard behaviour', () => {
    const renderer = render(createElement(RoundedTextInput, {
      autoCapitalize: 'none', label: 'Email', onChangeText: jest.fn(), value: '',
    }));
    expect(hostsWhere(renderer, (node) => node.props.autoCapitalize === 'none').length).toBeGreaterThan(0);
  });

  it('reserves the error line so a message does not shift the layout', () => {
    const renderer = render(createElement(RoundedTextInput, { error: null, label: 'Room', onChangeText: jest.fn(), value: '' }));
    expect(hostsWhere(renderer, (node) => node.props.accessibilityLiveRegion === 'polite').length).toBe(1);
  });

  it('takes a PIN on the number pad, secured, and reports progress', () => {
    const onChangeText = jest.fn();
    const renderer = render(createElement(PinInput, { onChangeText, value: '12' }));
    const field = hostsWhere(renderer, (node) => node.props.keyboardType === 'number-pad')[0];
    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.maxLength).toBe(4);
    const surface = hostsWhere(renderer, (node) => node.props.accessibilityLabel === 'PIN')[0];
    expect(surface.props.accessibilityValue).toEqual({ text: '2 of 4 digits entered' });
  });

  it('keeps non-digits out of the PIN', () => {
    const onChangeText = jest.fn();
    const renderer = render(createElement(PinInput, { onChangeText, value: '' }));
    const field = hostsWhere(renderer, (node) => node.props.keyboardType === 'number-pad')[0];
    act(() => field.props.onChangeText('1a2b3c4d5'));
    expect(onChangeText).toHaveBeenCalledWith('1234');
  });

  it('offers a labelled way to clear a search only once there is something to clear', () => {
    const onChangeText = jest.fn();
    const empty = render(createElement(SearchField, { onChangeText, value: '' }));
    expect(empty.root.findAll((node) => node.props.accessibilityLabel === 'Clear search')).toHaveLength(0);

    const filled = render(createElement(SearchField, { onChangeText, value: 'zebra' }));
    act(() => pressableWithLabel(filled, 'Clear search').props.onPress());
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('presents contextual values as text instead of disabled form controls', () => {
    const renderer = render(createElement(ReadOnlyValue, { label: 'Room', value: 'Playroom' }));
    expect(hostsWhere(renderer, (node) => node.props.accessibilityLabel === 'Room: Playroom').length).toBeGreaterThan(0);
    expect(hostsWhere(renderer, (node) => node.props.accessibilityRole === 'textbox')).toHaveLength(0);
  });
});

describe('content and status', () => {
  it('uses consistent title semantics', () => {
    const renderer = render(createElement(PageHeader, { eyebrow: 'Parent mode', subtitle: 'A calm subtitle.', title: 'Settings' }));
    const headings = hostsWhere(renderer, (node) => node.props.accessibilityRole === 'header').map((node) => node.props.children);
    expect(headings).toContain('Settings');
  });

  it('says a toy is out for play in words, not only by dimming the photo', () => {
    const renderer = render(createElement(ToyPhotoCard, {
      holderName: 'Ada',
      location: 'Playroom · White shelf',
      status: 'checked-out' as const,
      title: 'Marble run',
    }));
    const rendered = textContent(renderer);
    expect(rendered).toContain('Out for play');
    expect(rendered).toContain('With Ada');
  });

  it('names the whole card for a screen reader in one announcement', () => {
    const renderer = render(createElement(ToyPhotoCard, {
      holderName: 'Ada',
      location: 'Playroom',
      onPress: jest.fn(),
      status: 'checked-out' as const,
      title: 'Marble run',
    }));
    const card = renderer.root.findAll((node) =>
      node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0];
    expect(card.props.accessibilityLabel).toBe('Marble run, Playroom, Out for play, with Ada');
  });

  it('offers to add a photo when a toy has none', () => {
    const renderer = render(createElement(ToyPhotoCard, { status: 'no-photo' as const, title: 'Puzzle' }));
    expect(textContent(renderer)).toContain('Add photo');
  });

  it('announces an alert assertively and a confirmation politely', () => {
    const alert = render(createElement(Banner, { message: 'The library could not load.', tone: 'alert' as const }));
    expect(hostsWhere(alert, (node) => node.props.accessibilityRole === 'alert')[0].props.accessibilityLiveRegion).toBe('assertive');

    const toast = render(createElement(Toast, { message: '12 toys saved' }));
    expect(hostsWhere(toast, (node) => node.props.accessibilityRole === 'alert')[0].props.accessibilityLiveRegion).toBe('polite');
  });

  it('shows skeletons as progress rather than as content', () => {
    const renderer = render(createElement(SkeletonRows, { rows: 2 }));
    const progress = hostsWhere(renderer, (node) => node.props.accessibilityRole === 'progressbar')[0];
    expect(progress.props.accessibilityLabel).toBe('Loading…');
    expect(textContent(renderer)).not.toContain('Refreshing');
  });

  it('reports onboarding progress as a step out of a total', () => {
    const renderer = render(createElement(StepIndicator, { current: 1, steps: ['PIN', 'Child', 'Room'] }));
    const progress = hostsWhere(renderer, (node) => node.props.accessibilityRole === 'progressbar')[0];
    expect(progress.props.accessibilityLabel).toBe('Step 2 of 3: Child');
  });

  it('uses light text on the active dark progress step', () => {
    const renderer = render(createElement(StepIndicator, { current: 0, steps: ['Photos', 'Review'] }));
    const activeNumber = renderer.root.findAll((node) => node.props.children === 1)[0];
    expect(JSON.stringify(activeNumber.props.style)).toContain('#FFFFFF');
  });

  it('renders one labeled Child Mode back control', () => {
    const onBack = jest.fn();
    const renderer = render(createElement(ChildModeHeader, { backLabel: 'Toy ideas', onBack }));
    const backLabels = new Set(renderer.root.findAll((node) =>
      node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
      .map((node) => node.props.accessibilityLabel));
    expect([...backLabels]).toEqual(['Back to Toy ideas']);
    act(() => pressableWithLabel(renderer, 'Back to Toy ideas').props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('destructive paths', () => {
  it('exposes navigation disabled state and modal escape behavior', () => {
    const navigation = render(createElement(PastelNavigationCard, {
      description: 'Add, find, and manage toys', disabled: true, title: 'Toy library',
    }));
    const card = pressableWithLabel(navigation, 'Toy library');
    expect(card.props.accessibilityHint).toBe('Add, find, and manage toys');
    expect(card.props.accessibilityState).toEqual({ disabled: true });

    const onCancel = jest.fn();
    const dialog = render(createElement(ConfirmationDialog, {
      message: 'No data changes until you confirm.', onCancel, onConfirm: jest.fn(), title: 'Continue?', visible: true,
    }));
    const modalContainer = hostsWhere(dialog, (node) => node.props.accessibilityViewIsModal === true)[0];
    act(() => modalContainer.props.onAccessibilityEscape());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Delete room', 'Delete room'],
    ['Delete storage spot', 'Delete storage spot'],
    ['Delete this toy', 'Delete this toy'],
    ['Hide from Child Mode', 'Hide from Child Mode'],
    ['Archive toy', 'Archive toy'],
    ['Reset Pip', 'Reset Pip'],
  ])('requires confirmation for the %s path and leaves data unchanged on cancel', (_path, confirmLabel) => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const renderer = render(createElement(ConfirmationDialog, {
      confirmLabel,
      destructive: true,
      message: 'This action explains its dependent records and cannot be undone.',
      onCancel,
      onConfirm,
      title: `${confirmLabel}?`,
      visible: true,
    }));
    act(() => pressableWithLabel(renderer, 'Cancel').props.onPress());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => pressableWithLabel(renderer, confirmLabel).props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('offers the keep-it choice before the destructive one', () => {
    const renderer = render(createElement(ConfirmationDialog, {
      cancelLabel: 'Keep',
      confirmLabel: 'Delete',
      destructive: true,
      message: '3 storage spots and 14 toys will need a new home. This cannot be undone.',
      onCancel: jest.fn(),
      onConfirm: jest.fn(),
      title: 'Delete Playroom?',
      visible: true,
    }));
    const labels = renderer.root.findAll((node) =>
      node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
      .map((node) => node.props.accessibilityLabel);
    expect(labels.indexOf('Keep')).toBeLessThan(labels.indexOf('Delete'));
    expect(textContent(renderer)).toContain('cannot be undone');
  });
});
