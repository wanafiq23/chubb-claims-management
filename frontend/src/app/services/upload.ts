import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { OperatorFunction, filter, pipe, tap } from 'rxjs';

/** Keep multipart field names and browser-generated boundaries consistent. */
export function documentForm(files: File[], text?: string): FormData {
  const form = new FormData();
  if (text !== undefined) form.append('text', text);
  files.forEach(file => form.append('files', file, file.name));
  return form;
}

/** Wait for the response while forwarding real, optionally indeterminate progress. */
export function uploadResponse<T>(progress: (percent: number | null) => void): OperatorFunction<HttpEvent<T>, HttpResponse<T>> {
  return pipe(
    tap(event => {
      if (event.type === HttpEventType.UploadProgress) {
        progress(event.total ? Math.round(event.loaded * 100 / event.total) : null);
      }
    }),
    filter((event): event is HttpResponse<T> => event.type === HttpEventType.Response)
  );
}
