import { handleAuthRoute, requireBearer } from '@/server/auth/route-support';

/** Restores a stored session on launch. */
export async function GET(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ bearerToken, service, requestId }) => ({
    status: 200,
    body: await service.authenticate(requireBearer(bearerToken, requestId)),
  }));
}

/** Signs out. Local data is untouched. */
export async function DELETE(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ bearerToken, service }) => {
    if (bearerToken) await service.signOut(bearerToken);
    return { status: 204 };
  });
}
