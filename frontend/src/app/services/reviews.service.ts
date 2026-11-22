import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CustomerClaim, InternalClaim } from '../models/claims';
import { versionHeaders } from './claims.service';
import { documentForm } from './upload';
@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private http = inject(HttpClient);
  start(id: string, version: string) { return this.http.post<InternalClaim>(`/api/claims/${id}/review`, null, { headers: versionHeaders(version) }); }
  estimate(id: string, version: string, estimatedLiability: number) { return this.http.put<InternalClaim>(`/api/claims/${id}/estimate`, { estimatedLiability }, { headers: versionHeaders(version) }); }
  requestInformation(id: string, version: string, question: string) { return this.http.post<InternalClaim>(`/api/claims/${id}/information-requests`, { question }, { headers: versionHeaders(version) }); }
  reply(id: string, requestId: string, version: string, text: string, files: File[]) {
    return this.http.post<CustomerClaim>(`/api/claims/${id}/information-requests/${requestId}/reply`, documentForm(files, text), { headers: versionHeaders(version), observe: 'events', reportProgress: true });
  }
  decide(id: string, version: string, decision: 'Approved' | 'Rejected', reason: string) { return this.http.post<InternalClaim>(`/api/claims/${id}/decision`, { decision, reason }, { headers: versionHeaders(version) }); }
}
