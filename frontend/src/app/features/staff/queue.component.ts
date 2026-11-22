import { Component, inject } from '@angular/core';
import { ClaimsService } from '../../services/claims.service';
import { ClaimListState } from '../../shared/claim-list-state';
import { ClaimTableComponent } from '../../shared/components/claim-table.component';
import { PageStateComponent } from '../../shared/components/page-state.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({ selector: 'app-queue', imports: [ClaimTableComponent, PageStateComponent, IconComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">Claims Staff workspace</span><h1>Claims Queue</h1><p>Shared across the team. Open a claim to review its details and available actions.</p></div><button class="btn secondary" [disabled]="list.loading()" (click)="list.load()"><app-icon name="refresh" />Refresh queue</button></div>
  <app-page-state [loading]="list.loading()" [error]="list.error()" (retry)="list.load()" />
  @if(list.loaded()) { <section class="card"><div class="section-heading"><h2>Outstanding claims <span class="count-pill">{{list.total()}}</span></h2><span class="muted">Oldest first</span></div><app-claim-table [rows]="list.rows()" [internal]="true" [total]="list.total()" [page]="list.page()" [loading]="list.loading()" (pageChange)="list.load($event)" emptyTitle="The queue is clear" emptyText="There are no outstanding claims to review." /></section> }
` })
export class QueueComponent {
  private service = inject(ClaimsService);
  readonly list = new ClaimListState(page => this.service.queue(page));
  constructor() { void this.list.load(); }
}
