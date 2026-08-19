/* eslint-disable import/first */

jest.mock('expo-router', () => {
  const { useEffect } = require('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    // Focus is not modelled; running the effect once matches a screen opened
    // and left open, which is what these assertions are about.
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
  };
});

jest.mock('@/database/client', () => ({ initializeDatabase: jest.fn() }));
jest.mock('@/features/auth/auth-client', () => ({ signOut: jest.fn() }));
jest.mock('@/features/account/export-service', () => ({
  buildHouseholdExport: jest.fn(),
  exportFileName: jest.fn(() => 'pip.json'),
  serialiseExport: jest.fn(() => '{}'),
}));

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { initializeDatabase } from '@/database/client';
import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import { signOut } from '@/features/auth/auth-client';
import { backUpHouseholdToAccount } from '@/features/household/household-scope';
import { clearSession, resetSessionStateForTests, setAuthenticatedSession } from '@/features/auth/session-state';

import AccountRoute from '@/app/(parent)/parent/account';

const metrics = { frame: { height: 852, width: 393, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 59 } };
const ACCOUNT = 'account-a';

let database: DatabaseConnection;

async function renderScreen(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, createElement(AccountRoute)));
  });
  return renderer!;
}

function buttons(renderer: ReactTestRenderer, label: string): ReactTestInstance[] {
  // Both the component and its host Pressable carry the label; only one of them
  // is actually pressable.
  return renderer.root.findAll((node) =>
    node.props.accessibilityLabel === label
    && node.props.accessibilityRole === 'button'
    && typeof node.props.onPress === 'function',
  );
}

function button(renderer: ReactTestRenderer, label: string): ReactTestInstance | null {
  return buttons(renderer, label)[0] ?? null;
}

/**
 * The dialog's confirm button, when it shares a label with the card button that
 * opened it — "Sign out" appears twice on purpose, and the dialog renders last.
 */
function confirmButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const found = buttons(renderer, label).at(-1);
  if (!found) throw new Error(`Missing confirmation control: ${label}`);
  return found;
}

function requireButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const found = button(renderer, label);
  if (!found) throw new Error(`Missing control: ${label}`);
  return found;
}

/** Every literal string rendered anywhere on screen, deduplicated. */
function textContent(renderer: ReactTestRenderer): string {
  const seen = new Set<string>();
  for (const node of renderer.root.findAll(() => true)) {
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      if (typeof child === 'string') seen.add(child);
    }
  }
  return [...seen].join(' | ');
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetSessionStateForTests();
  database = new RealSqliteConnection();
  await runMigrations(database);
  (initializeDatabase as jest.Mock).mockResolvedValue(database);
  (signOut as jest.Mock).mockResolvedValue(undefined);
});

describe('account surface when signed out', () => {
  beforeEach(() => clearSession());

  it('says so plainly and offers both ways in', async () => {
    const renderer = await renderScreen();

    expect(textContent(renderer)).toContain('Not signed in');
    expect(button(renderer, 'Sign in')).not.toBeNull();
    expect(button(renderer, 'Create an account')).not.toBeNull();
    expect(button(renderer, 'Sign out')).toBeNull();
  });

  it('says an account is not required, because it is not', async () => {
    const renderer = await renderScreen();

    expect(textContent(renderer)).toContain('You do not need an account');
  });

  it('never claims backup or another device works', async () => {
    const renderer = await renderScreen();
    const copy = textContent(renderer);

    expect(copy).toContain('not available yet');
    expect(copy).not.toMatch(/your library is backed up|safely stored|available on your other/i);
  });
});

describe('account surface when signed in', () => {
  beforeEach(() => {
    setAuthenticatedSession({ accountId: ACCOUNT, email: 'parent@example.test', emailVerified: true });
  });

  it('shows the authenticated email and the account actions', async () => {
    const renderer = await renderScreen();

    expect(textContent(renderer)).toContain('parent@example.test');
    expect(button(renderer, 'Sign out')).not.toBeNull();
    expect(button(renderer, 'Switch account')).not.toBeNull();
    expect(button(renderer, 'Sign in')).toBeNull();
  });

  it('asks before signing out rather than doing it on the first tap', async () => {
    const renderer = await renderScreen();

    await act(async () => requireButton(renderer, 'Sign out').props.onPress());

    expect(signOut).not.toHaveBeenCalled();
    expect(textContent(renderer)).toContain('Sign out of Pip?');
  });

  it('cancelling leaves the session alone', async () => {
    const renderer = await renderScreen();
    await act(async () => requireButton(renderer, 'Sign out').props.onPress());

    await act(async () => requireButton(renderer, 'Stay signed in').props.onPress());

    expect(signOut).not.toHaveBeenCalled();
  });

  it('spells out that a linked library is hidden, not deleted', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);
    const renderer = await renderScreen();

    await act(async () => requireButton(renderer, 'Sign out').props.onPress());

    const copy = textContent(renderer);
    expect(copy).toContain('hidden until you sign in again');
    expect(copy).toContain('nothing is deleted');
  });

  it('keeps the parent in Pip after signing out instead of demanding they sign in again', async () => {
    const renderer = await renderScreen();
    await act(async () => requireButton(renderer, 'Sign out').props.onPress());

    await act(async () => confirmButton(renderer, 'Sign out').props.onPress());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalledWith('/sign-in');
    expect(textContent(renderer)).toContain('still on this device');
  });

  it('sends the parent to sign-in only when they chose to switch accounts', async () => {
    const renderer = await renderScreen();
    await act(async () => requireButton(renderer, 'Switch account').props.onPress());

    await act(async () => requireButton(renderer, 'Continue').props.onPress());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('offers a retry in place when signing out fails', async () => {
    (signOut as jest.Mock).mockRejectedValue(new Error('Network unreachable.'));
    const renderer = await renderScreen();
    await act(async () => requireButton(renderer, 'Sign out').props.onPress());

    await act(async () => confirmButton(renderer, 'Sign out').props.onPress());

    const copy = textContent(renderer);
    expect(copy).toContain('Network unreachable.');
    // The dialog is still up, so the parent can try again without finding it.
    expect(copy).toContain('Sign out of Pip?');
  });

  it('does not sign out twice when the confirmation is double-tapped', async () => {
    let release: (() => void) | undefined;
    (signOut as jest.Mock).mockReturnValue(new Promise<void>((resolve) => { release = () => resolve(); }));
    const renderer = await renderScreen();
    await act(async () => requireButton(renderer, 'Sign out').props.onPress());

    const confirm = confirmButton(renderer, 'Sign out');
    await act(async () => {
      confirm.props.onPress();
      confirm.props.onPress();
    });
    await act(async () => { release?.(); });

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
