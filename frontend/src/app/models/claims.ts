export type Role = 'Customer' | 'Staff' | 'Manager';
export type ClaimType = 'Motor' | 'Property';
export type ClaimStatus = 'Submitted' | 'UnderReview' | 'AwaitingInformation' | 'Approved' | 'Rejected';
export interface ClaimDocument { id: string; fileName: string; contentType: string; size: number; informationRequestId: string | null; uploadedAt: string; }
export interface InformationRequest { id: string; question: string; requestedAt: string; reply: string | null; repliedAt: string | null; }
export interface HistoryEntry { action: string; status: ClaimStatus; occurredAt: string; }
export interface CustomerClaim {
  id: string; type: ClaimType; incidentDetails: string; incidentAt: string;
  claimedAmount: number; currency: 'MYR'; status: ClaimStatus; version: string;
  submittedAt: string; completedAt: string | null; decisionReason: string | null;
  documents: ClaimDocument[]; informationRequests: InformationRequest[]; history: HistoryEntry[];
}
export interface InternalClaim { claim: CustomerClaim; customerId: string; estimatedLiability: number | null; }
export interface ClaimRecord { claim: CustomerClaim; customerId?: string; estimatedLiability?: number | null; }
export interface Page<T> { total: number; page: number; pageSize: number; items: T[]; }
export interface Submission { type: ClaimType; incidentAt: string; incidentDetails: string; claimedAmount: number; }
export interface Workload {
  scope: string; generatedAt: string; outstanding: number;
  byStatus: { status: ClaimStatus; count: number }[];
  outcomes: { approved: number; rejected: number }; completedCount: number;
  averageCompletionHours: number | null; medianCompletionHours: number | null;
}
export interface TypeTotals { type: ClaimType; count: number; claimedAmount: number; estimatedLiability: number; withoutEstimateCount: number; }
export interface OutstandingReport {
  currency: 'MYR'; generatedAt: string; count: number; claimedAmount: number;
  estimatedLiability: number; withoutEstimateCount: number; byType: TypeTotals[];
}
export const isOutstanding = (status: ClaimStatus) => status !== 'Approved' && status !== 'Rejected';
export function normalizeClaim(value: CustomerClaim | InternalClaim): ClaimRecord {
  return 'claim' in value ? value : { claim: value };
}
