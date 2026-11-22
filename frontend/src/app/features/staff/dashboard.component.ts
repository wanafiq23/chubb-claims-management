import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { ClaimsService } from '../../services/claims.service';
import { StaffMetricsService } from '../../services/reports.service';
import { InternalClaim, Workload } from '../../models/claims';
import { apiError } from '../../services/api-error';
import { ClaimTableComponent } from '../../shared/components/claim-table.component';
import { KpiComponent } from '../../shared/components/kpi.component';
import { PageStateComponent } from '../../shared/components/page-state.component';
import { IconComponent } from '../../shared/components/icon.component';
import { WorkloadSummaryComponent } from '../reports/workload-summary.component';
@Component({ selector: 'app-staff-dashboard', imports: [RouterLink, ClaimTableComponent, KpiComponent, PageStateComponent, IconComponent, WorkloadSummaryComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">CHUBB · Claims Staff workspace</span><h1>{{reportsOnly() ? 'Team Workload' : 'A clear view of your team’s claims'}}</h1><p>One shared queue. A complete picture of workload and outcomes.</p></div><button class="btn secondary" [disabled]="loading()" (click)="load()"><app-icon name="refresh" />Refresh</button></div>
  <app-page-state [loading]="loading()" [error]="error()" (retry)="load()" />
  @if (metrics(); as data) {
    <section class="kpi-grid"><app-kpi label="Shared claims queue" [value]="data.outstanding" caption="All outstanding claims" /><app-kpi label="Awaiting review" [value]="count('Submitted')" icon="files" caption="Submitted and ready to review" /><app-kpi label="Awaiting information" [value]="count('AwaitingInformation')" icon="clock" tone="amber" caption="Waiting for a customer reply" /><app-kpi label="Completed claims" [value]="data.completedCount" icon="check" tone="green" caption="Approved and Rejected · All time" /></section>
    @if (!reportsOnly()) { <section class="card"><div class="section-heading"><div><h2>Shared claims queue</h2><p>Oldest outstanding claims first.</p></div><a class="text-link" routerLink="/staff/queue">View full queue</a></div><app-claim-table [rows]="rows()" [internal]="true" emptyTitle="The queue is clear" emptyText="New customer claims will appear here." /></section> }
    <app-workload-summary [metrics]="data" />
    @if(reportsOnly()) { <p class="muted small-note">The backend provides completed-claim totals and completion times. A completed-claims search endpoint is not available.</p> }
  }
` })
export class StaffDashboardComponent {
  readonly reportsOnly = input(false); private claims = inject(ClaimsService); private reports = inject(StaffMetricsService);
  readonly metrics = signal<Workload | null>(null); readonly rows = signal<InternalClaim[]>([]); readonly loading = signal(false); readonly error = signal('');
  ngOnInit() { void this.load(); }
  count(status: string) { return this.metrics()?.byStatus.find(x => x.status === status)?.count ?? 0; }
  async load() { this.loading.set(true); this.error.set(''); try { const data = await firstValueFrom(forkJoin({ metrics: this.reports.workload(), queue: this.reportsOnly() ? of(null) : this.claims.queue(1, 6) })); this.metrics.set(data.metrics); this.rows.set(data.queue?.items ?? []); } catch(e) { this.error.set(apiError(e)); } finally { this.loading.set(false); } }
}
