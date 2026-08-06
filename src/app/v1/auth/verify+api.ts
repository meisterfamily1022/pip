import { handleAuthRoute, readString } from '@/server/auth/route-support';

/** Confirms a six-digit code and starts a session. */
export async function POST(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, service }) => ({
    status: 200,
    body: await service.verifyEmail(readString(body.email), readString(body.code)),
  }));
}

/** Re-sends a code. Always 202, so it cannot be used to probe addresses. */
export async function PUT(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, service }) => {
    await service.resendVerification(readString(body.email));
    return { status: 202 };
  });
}
