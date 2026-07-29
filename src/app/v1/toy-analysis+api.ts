import { safeErrorBody, AiApplicationError } from '@/server/ai/errors';
import { DurableToyAnalysisService } from '@/server/ai/durable-toy-analysis-service';

const defaultToyAnalysisService = new DurableToyAnalysisService();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<Response> {
  const headerRequestId = request.headers.get('x-request-id');
  const fallbackRequestId = headerRequestId && UUID.test(headerRequestId)
    ? headerRequestId
    : '00000000-0000-4000-8000-000000000000';
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const error = new AiApplicationError('INVALID_REQUEST', fallbackRequestId);
      return Response.json(safeErrorBody(error), { status: error.status });
    }

    const result = await defaultToyAnalysisService.analyze(body);
    return Response.json(result, { status: 200, headers: { 'x-request-id': result.requestId } });
  } catch (error) {
    const safeError = error instanceof AiApplicationError
      ? error
      : new AiApplicationError('INTERNAL_ERROR', fallbackRequestId);
    return Response.json(safeErrorBody(safeError), { status: safeError.status });
  }
}
