import { handleAuthRoute, readString, requireBearer } from '@/server/auth/route-support';

/** Confirms the current password before a sensitive action. */
export async function POST(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, bearerToken, service, requestId }) => {
    await service.reauthenticate(requireBearer(bearerToken, requestId), readString(body.password));
    return { status: 204 };
  });
}
