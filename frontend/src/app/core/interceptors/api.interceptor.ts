import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NoticeService } from '../../services/notice.service';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const notice = inject(NoticeService);
  if (!request.url.startsWith('/api/')) return next(request);
  const token = auth.session()?.token;
  if (token && !request.headers.has('Authorization')) request = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(request).pipe(catchError((error: HttpErrorResponse) => {
    if (error.status === 401 && auth.session()) {
      auth.logout();
      notice.show('Your demo session could not be verified. Sign in again and check that the backend uses Development mode.', 'error');
    }
    return throwError(() => error);
  }));
};
