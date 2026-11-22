import { Component, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ClaimRecord } from '../../models/claims';
import { StatusBadgeComponent } from './status-badge.component';
import { IconComponent } from './icon.component';
@Component({
  selector: 'app-claim-table', imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadgeComponent, IconComponent],
  template: `
    @if (rows().length) {
      <div class="table-scroll" tabindex="0" role="region" [attr.aria-label]="label()">
        <table><thead><tr><th scope="col">Claim</th><th scope="col">Type</th><th scope="col">Submitted</th><th scope="col">Claimed amount</th>
          @if (internal()) { <th scope="col">Estimated liability</th> }
          <th scope="col">Status</th><th scope="col"><span class="sr-only">Open claim</span></th></tr></thead>
        <tbody>@for (row of rows(); track row.claim.id) {
          <tr><td><a class="claim-id" [routerLink]="['/claims', row.claim.id]">{{row.claim.id.slice(0, 8).toUpperCase()}}</a>
            @if (internal()) { <small class="block muted">{{row.customerId}}</small> }</td>
            <td><span class="type-label"><app-icon [name]="row.claim.type === 'Motor' ? 'car' : 'home'" />{{row.claim.type}}</span></td>
            <td>{{row.claim.submittedAt | date:'dd MMM yyyy'}}</td><td class="amount">{{row.claim.claimedAmount | currency:'MYR':'code':'1.2-2'}}</td>
            @if (internal()) { <td class="amount">@if (row.estimatedLiability != null) { {{row.estimatedLiability | currency:'MYR':'code':'1.2-2'}} } @else { <span class="muted">Not estimated</span> }</td> }
            <td><app-status [status]="row.claim.status" /></td><td><a class="table-action" [routerLink]="['/claims', row.claim.id]" [attr.aria-label]="'View claim ' + row.claim.id.slice(0, 8)">View</a></td>
          </tr>
        }</tbody></table>
      </div>
    } @else {
      <div class="empty-state"><span class="empty-icon"><app-icon name="files" /></span><h3>{{emptyTitle()}}</h3><p>{{emptyText()}}</p></div>
    }
    @if (total() > pageSize()) {
      <nav class="pagination" aria-label="Claims pagination"><span class="muted">Page {{page()}} of {{pages()}} · {{total()}} claims</span><div class="button-row"><button class="btn secondary" [disabled]="page() <= 1 || loading()" (click)="pageChange.emit(page() - 1)">Previous</button><button class="btn secondary" [disabled]="page() >= pages() || loading()" (click)="pageChange.emit(page() + 1)">Next</button></div></nav>
    }
  `
})
export class ClaimTableComponent {
  readonly rows = input.required<ClaimRecord[]>(); readonly internal = input(false); readonly total = input(0);
  readonly page = input(1); readonly pageSize = input(20); readonly loading = input(false);
  readonly label = input('Claims'); readonly emptyTitle = input('No claims yet'); readonly emptyText = input('Claims will appear here when they are available.');
  readonly pageChange = output<number>(); pages() { return Math.max(1, Math.ceil(this.total() / this.pageSize())); }
}
