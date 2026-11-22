import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ClaimsService } from '../../services/claims.service';
import { ClaimListState } from '../../shared/claim-list-state';
import { ClaimTableComponent } from '../../shared/components/claim-table.component';
import { PageStateComponent } from '../../shared/components/page-state.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({ selector: 'app-my-claims', imports: [RouterLink, ClaimTableComponent, PageStateComponent, IconComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">Customer workspace</span><h1>My Claims</h1><p>Your Motor and Property claims, from submission to decision.</p></div><a class="btn primary" routerLink="/customer/submit"><app-icon name="plus" />Submit Claim</a></div>
  <app-page-state [loading]="list.loading()" [error]="list.error()" (retry)="list.load()" />
  @if (list.loaded()) { <section class="card"><div class="section-heading"><h2>All claims <span class="count-pill">{{list.total()}}</span></h2><button class="btn secondary" [disabled]="list.loading()" (click)="list.load()"><app-icon name="refresh" />Refresh</button></div><app-claim-table [rows]="list.rows()" [total]="list.total()" [page]="list.page()" [loading]="list.loading()" (pageChange)="list.load($event)" /></section> }
` })
export class MyClaimsComponent {
  private service = inject(ClaimsService);
  readonly list = new ClaimListState(page => this.service.mine(page).pipe(
    map(data => ({ ...data, items: data.items.map(claim => ({ claim })) }))
  ));
  constructor() { void this.list.load(); }
}
