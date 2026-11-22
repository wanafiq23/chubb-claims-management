import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class NoticeService {
  readonly message = signal<{ text: string; type: 'success' | 'error' } | null>(null);
  show(text: string, type: 'success' | 'error' = 'success'): void { this.message.set({ text, type }); }
  clear(): void { this.message.set(null); }
}
