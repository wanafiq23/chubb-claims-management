import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from './icon.component';
@Component({ selector: 'app-layout', imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent], template: `
  <a href="#main" class="skip-link">Skip to content</a>
  <aside class="sidebar" aria-label="Main navigation"><a [routerLink]="auth.home()" class="brand"><span class="brand-mark"><app-icon name="shield" /></span>CHUBB</a>
    <div class="workspace-label">{{roleLabel()}} workspace</div>
    <nav><a [routerLink]="auth.home()" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" ariaCurrentWhenActive="page"><app-icon name="grid" />Dashboard</a>
      @if(auth.role() === 'Customer') { <a routerLink="/customer/claims" routerLinkActive="active" ariaCurrentWhenActive="page"><app-icon name="files" />My Claims</a><a routerLink="/customer/submit" routerLinkActive="active" ariaCurrentWhenActive="page"><app-icon name="plus" />Submit Claim</a> }
      @if(auth.role() === 'Staff') { <a routerLink="/staff/queue" routerLinkActive="active" ariaCurrentWhenActive="page"><app-icon name="files" />Claims Queue</a><a routerLink="/staff/reports" routerLinkActive="active" ariaCurrentWhenActive="page"><app-icon name="chart" />Team Workload</a> }
    </nav><div class="sidebar-bottom"><div class="sidebar-note"><app-icon name="shield" /><strong>Claims, with clarity.</strong><p>Motor & Property<br>All amounts in MYR</p></div><button type="button" (click)="auth.logout()"><app-icon name="logout" />Sign out</button></div>
  </aside>
  <div class="app-content"><header class="topbar"><div class="topbar-left"><span>CHUBB <span class="topbar-divider">/</span> <span class="muted">Claims Management</span></span></div><div class="profile"><span class="demo-pill">Demo</span><span class="avatar">{{initials()}}</span><div><strong>{{auth.session()?.name}}</strong><small>{{roleLabel()}}</small></div></div></header>
    <main id="main" tabindex="-1" class="main-content"><router-outlet /></main><footer class="app-footer">CHUBB Claims Management<span>Motor & Property · MYR</span></footer>
  </div>
` })
export class LayoutComponent {
  readonly auth = inject(AuthService);
  roleLabel() { return this.auth.role() === 'Staff' ? 'Claims Staff' : this.auth.role(); }
  initials() { return this.auth.role() === 'Customer' ? 'AL' : this.auth.role() === 'Staff' ? 'CS' : 'MG'; }
}
