import { AiApplicationError, safeErrorBody } from '@/server/ai/errors';
import { issueInstallationCredential } from '@/server/ai/installation-service';

export async function POST(): Promise<Response> {
  const requestId = crypto.randomUUID();
  try { return Response.json(await issueInstallationCredential(), { status: 201, headers: { 'x-request-id': requestId } }); }
  catch { const error = new AiApplicationError('CREDENTIAL_ISSUANCE_FAILED', requestId); return Response.json(safeErrorBody(error), { status: error.status }); }
}
