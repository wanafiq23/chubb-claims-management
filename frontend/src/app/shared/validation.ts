import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
export const nonBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null => typeof control.value === 'string' && control.value.trim().length > 0 && control.value.trim().length <= 4000 ? null : { nonBlank: true };
export const money = (allowZero = false): ValidatorFn => control => {
  const text = String(control.value ?? '');
  const value = Number(text);
  return text !== '' && /^\d+(\.\d{1,2})?$/.test(text) && value >= (allowZero ? 0 : 0.01) && value <= 1_000_000_000 ? null : { money: true };
};
export const incidentDate: ValidatorFn = control => {
  const value = String(control.value ?? '');
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date >= new Date('1900-01-01T00:00:00Z') && date <= new Date() ? null : { incidentDate: true };
};
export function validateFiles(files: File[], existingCount = 0): string | null {
  if (files.length > 5) return 'Select no more than five files per upload.';
  if (existingCount + files.length > 20) return 'A claim may contain no more than 20 documents.';
  const mime: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  for (const file of files) {
    if (file.size === 0 || file.size > 5 * 1024 * 1024) return `${file.name}: files must be nonempty and no larger than 5 MiB.`;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!mime[extension] || file.type !== mime[extension]) return `${file.name}: use PDF, JPG/JPEG or PNG with a matching file type.`;
    if (file.name.length > 150 || /[\u0000-\u001f\u007f]/.test(file.name)) return 'File names must be at most 150 characters and contain no control characters.';
  }
  return null;
}
