import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CustomerClaim } from '../models/claims';
import { versionHeaders } from './claims.service';
import { documentForm } from './upload';
@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private http = inject(HttpClient);
  upload(id: string, version: string, files: File[]) {
    return this.http.post<CustomerClaim>(`/api/claims/${id}/documents`, documentForm(files), { headers: versionHeaders(version), observe: 'events', reportProgress: true });
  }
  download(claimId: string, documentId: string) { return this.http.get(`/api/claims/${claimId}/documents/${documentId}`, { responseType: 'blob' }); }
}
