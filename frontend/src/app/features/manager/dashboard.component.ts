import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, forkJoin, timer } from 'rxjs';
import { ClaimType, InternalClaim, OutstandingReport } from '../../models/claims';
import { ManagerReportsService } from '../../services/reports.service';
import { apiError } from '../../services/api-error';
import { KpiComponent } from '../../shared/components/kpi.component';
import { ClaimTableComponent } from '../../shared/components/claim-table.component';
import { PageStateComponent } from '../../shared/components/page-state.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({ selector: 'app-manager-dashboard', imports: [CurrencyPipe, DatePipe, KpiComponent, ClaimTableComponent, PageStateComponent, IconComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">CHUBB · Manager workspace</span><h1>Outstanding claims overview</h1><p>Read-only visibility into exposure, claim types and estimates.</p></div><button class="btn secondary" [disabled]="loading()" (click)="load()"><app-icon name="refresh" />Refresh</button></div>
  <app-page-state [loading]="loading()" [error]="error()" (retry)="load()" />
  @if(report(); as data) {
    <section class="kpi-grid manager-kpis"><app-kpi label="Outstanding claims" [value]="data.count" caption="Submitted, UnderReview & AwaitingInformation" testId="manager-outstanding" /><app-kpi label="Estimated liability" [value]="(data.estimatedLiability | currency:'MYR':'code':'1.2-2') ?? '—'" icon="chart" caption="Known estimates on outstanding claims" testId="manager-liability" /><app-kpi label="Without an estimate" [value]="data.withoutEstimateCount" icon="clock" tone="amber" caption="Unknown liability is excluded from the total" /></section>
    <div class="two-column type-totals">@for(group of data.byType; track group.type) { <section class="card type-card"><div class="type-card-heading"><span class="icon-tile"><app-icon [name]="group.type === 'Motor' ? 'car' : 'home'" /></span><div><h2>{{group.type}} claims</h2><p>{{group.count}} outstanding</p></div><button class="text-link" [disabled]="loading()" (click)="inspect(group.type)">Inspect claims</button></div><dl class="metric-list"><div><dt>Estimated liability</dt><dd>{{group.estimatedLiability | currency:'MYR':'code':'1.2-2'}}</dd></div><div><dt>Customer claimed total</dt><dd>{{group.claimedAmount | currency:'MYR':'code':'1.2-2'}}</dd></div><div><dt>Without an estimate</dt><dd>{{group.withoutEstimateCount}}</dd></div></dl></section> }</div>
    <section class="card" id="outstanding-claims"><div class="section-heading"><div><h2>Outstanding claims <span class="count-pill">{{total()}}</span></h2><p>Inspect the claims behind the totals. Approved and Rejected claims are excluded.</p></div></div>
      <div class="table-controls"><div class="inline-field"><label for="manager-type">Claim type</label><select id="manager-type" [value]="type() ?? ''" [disabled]="loading()" (change)="setType($event)"><option value="">Motor & Property</option><option value="Motor">Motor</option><option value="Property">Property</option></select></div><label class="checkbox-label"><input type="checkbox" [checked]="withoutEstimate()" [disabled]="loading()" (change)="setMissing($event)">Only claims without an estimate</label></div>
      <app-claim-table [rows]="rows()" [internal]="true" [total]="total()" [page]="page()" [loading]="loading()" (pageChange)="changePage($event)" emptyTitle="No outstanding claims in this view" emptyText="Try a different type or clear the missing-estimate switch." />
    </section>
    <div class="refresh-note"><span>Updated {{data.generatedAt | date:'dd MMM yyyy, HH:mm:ss'}} · Refreshes every 15 seconds while this page is visible.</span><span>All amounts in MYR</span></div>
    @if(error()) { <p class="field-error">Showing the last successful report. The figures above may be out of date.</p> }
  }
` })
export class ManagerDashboardComponent {
  private service = inject(ManagerReportsService); readonly report = signal<OutstandingReport | null>(null); readonly rows = signal<InternalClaim[]>([]);
  readonly loading = signal(false); readonly error = signal(''); readonly page = signal(1); readonly total = signal(0); readonly type = signal<ClaimType | undefined>(undefined); readonly withoutEstimate = signal(false);
  constructor() { timer(0, 15000).pipe(takeUntilDestroyed()).subscribe(() => { if (!document.hidden) void this.load(); }); }
  async load() {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try { const data = await firstValueFrom(forkJoin({ report: this.service.outstanding(), claims: this.service.claims(this.page(), this.type(), this.withoutEstimate()) })); this.report.set(data.report); this.rows.set(data.claims.items); this.total.set(data.claims.total); }
    catch(e) { this.error.set(apiError(e)); } finally { this.loading.set(false); }
  }
  inspect(type: ClaimType) { this.type.set(type); this.page.set(1); void this.load(); document.getElementById('outstanding-claims')?.scrollIntoView({ block: 'start' }); }
  setType(event: Event) { this.type.set(((event.target as HTMLSelectElement).value || undefined) as ClaimType | undefined); this.page.set(1); void this.load(); }
  setMissing(event: Event) { this.withoutEstimate.set((event.target as HTMLInputElement).checked); this.page.set(1); void this.load(); }
  changePage(page: number) { this.page.set(page); void this.load(); }
}
