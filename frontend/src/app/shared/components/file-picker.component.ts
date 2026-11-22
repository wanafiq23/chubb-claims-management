import { Component, input, output, signal } from '@angular/core';
import { IconComponent } from './icon.component';
import { validateFiles } from '../validation';
@Component({ selector: 'app-file-picker', imports: [IconComponent], template: `
  <div class="upload-zone"><app-icon name="upload" /><label [for]="inputId()">{{label()}}</label><p>PDF, JPG or PNG · Up to 5 files · 5 MiB per file</p>
    <input [id]="inputId()" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple [disabled]="disabled()" (change)="select($event)" [attr.aria-describedby]="inputId() + '-hint'">
    <small [id]="inputId() + '-hint'" class="muted">{{existingCount()}} of 20 claim document slots used. The server also checks file signatures.</small>
  </div>
  @if (error()) { <p class="field-error" role="alert">{{error()}}</p> }
  @if (selected().length) { <ul class="file-list">@for (file of selected(); track $index) { <li><app-icon name="files" /><span>{{file.name}}</span><small class="muted">{{size(file.size)}}</small></li> }</ul> }
` })
export class FilePickerComponent {
  readonly inputId = input.required<string>(); readonly label = input('Select supporting documents (optional)');
  readonly existingCount = input(0); readonly disabled = input(false);
  readonly changed = output<File[]>(); readonly invalid = output<boolean>();
  readonly selected = signal<File[]>([]); readonly error = signal('');
  select(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    const message = validateFiles(files, this.existingCount());
    this.error.set(message ?? ''); this.selected.set(message ? [] : files);
    this.invalid.emit(!!message); this.changed.emit(message ? [] : files);
  }
  size(bytes: number): string { return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MiB' : Math.max(1, Math.round(bytes / 1024)) + ' KiB'; }
}
