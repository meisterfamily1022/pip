import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ChildModeHeader } from './child-ui';
import { ConfirmationDialog, PageHeader, PastelNavigationCard, PrimaryButton, ReadOnlyValue, RoundedTextInput, StepIndicator, ToggleRow } from './playmap-ui';

function render(element: ReturnType<typeof createElement>): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(element);
  });
  return renderer!;
}

function pressableWithLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root.findAll((node) => node.props.accessibilityLabel === label)[0];
}

describe('shared visual components', () => {
  it('renders an enabled primary action and blocks a genuinely disabled action', () => {
    const onPress = jest.fn();
    const enabled = render(createElement(PrimaryButton, { label: 'Save', onPress }));
    const enabledButton = pressableWithLabel(enabled, 'Save');
    expect(enabledButton.props.accessibilityState).toEqual({ disabled: false });
    act(() => enabledButton.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);

    const disabled = render(createElement(PrimaryButton, { disabled: true, label: 'Save', onPress }));
    expect(pressableWithLabel(disabled, 'Save').props.accessibilityState).toEqual({ disabled: true });
  });

  it('shows a high-contrast keyboard focus ring on shared actions', () => {
    const renderer = render(createElement(PrimaryButton, { label: 'Save', onPress: jest.fn() }));
    const button = pressableWithLabel(renderer, 'Save');
    act(() => button.props.onFocus({}));
    expect(JSON.stringify(renderer.toJSON())).toContain('boxShadow');
  });

  it('uses light text on active dark progress steps', () => {
    const renderer = render(createElement(StepIndicator, { current: 0, steps: ['Photos', 'Review'] }));
    const activeNumber = renderer.root.findAll((node) => node.props.children === 1)[0];
    expect(JSON.stringify(activeNumber.props.style)).toContain('#FFFFFF');
  });

  it('exposes toggle state and responds to repeated activation', () => {
    const onValueChange = jest.fn();
    const renderer = render(createElement(ToggleRow, { label: 'Available to child', value: false, onValueChange }));
    const toggle = pressableWithLabel(renderer, 'Available to child');
    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityState).toEqual({ checked: false, disabled: false });
    act(() => {
      toggle.props.onPress();
      toggle.props.onPress();
    });
    expect(onValueChange).toHaveBeenNthCalledWith(1, true);
    expect(onValueChange).toHaveBeenNthCalledWith(2, true);
  });

  it('renders one labeled Child Mode back control', () => {
    const onBack = jest.fn();
    const renderer = render(createElement(ChildModeHeader, { backLabel: 'Toy ideas', onBack }));
    const backLabels = new Set(renderer.root.findAll((node) => node.props.accessibilityRole === 'button').map((node) => node.props.accessibilityLabel));
    expect([...backLabels]).toEqual(['Back to Toy ideas']);
    const back = pressableWithLabel(renderer, 'Back to Toy ideas');
    act(() => back.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses consistent title semantics and nearby field validation', () => {
    const renderer = render(createElement(
      PageHeader,
      { eyebrow: 'PARENT MODE', subtitle: 'A calm subtitle.', title: 'Settings' },
    ));
    const headings = new Set(renderer.root.findAll((node) => node.props.accessibilityRole === 'header').map((node) => node.props.children));
    expect([...headings]).toContain('Settings');

    const field = render(createElement(RoundedTextInput, {
      error: 'PINs do not match.',
      label: 'Confirm new PIN',
      onChangeText: jest.fn(),
      value: '1234',
    }));
    expect(field.root.findAll((node) => node.props.accessibilityLiveRegion === 'polite' && node.props.children === 'PINs do not match.').length).toBeGreaterThan(0);
  });

  it('presents contextual values as text instead of disabled form controls', () => {
    const renderer = render(createElement(ReadOnlyValue, { label: 'Room', value: 'Playroom' }));
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Room: Playroom').length).toBeGreaterThan(0);
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === 'textbox')).toHaveLength(0);
  });

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
    const modalContainer = dialog.root.find((node) => node.props.accessibilityViewIsModal === true);
    act(() => modalContainer.props.onAccessibilityEscape());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Delete Room', 'Delete Room'],
    ['Delete Storage Spot', 'Delete Storage Spot'],
    ['Delete Toy', 'Delete Toy'],
    ['Hide Toy', 'Hide Toy'],
    ['Archive Toy', 'Archive Toy'],
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
});
