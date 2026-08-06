import { EarlyAccessService, EarlyAccessValidationError } from '@/server/early-access/early-access-service';

/**
 * Records an early-access address.
 *
 * Always answers 202 for a well-formed request, whether or not the address was
 * already on the list, so the endpoint cannot be used to test addresses.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = { 'x-request-id': requestId, 'cache-control': 'no-store' };

  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed !== null && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    const result = await new EarlyAccessService().register({
      email: typeof body.email === 'string' ? body.email : '',
      acceptedUpdates: body.acceptedUpdates === true,
      honeypot: typeof body.company === 'string' ? body.company : undefined,
    });
    return Response.json(result, { status: 202, headers });
  } catch (caught: unknown) {
    if (caught instanceof EarlyAccessValidationError) {
      return Response.json({ error: { code: 'INVALID_REQUEST', message: caught.message, requestId } }, { status: 400, headers });
    }
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again shortly.', requestId } },
      { status: 500, headers },
    );
  }
}
