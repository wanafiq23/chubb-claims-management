import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NoticeService } from './services/notice.service';
@Component({ selector: 'app-root', imports: [RouterOutlet], template: `
  <router-outlet />
  @if (notice.message(); as message) { <div class="toast" [class.toast-error]="message.type === 'error'" role="status"><span>{{message.text}}</span><button type="button" aria-label="Dismiss notification" (click)="notice.clear()">×</button></div> }
` })
export class AppComponent { readonly notice = inject(NoticeService); }
