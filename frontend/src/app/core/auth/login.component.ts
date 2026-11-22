import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from '../../models/claims';
import { apiError } from '../../services/api-error';
import { IconComponent } from '../../shared/components/icon.component';
import { NoticeService } from '../../services/notice.service';
@Component({ selector: 'app-login', imports: [IconComponent], template: `
  <main class="login-page"><section class="login-intro"><a class="brand" href="/login"><span class="brand-mark"><app-icon name="shield" /></span>CHUBB</a>
    <div class="intro-copy"><span class="eyebrow">Claims management</span><h1>A clearer path<br>from claim to decision.</h1><p>One place to submit, review and monitor Motor and Property claims.</p>
      <div class="intro-feature"><app-icon name="shield" /><div><strong>Every detail in one place</strong><span>Documents, updates and decisions, together.</span></div></div>
      <div class="intro-feature"><app-icon name="clock" /><div><strong>Stay informed at every step</strong><span>A clear history from submission to outcome.</span></div></div>
    </div><small>CHUBB · Claims Management MVP</small>
  </section><section class="login-panel"><div class="login-card"><span class="eyebrow">Welcome to CHUBB</span><h2>Sign in to your workspace</h2><p class="muted">Choose a demo role to get started.</p>
    <div class="role-options" role="group" aria-label="Demo role">
      @for (option of options; track option.role) {
        <button type="button" class="role-option" [class.selected]="selected() === option.role" [attr.aria-pressed]="selected() === option.role" [disabled]="busy()" (click)="selected.set(option.role)"><span class="icon-tile"><app-icon [name]="option.icon" /></span><span><strong>{{option.label}}</strong><small>{{option.description}}</small></span><span class="radio-dot"></span></button>
      }
    </div>
    @if (error()) { <div class="alert error" role="alert">{{error()}}</div> }
    <button class="btn primary full" [disabled]="busy()" (click)="login()">@if(busy()) { <span class="spinner"></span>Connecting… } @else { Continue as {{selectedLabel()}} }</button>
    <div class="demo-note"><app-icon name="info" /><p>Demo access uses predefined accounts. No password is required. Each role has its own workspace.</p></div>
  </div></section></main>
` })
export class LoginComponent {
  readonly auth = inject(AuthService); private router = inject(Router); private notice = inject(NoticeService);
  readonly selected = signal<Role>('Customer'); readonly busy = signal(false); readonly error = signal('');
  readonly options: { role: Role; label: string; description: string; icon: string }[] = [
    { role: 'Customer', label: 'Customer', description: 'Submit and follow your claims', icon: 'user' },
    { role: 'Staff', label: 'Claims Staff', description: 'Review claims and make decisions', icon: 'files' },
    { role: 'Manager', label: 'Manager', description: 'Monitor outstanding claims and liability', icon: 'chart' }
  ];
  selectedLabel() { return this.options.find(o => o.role === this.selected())!.label; }
  async login(): Promise<void> {
    this.busy.set(true); this.error.set(''); this.notice.clear();
    try { await this.auth.login(this.selected()); await this.router.navigateByUrl(this.auth.home()); }
    catch (error) { this.error.set(apiError(error)); }
    finally { this.busy.set(false); }
  }
}
