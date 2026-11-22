import { Component, input, output } from '@angular/core';
@Component({ selector: 'app-page-state', template: `
  @if (loading()) { <div class="loading-state" role="status"><span class="spinner"></span>{{loadingText()}}</div> }
  @if (error()) { <div class="alert error" role="alert"><div><strong>Unable to complete the request</strong><p>{{error()}}</p></div><button class="btn secondary" [disabled]="loading()" (click)="retry.emit()">{{retryLabel()}}</button></div> }
` })
export class PageStateComponent {
  readonly loading = input(false); readonly error = input(''); readonly loadingText = input('Loading claims…'); readonly retryLabel = input('Try again'); readonly retry = output<void>();
}
