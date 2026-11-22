import { signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ClaimRecord, Page } from '../models/claims';
import { apiError } from '../services/api-error';

/** Shared state for customer claims and the staff queue; endpoints remain role-specific. */
export class ClaimListState {
  readonly rows = signal<ClaimRecord[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly fetchPage: (page: number) => Observable<Page<ClaimRecord>>) {}

  async load(page = this.page()): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(this.fetchPage(page));
      this.rows.set(data.items);
      this.total.set(data.total);
      this.page.set(page);
      this.loaded.set(true);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
