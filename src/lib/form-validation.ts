import type { ZodType } from 'zod';

export type FieldErrors = Record<string, string>;

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors; message: string };

/**
 * Validate a form with the same Zod schema the API uses, and flatten issues
 * into a field-keyed map so the UI can show precise messages before submit.
 */
export function validateForm<T>(schema: ZodType<T>, values: unknown): ValidationResult<T> {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors, message: 'Please fix the highlighted fields.' };
}

/** Shared inline field-error renderer styling is in the form components. */
export function firstError(errors: FieldErrors, ...keys: string[]) {
  for (const key of keys) {
    if (errors[key]) return errors[key];
  }
  return undefined;
}
