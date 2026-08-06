import { AuthService } from './auth-service';
import { AuthApplicationError, safeAuthErrorBody } from './errors';

/**
 * Shared plumbing for the auth routes, so each handler stays a few lines like
 * the existing AI routes.
 */

export type AuthRouteHandler = (input: {
  body: Record<string, unknown>;
  bearerToken: string | null;
  service: AuthService;
  requestId: string;
}) => Promise<{ status: number; body?: unknown }>;

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (request.method === 'GET' || request.method === 'DELETE') return {};
  try {
    const parsed: unknown = await request.json();
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const readString = asString;

export const readBoolean = (value: unknown): boolean => value === true;

/**
 * Runs a handler and converts any failure into the normalised error body.
 *
 * Unexpected errors become INTERNAL_ERROR: an exception message could carry
 * storage detail or an address, and none of that belongs in a response.
 */
export async function handleAuthRoute(request: Request, handler: AuthRouteHandler): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = { 'x-request-id': requestId, 'cache-control': 'no-store' };

  try {
    const result = await handler({
      body: await readJsonBody(request),
      bearerToken: bearerToken(request),
      service: new AuthService({ requestId }),
      requestId,
    });
    return result.body === undefined
      ? new Response(null, { status: result.status, headers })
      : Response.json(result.body, { status: result.status, headers });
  } catch (caught: unknown) {
    const error =
      caught instanceof AuthApplicationError ? caught : new AuthApplicationError('INTERNAL_ERROR', requestId);
    return Response.json(safeAuthErrorBody(error), { status: error.status, headers });
  }
}

/** Requires a bearer token, so handlers do not each repeat the check. */
export function requireBearer(token: string | null, requestId: string): string {
  if (!token) throw new AuthApplicationError('SESSION_INVALID', requestId);
  return token;
}
