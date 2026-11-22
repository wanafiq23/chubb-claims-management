import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ClaimType, InternalClaim, OutstandingReport, Page, Workload } from '../models/claims';
@Injectable({ providedIn: 'root' })
export class StaffMetricsService {
  private http = inject(HttpClient);
  workload() { return this.http.get<Workload>('/api/staff/workload'); }
}
@Injectable({ providedIn: 'root' })
export class ManagerReportsService {
  private http = inject(HttpClient);
  outstanding() { return this.http.get<OutstandingReport>('/api/manager/outstanding'); }
  claims(page = 1, type?: ClaimType, withoutEstimate = false) {
    return this.http.get<Page<InternalClaim>>('/api/manager/outstanding/claims', { params: { page, pageSize: 20, withoutEstimate, ...(type ? { type } : {}) } });
  }
}
