import type { ToyAnalysisResponse } from './contracts';

export const MOCK_SCAN_ALLOWANCE = 10;

export type Reservation = { installationToken: string; requestId: string };

export interface UsageQuota {
  reserve(reservation: Reservation): Promise<'reserved' | 'duplicate' | 'exhausted'>;
  complete(reservation: Reservation, result: ToyAnalysisResponse): Promise<void>;
  failAfterProvider(reservation: Reservation): Promise<void>;
  releaseBeforeProvider(reservation: Reservation): Promise<void>;
  getResult(reservation: Reservation): ToyAnalysisResponse | undefined;
}

type InstallationState = {
  used: number;
  reserved: Set<string>;
  results: Map<string, ToyAnalysisResponse>;
};

/** In-memory beta/test adapter. State is intentionally lost on server restart. */
export class InMemoryUsageQuota implements UsageQuota {
  private readonly states = new Map<string, InstallationState>();

  private state(token: string): InstallationState {
    let state = this.states.get(token);
    if (!state) {
      state = { used: 0, reserved: new Set(), results: new Map() };
      this.states.set(token, state);
    }
    return state;
  }

  async reserve({ installationToken, requestId }: Reservation) {
    const state = this.state(installationToken);
    if (state.results.has(requestId) || state.reserved.has(requestId)) return 'duplicate' as const;
    if (state.used + state.reserved.size >= MOCK_SCAN_ALLOWANCE) return 'exhausted' as const;
    state.reserved.add(requestId);
    return 'reserved' as const;
  }

  async complete({ installationToken, requestId }: Reservation, result: ToyAnalysisResponse) {
    const state = this.state(installationToken);
    state.reserved.delete(requestId);
    state.used += 1;
    state.results.set(requestId, result);
  }

  async failAfterProvider({ installationToken, requestId }: Reservation) {
    const state = this.state(installationToken);
    state.reserved.delete(requestId);
    state.used += 1;
  }

  async releaseBeforeProvider({ installationToken, requestId }: Reservation) {
    this.state(installationToken).reserved.delete(requestId);
  }

  getResult({ installationToken, requestId }: Reservation) {
    return this.state(installationToken).results.get(requestId);
  }

  getUsed(token: string) {
    return this.state(token).used;
  }
}
