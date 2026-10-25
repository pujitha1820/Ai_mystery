export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function errorResponse(error) {
  const status = Number(error.status) || 500;
  const code = error.code || (status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR');
  const message = status >= 500 && !error.code ? 'An unexpected server error occurred. Please try again.' : error.message;
  return { status, body: { success: false, error: { code, message } } };
}
