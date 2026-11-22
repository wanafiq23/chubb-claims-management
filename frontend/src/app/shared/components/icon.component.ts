import { Component, input } from '@angular/core';
const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  files: 'M8 3h8l4 4v14H8z M16 3v5h4 M4 7H2v14',
  plus: 'M12 5v14 M5 12h14', shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
  clock: 'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  check: 'M5 12l4 4L19 6', close: 'M6 6l12 12 M6 18L18 6',
  chart: 'M4 20V4 M4 20h17 M9 16V11 M14 16V7 M19 16V4',
  logout: 'M9 4H4v16h5 M10 12h10 M16 8l4 4-4 4',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 13 1 M18 17a7 7 0 0 1-13-1',
  car: 'M5 7l2-4h10l2 4 M3 7h18v10H3z M5 17v3 M19 17v3 M6 11h2 M16 11h2',
  home: 'M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-7h6v7',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'
};
@Component({ selector: 'app-icon', template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>', styles: ':host{display:inline-flex;flex-shrink:0;width:1.25rem;height:1.25rem}svg{width:100%;height:100%}' })
export class IconComponent { readonly name = input('files'); path() { return paths[this.name()] ?? paths['files']; } }
