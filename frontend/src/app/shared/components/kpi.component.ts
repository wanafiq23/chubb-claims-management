import { Component, input } from '@angular/core';
import { IconComponent } from './icon.component';
@Component({ selector: 'app-kpi', imports: [IconComponent], template: '<article class="card kpi"><div class="kpi-label">{{label()}}<span class="icon-tile" [class]="\'icon-tile \' + tone()"><app-icon [name]="icon()" /></span></div><div class="kpi-value" [attr.data-testid]="testId()">{{value()}}</div><p class="muted kpi-caption">{{caption()}}</p></article>' })
export class KpiComponent {
  readonly label = input.required<string>(); readonly value = input<string | number>('—');
  readonly icon = input('files'); readonly tone = input('blue'); readonly caption = input(''); readonly testId = input<string>();
}
