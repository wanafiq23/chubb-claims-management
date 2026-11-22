import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Role } from '../../models/claims';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.session() ? true : inject(Router).parseUrl('/login');
};
export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const roles = route.data['roles'] as Role[];
  if (!auth.session()) return inject(Router).parseUrl('/login');
  return roles.includes(auth.role()!) || inject(Router).parseUrl('/forbidden');
};
