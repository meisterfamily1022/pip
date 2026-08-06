import { handleAuthRoute, requireBearer } from '@/server/auth/route-support';

/**
 * Deletes the parent account.
 *
 * Requires a recent password confirmation, enforced in the service, so a valid
 * session alone is not enough. Local data on the device is untouched.
 */
export async function DELETE(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ bearerToken, service, requestId }) => ({
    status: 200,
    body: await service.deleteAccount(requireBearer(bearerToken, requestId)),
  }));
}
