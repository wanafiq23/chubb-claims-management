import { HttpErrorResponse } from '@angular/common/http';
export function apiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  if (error.status === 0 || error.status === 502 || error.status === 504) return 'The claims service is unavailable. Check that the backend is running, then try again.';
  if (error.status === 401) return 'Sign-in was not accepted. The backend must be running in Development mode with demo authentication enabled.';
  if (error.status === 403) return 'Your role does not have permission to perform this action.';
  if (error.status === 404) return 'This claim or document was not found, or you do not have access to it.';
  if (error.status === 412) return 'This claim changed since you opened it. Reload the current claim before making another change.';
  if (error.status === 409) return `${error.error?.detail ?? 'The claim state changed or the database is busy.'} Reload the current claim before retrying.`;
  if (error.status === 428) return 'The claim version is missing. Reload the current claim before retrying.';
  if (error.status === 413) return 'The upload is too large. Use at most five files, each no larger than 5 MiB.';
  const body = error.error;
  if (body?.errors) return Object.values(body.errors).flat().join(' ');
  return body?.detail ?? body?.title ?? `The request could not be completed (${error.status}).`;
}
export function isConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && [409, 412, 428].includes(error.status);
}
