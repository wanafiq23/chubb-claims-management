import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ClaimsService } from '../../services/claims.service';
import { DocumentsService } from '../../services/documents.service';
import { NoticeService } from '../../services/notice.service';
import { uploadResponse } from '../../services/upload';
import { apiError } from '../../services/api-error';
import { ClaimType, CustomerClaim } from '../../models/claims';
import { incidentDate, money, nonBlank } from '../../shared/validation';
import { FilePickerComponent } from '../../shared/components/file-picker.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({ selector: 'app-submit-claim', imports: [ReactiveFormsModule, RouterLink, FilePickerComponent, IconComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">Customer workspace</span><h1>Submit Claim</h1><p>Tell us what happened. You can follow every update in your claim.</p></div></div>
  <div class="form-page-grid"><section class="card form-card">
    @if (saved(); as claim) {
      <div class="alert info"><app-icon name="check" /><div><strong>Claim {{claim.id.slice(0, 8).toUpperCase()}} has been submitted.</strong><p>The claim is saved. Your documents could not be uploaded. Open the claim to retry the upload without creating a duplicate.</p></div></div>
      @if (error()) { <div class="alert error" role="alert">{{error()}}</div> }
      <a class="btn primary" [routerLink]="['/claims', claim.id]">Open saved claim</a>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()"><h2>Incident information</h2><p class="muted form-intro">All fields below are required. Supporting documents are optional.</p>
        <fieldset [disabled]="busy()"><div class="form-grid"><div class="field"><label for="claim-type">Claim type</label><select id="claim-type" formControlName="type"><option value="Motor">Motor</option><option value="Property">Property</option></select></div>
        <div class="field"><label for="incident-date">Incident date</label><input id="incident-date" type="date" formControlName="incidentDate" min="1900-01-01" [max]="today" [attr.aria-invalid]="invalid('incidentDate')" aria-describedby="date-error">@if (invalid('incidentDate')) { <small id="date-error" class="field-error">Choose a date from 1900 through today.</small> }</div></div>
        <div class="field"><label for="incident-details">Incident details</label><textarea id="incident-details" rows="5" formControlName="incidentDetails" maxlength="4000" placeholder="Describe what happened and the damage or loss." [attr.aria-invalid]="invalid('incidentDetails')" aria-describedby="details-error"></textarea><div class="field-meta"><span>@if(invalid('incidentDetails')) { <small id="details-error" class="field-error">Enter incident details (1–4000 characters).</small> }</span><small class="muted">{{form.controls.incidentDetails.value.length}} / 4000</small></div></div>
        <div class="field"><label for="claimed-amount">Claimed amount (MYR)</label><div class="input-prefix"><span>MYR</span><input id="claimed-amount" type="number" inputmode="decimal" formControlName="claimedAmount" min="0.01" max="1000000000" step="0.01" placeholder="0.00" [attr.aria-invalid]="invalid('claimedAmount')" aria-describedby="amount-hint"></div><small id="amount-hint" [class]="invalid('claimedAmount') ? 'field-error' : 'muted'">Enter 0.01–1,000,000,000 MYR, with at most two decimal places.</small></div>
        <div class="form-divider"></div><h2>Supporting documents</h2><p class="muted form-intro">Add photos, reports or other evidence related to the incident.</p><app-file-picker inputId="submission-files" [disabled]="busy()" (changed)="files.set($event)" (invalid)="invalidFiles.set($event)" /></fieldset>
        @if (error()) { <div class="alert error" role="alert">{{error()}}</div> }
        @if (busy()) { <div class="upload-progress" role="status"><span>{{stage()}}</span>@if(progress() != null) { <progress max="100" [value]="progress()"></progress> }</div> }
        <div class="form-actions"><a class="btn secondary" routerLink="/customer/claims">Cancel</a><button class="btn primary" type="submit" [disabled]="busy() || invalidFiles()">@if(busy()) { <span class="spinner"></span> }Submit claim</button></div>
      </form>
    }
  </section><aside class="card help-card"><span class="icon-tile"><app-icon name="shield" /></span><h2>What happens next?</h2><ol><li><strong>Submit your claim</strong><p>Your claim enters the shared review queue.</p></li><li><strong>The team reviews it</strong><p>Check your claim for any information requests.</p></li><li><strong>Get a clear decision</strong><p>View the outcome and reason in claim details.</p></li></ol><div class="help-note">All claim amounts are recorded in Malaysian ringgit (MYR).</div></aside></div>
` })
export class SubmitClaimComponent {
  private fb = inject(FormBuilder); private claims = inject(ClaimsService); private documents = inject(DocumentsService); private router = inject(Router); private notice = inject(NoticeService);
  readonly form = this.fb.nonNullable.group({ type: ['Motor' as ClaimType, Validators.required], incidentDate: ['', incidentDate], incidentDetails: ['', nonBlank], claimedAmount: ['', money()] });
  readonly today = new Date().toISOString().slice(0, 10); readonly busy = signal(false); readonly error = signal(''); readonly stage = signal(''); readonly progress = signal<number | null>(null); readonly files = signal<File[]>([]); readonly invalidFiles = signal(false); readonly saved = signal<CustomerClaim | null>(null);
  invalid(name: keyof typeof this.form.controls) { const c = this.form.controls[name]; return c.invalid && c.touched; }
  async submit(): Promise<void> {
    if (this.busy() || this.saved()) return;
    this.form.markAllAsTouched(); if (this.form.invalid || this.invalidFiles()) return;
    this.busy.set(true); this.error.set(''); this.stage.set('Submitting your claim…');
    let created: CustomerClaim | null = null;
    try {
      const value = this.form.getRawValue();
      created = await firstValueFrom(this.claims.submit({ type: value.type, incidentAt: value.incidentDate + 'T00:00:00Z', incidentDetails: value.incidentDetails.trim(), claimedAmount: Number(value.claimedAmount) }));
      if (this.files().length) {
        this.stage.set('Claim saved. Uploading supporting documents…');
        await firstValueFrom(this.documents.upload(created.id, created.version, this.files()).pipe(uploadResponse(percent => this.progress.set(percent))));
      }
      this.notice.show('Your claim has been submitted successfully.');
      await this.router.navigate(['/claims', created.id]);
    } catch(e) {
      this.error.set(apiError(e));
      if (created) this.saved.set(created);
      // A lost creation response is ambiguous; do not automatically retry POST and create duplicates.
      else this.error.update(message => message + ' If the response was interrupted, check My Claims before submitting again.');
    } finally { this.busy.set(false); }
  }
}
