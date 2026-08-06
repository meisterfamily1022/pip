import { handleAuthRoute, readString } from '@/server/auth/route-support';

/**
 * Starts a reset. Always 202 whether or not the address has an account, so the
 * response cannot be used to discover registered addresses.
 */
export async function POST(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, service }) => {
    await service.requestPasswordReset(readString(body.email));
    return { status: 202 };
  });
}

/** Completes a reset and revokes every existing session. */
export async function PUT(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, service }) => {
    await service.resetPassword(readString(body.token), readString(body.password));
    return { status: 204 };
  });
}
