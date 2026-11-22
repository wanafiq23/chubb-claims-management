import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
@Component({ selector: 'app-confirm-dialog', template: `
  <dialog #dialog aria-labelledby="decision-title" aria-describedby="decision-description" (cancel)="cancel.emit()">
    <div class="dialog-content"><span class="eyebrow">Final decision</span><h2 id="decision-title">{{title()}}</h2><p id="decision-description">{{description()}}</p>
    <div class="button-row dialog-actions"><button class="btn secondary" autofocus (click)="cancel.emit()">Cancel</button><button [class]="danger() ? 'btn danger' : 'btn primary'" (click)="confirm.emit()">Confirm decision</button></div></div>
  </dialog>
` })
export class ConfirmDialogComponent {
  readonly open = input(false); readonly title = input('Confirm decision'); readonly description = input(''); readonly danger = input(false);
  readonly cancel = output<void>(); readonly confirm = output<void>();
  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  constructor() { effect(() => { const element = this.dialog()?.nativeElement; if (!element) return; if (this.open() && !element.open) element.showModal(); else if (!this.open() && element.open) element.close(); }); }
}
