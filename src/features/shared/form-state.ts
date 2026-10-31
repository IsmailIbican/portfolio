import { z } from "zod";

export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  /** Submitted values, echoed back so the form keeps what the user typed after an error. */
  values?: Record<string, string>;
  /** Values the server wants the form to use from now on (for example a new one-time token after a success). */
  fresh?: Record<string, string>;
}

/** Text fields of a submission. Pass `only` to echo back just the fields the form really has. */
export function formValues(formData: FormData, only?: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && (!only || only.includes(key))) values[key] = value;
  }
  return values;
}

export function fromZodError(error: z.ZodError, formData: FormData, only?: readonly string[]): FormState {
  return {
    message: "Please fix the fields marked with an error.",
    errors: z.flattenError(error).fieldErrors,
    values: formValues(formData, only),
  };
}
