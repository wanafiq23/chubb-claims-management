import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, expand, map, reduce } from 'rxjs';
import { CustomerClaim, InternalClaim, Page, Submission, normalizeClaim } from '../models/claims';
@Injectable({ providedIn: 'root' })
export class ClaimsService {
  private http = inject(HttpClient);
  mine(page = 1, pageSize = 20) { return this.http.get<Page<CustomerClaim>>('/api/claims', { params: { page, pageSize } }); }
  allMine() {
    return this.mine(1, 100).pipe(
      expand(page => page.page * page.pageSize < page.total ? this.mine(page.page + 1, 100) : EMPTY),
      reduce((all, page) => [...all, ...page.items], [] as CustomerClaim[])
    );
  }
  queue(page = 1, pageSize = 20) { return this.http.get<Page<InternalClaim>>('/api/staff/queue', { params: { page, pageSize } }); }
  get(id: string) { return this.http.get<CustomerClaim | InternalClaim>(`/api/claims/${encodeURIComponent(id)}`).pipe(map(normalizeClaim)); }
  submit(body: Submission) { return this.http.post<CustomerClaim>('/api/claims', body); }
}
export const versionHeaders = (version: string) => ({ 'If-Match': `"${version}"` });
