import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Role } from '../../models/claims';

export interface DemoSession { role: Role; token: string; name: string; }
const accounts: Record<Role, DemoSession> = {
  Customer: { role: 'Customer', token: 'customer-alice', name: 'Alice' },
  Staff: { role: 'Staff', token: 'staff-demo', name: 'Claims Staff' },
  Manager: { role: 'Manager', token: 'manager-demo', name: 'Manager' }
};
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly session = signal<DemoSession | null>(this.restore());
  readonly role = computed(() => this.session()?.role ?? null);
  readonly home = computed(() => this.homeFor(this.role()));
  homeFor(role: Role | null): string { return role ? '/' + role.toLowerCase() : '/login'; }
  private restore(): DemoSession | null {
    try {
      const role = sessionStorage.getItem('chubb-demo-role') as Role;
      return Object.hasOwn(accounts, role) ? accounts[role] : null;
    } catch { return null; }
  }
  async login(role: Role): Promise<void> {
    const account = accounts[role];
    const endpoint = role === 'Customer' ? '/api/claims?pageSize=1' : role === 'Staff' ? '/api/staff/workload' : '/api/manager/outstanding';
    // No invented login endpoint: validate the backend's fixed demo token with a role-protected read.
    await firstValueFrom(this.http.get(endpoint, { headers: new HttpHeaders({ Authorization: `Bearer ${account.token}` }) }));
    this.session.set(account);
    try { sessionStorage.setItem('chubb-demo-role', role); } catch { /* In-memory session still works. */ }
  }
  logout(): void {
    this.session.set(null);
    try { sessionStorage.removeItem('chubb-demo-role'); } catch { /* Storage may be disabled. */ }
    void this.router.navigateByUrl('/login');
  }
}
