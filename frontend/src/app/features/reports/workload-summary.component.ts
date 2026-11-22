import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Workload } from '../../models/claims';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
@Component({ selector: 'app-workload-summary', imports: [DecimalPipe, StatusBadgeComponent], template: `
  <div class="two-column"><section class="card"><div class="section-heading"><div><h2>Team workload</h2><p>All-time claims by current status.</p></div></div><div class="status-breakdown">@for (item of metrics().byStatus; track item.status) { <div><app-status [status]="item.status" /><strong>{{item.count}}</strong></div> }</div></section>
    <section class="card"><div class="section-heading"><div><h2>Completion times</h2><p>From submission to final decision.</p></div></div><dl class="metric-list"><div><dt>Average completion</dt><dd>@if(metrics().averageCompletionHours != null) { {{metrics().averageCompletionHours | number:'1.1-2'}} hours } @else { <span class="muted">No completed claims</span> }</dd></div><div><dt>Median completion</dt><dd>@if(metrics().medianCompletionHours != null) { {{metrics().medianCompletionHours | number:'1.1-2'}} hours } @else { <span class="muted">No completed claims</span> }</dd></div><div><dt>Approved</dt><dd>{{metrics().outcomes.approved}}</dd></div><div><dt>Rejected</dt><dd>{{metrics().outcomes.rejected}}</dd></div></dl><p class="card-footnote">Includes time spent awaiting customer information. Figures cover the whole team.</p></section></div>
` })
export class WorkloadSummaryComponent { readonly metrics = input.required<Workload>(); }
