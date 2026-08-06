import { handleAuthRoute, readString, requireBearer } from '@/server/auth/route-support';

/**
 * Names the household.
 *
 * The household id is read from the request but re-checked against the
 * session's memberships, so supplying someone else's id is rejected.
 */
export async function PATCH(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, bearerToken, service, requestId }) => ({
    status: 200,
    body: await service.renameHousehold(
      requireBearer(bearerToken, requestId),
      readString(body.householdId),
      readString(body.name),
    ),
  }));
}
