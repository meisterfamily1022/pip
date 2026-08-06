import { handleAuthRoute, readBoolean, readString } from '@/server/auth/route-support';

export async function POST(request: Request): Promise<Response> {
  return handleAuthRoute(request, async ({ body, service }) => ({
    status: 202,
    body: await service.signUp({
      email: readString(body.email),
      firstName: readString(body.firstName),
      password: readString(body.password),
      householdName: readString(body.householdName) || undefined,
      acceptedTerms: readBoolean(body.acceptedTerms),
    }),
  }));
}
