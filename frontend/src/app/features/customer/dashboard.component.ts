import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ClaimsService } from '../../services/claims.service';
import { CustomerClaim, isOutstanding } from '../../models/claims';
import { apiError } from '../../services/api-error';
import { KpiComponent } from '../../shared/components/kpi.component';
import { ClaimTableComponent } from '../../shared/components/claim-table.component';
import { PageStateComponent } from '../../shared/components/page-state.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({ selector: 'app-customer-dashboard', imports: [RouterLink, KpiComponent, ClaimTableComponent, PageStateComponent, IconComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">CHUBB · Customer workspace</span><h1>Your claims, at a glance</h1><p>Keep track of your claims and the next steps.</p></div><a class="btn primary" routerLink="/customer/submit"><app-icon name="plus" />Submit Claim</a></div>
  <app-page-state [loading]="loading()" [error]="error()" (retry)="load()" />
  @if (claims(); as items) {
    <section class="kpi-grid" aria-label="Your claim summary"><app-kpi label="Total claims" [value]="items.length" caption="All your submitted claims" /><app-kpi label="Outstanding claims" [value]="count('outstanding')" icon="clock" tone="amber" caption="Awaiting a final decision" /><app-kpi label="Approved claims" [value]="count('Approved')" icon="check" tone="green" caption="Approved by the claims team" /><app-kpi label="Rejected claims" [value]="count('Rejected')" icon="close" tone="red" caption="View details for the reason" /></section>
    @if (waitingCount()) { <div class="alert info"><app-icon name="info" /><div><strong>Your information is needed</strong><p>{{waitingCount()}} claim(s) are awaiting your reply. Open the claim to respond.</p></div><a class="btn secondary" routerLink="/customer/claims">View my claims</a></div> }
    <section class="card"><div class="section-heading"><div><h2>Recent claims</h2><p>Your six most recent submissions.</p></div><a class="text-link" routerLink="/customer/claims">View all claims</a></div><app-claim-table [rows]="recent()" emptyTitle="Your first claim starts here" emptyText="Submit a Motor or Property claim and follow its progress in CHUBB." /></section>
    <div class="info-strip"><app-icon name="shield" /><p><strong>Everything stays with your claim.</strong> Supporting documents, information requests and decisions are available in claim details.</p></div>
  }
` })
export class CustomerDashboardComponent {
  private service = inject(ClaimsService); readonly claims = signal<CustomerClaim[] | null>(null); readonly loading = signal(false); readonly error = signal('');
  constructor() { void this.load(); }
  async load() { this.loading.set(true); this.error.set(''); try { this.claims.set(await firstValueFrom(this.service.allMine())); } catch(e) { this.error.set(apiError(e)); } finally { this.loading.set(false); } }
  count(status: 'outstanding' | 'Approved' | 'Rejected') { return this.claims()?.filter(c => status === 'outstanding' ? isOutstanding(c.status) : c.status === status).length ?? 0; }
  waitingCount() { return this.claims()?.filter(c => c.status === 'AwaitingInformation').length ?? 0; }
  recent() { return (this.claims() ?? []).slice(0, 6).map(claim => ({ claim })); }
}
