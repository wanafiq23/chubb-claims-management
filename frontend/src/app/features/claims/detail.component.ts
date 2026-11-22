import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpEvent } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ClaimDocument, ClaimRecord, CustomerClaim, InternalClaim, normalizeClaim } from '../../models/claims';
import { ClaimsService } from '../../services/claims.service';
import { DocumentsService } from '../../services/documents.service';
import { ReviewsService } from '../../services/reviews.service';
import { NoticeService } from '../../services/notice.service';
import { uploadResponse } from '../../services/upload';
import { apiError, isConflict } from '../../services/api-error';
import { money, nonBlank, validateFiles } from '../../shared/validation';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { FilePickerComponent } from '../../shared/components/file-picker.component';
import { PageStateComponent } from '../../shared/components/page-state.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';

@Component({ selector: 'app-claim-detail', imports: [CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink, StatusBadgeComponent, FilePickerComponent, PageStateComponent, IconComponent, ConfirmDialogComponent], templateUrl: './detail.component.html' })
export class ClaimDetailComponent {
  readonly auth = inject(AuthService); private route = inject(ActivatedRoute); private fb = inject(FormBuilder);
  private claims = inject(ClaimsService); private docs = inject(DocumentsService); private reviews = inject(ReviewsService); private notice = inject(NoticeService);
  readonly data = signal<ClaimRecord | null>(null); readonly loading = signal(false); readonly busy = signal(false); readonly error = signal(''); readonly conflict = signal(false);
  readonly files = signal<File[]>([]); readonly invalidFiles = signal(false); readonly progress = signal<number | null>(null); readonly downloading = signal<string | null>(null); readonly confirmOpen = signal(false); readonly pickerKey = signal(0);
  readonly pending = computed(() => this.data()?.claim.informationRequests.find(r => r.repliedAt === null));
  readonly locked = computed(() => this.busy() || this.loading() || this.conflict());
  readonly estimateForm = this.fb.nonNullable.group({ amount: ['', money(true)] });
  readonly questionForm = this.fb.nonNullable.group({ question: ['', nonBlank] });
  readonly replyForm = this.fb.nonNullable.group({ text: ['', nonBlank] });
  readonly decisionForm = this.fb.nonNullable.group({ decision: ['Approved' as 'Approved' | 'Rejected'], reason: ['', nonBlank] });
  private id = '';
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => { this.id = params.get('id') ?? ''; this.data.set(null); this.confirmOpen.set(false); void this.load(); }); }
  async load(): Promise<void> {
    this.loading.set(true); this.error.set(''); const id = this.id;
    try { const data = await firstValueFrom(this.claims.get(id)); if (id === this.id) { this.apply(data); this.conflict.set(false); } }
    catch(e) { if (id === this.id) this.error.set(apiError(e)); } finally { if (id === this.id) this.loading.set(false); }
  }
  private apply(data: ClaimRecord): void {
    this.data.set(data);
    this.estimateForm.reset({ amount: data.estimatedLiability == null ? '' : String(data.estimatedLiability) });
    this.files.set([]); this.invalidFiles.set(false); this.progress.set(null); this.pickerKey.update(n => n + 1);
  }
  private handleError(error: unknown): void { this.error.set(apiError(error)); this.conflict.set(isConflict(error)); }
  private async execute(action: Observable<InternalClaim | CustomerClaim>, message: string): Promise<void> {
    if (this.locked()) return;
    this.busy.set(true); this.error.set('');
    try { const result = normalizeClaim(await firstValueFrom(action)); if (result.claim.id === this.id) { this.apply(result); this.notice.show(message); } }
    catch(e) { this.handleError(e); } finally { this.busy.set(false); }
  }
  startReview(): void { const c = this.data()!.claim; void this.execute(this.reviews.start(c.id, c.version), 'Review started. This claim remains in the shared team queue.'); }
  saveEstimate(): void { this.estimateForm.markAllAsTouched(); if (this.estimateForm.invalid) return; const c = this.data()!.claim; void this.execute(this.reviews.estimate(c.id, c.version, Number(this.estimateForm.getRawValue().amount)), 'Estimated liability saved.'); }
  async requestInformation(): Promise<void> { this.questionForm.markAllAsTouched(); if (this.questionForm.invalid) return; const c = this.data()!.claim; await this.execute(this.reviews.requestInformation(c.id, c.version, this.questionForm.getRawValue().question.trim()), 'Information requested from the customer.'); if (!this.error()) this.questionForm.reset(); }
  openDecision(): void {
    this.decisionForm.markAllAsTouched(); if (this.decisionForm.invalid || this.locked()) return;
    if (this.decisionForm.getRawValue().decision === 'Approved' && this.data()?.estimatedLiability == null) { this.error.set('Save an estimated liability before approving this claim. An explicit zero estimate is allowed.'); return; }
    this.confirmOpen.set(true);
  }
  confirmDecision(): void { this.confirmOpen.set(false); const c = this.data()!.claim; const value = this.decisionForm.getRawValue(); void this.execute(this.reviews.decide(c.id, c.version, value.decision, value.reason.trim()), `Claim ${value.decision.toLowerCase()}. The customer can now view the decision.`); }
  private async saveUpload(source: Observable<HttpEvent<CustomerClaim>>, message: string, onSuccess?: () => void): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(source.pipe(uploadResponse(percent => this.progress.set(percent))));
      if (result.body) { this.apply({ claim: result.body }); onSuccess?.(); this.notice.show(message); }
    } catch(e) { this.handleError(e); } finally { this.busy.set(false); }
  }
  async upload(): Promise<void> {
    const c = this.data()!.claim;
    if (this.locked() || !this.files().length || this.invalidFiles()) return;
    const validation = validateFiles(this.files(), c.documents.length); if (validation) { this.error.set(validation); return; }
    await this.saveUpload(this.docs.upload(c.id, c.version, this.files()), 'Supporting documents uploaded.');
  }
  async reply(): Promise<void> {
    this.replyForm.markAllAsTouched(); if (this.locked() || this.replyForm.invalid || this.invalidFiles()) return;
    const c = this.data()!.claim; const request = this.pending(); if (!request) return;
    const validation = validateFiles(this.files(), c.documents.length); if (validation) { this.error.set(validation); return; }
    await this.saveUpload(this.reviews.reply(c.id, request.id, c.version, this.replyForm.getRawValue().text.trim(), this.files()), 'Your reply has been sent. The claim is back UnderReview.', () => this.replyForm.reset());
  }
  async download(document: ClaimDocument): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(document.id);
    try { const blob = await firstValueFrom(this.docs.download(this.id, document.id)); const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = document.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch(e) { this.error.set(apiError(e)); } finally { this.downloading.set(null); }
  }
  invalid(form: 'estimate' | 'question' | 'reply' | 'decision'): boolean { const control = form === 'estimate' ? this.estimateForm : form === 'question' ? this.questionForm : form === 'reply' ? this.replyForm : this.decisionForm; return control.invalid && control.touched; }
  actionLabel(action: string): string { return ({ ClaimSubmitted: 'Claim submitted', DocumentsAdded: 'Documents added', ReviewStarted: 'Review started', LiabilityEstimated: 'Review updated', InformationRequested: 'Information requested', InformationReplied: 'Customer replied', ClaimApproved: 'Claim approved', ClaimRejected: 'Claim rejected' } as Record<string, string>)[action] ?? action; }
}
