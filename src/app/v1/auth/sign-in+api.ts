import { handleAuthRoute, readString } from '@/server/auth/route-support';

export async function POST(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, service }) => ({
    status: 200,
    body: await service.signIn(readString(body.email), readString(body.password)),
  }));
}
