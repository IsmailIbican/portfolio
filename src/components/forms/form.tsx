"use client";

import { createContext, useActionState, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/features/shared/form-state";

const FormContext = createContext<FormState>({});

// Text is 16px on small screens so iOS Safari does not zoom on focus.
const controlClass =
  "mt-1.5 w-full rounded-base border border-border-strong bg-surface px-3 text-base text-text placeholder:text-muted sm:text-sm aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger";

/** The latest result of the surrounding ActionForm, for widgets that must react to every submission. */
export const useFormResult = () => useContext(FormContext);

/**
 * A hidden field whose value the server can replace after a submission (`fresh`), or that is kept as submitted
 * after an error (`values`). Used for one-time tokens: a spent token is swapped for a new one.
 */
export function HiddenField({ name, initial }: { name: string; initial: string }) {
  const state = useContext(FormContext);
  return <input type="hidden" name={name} value={state.fresh?.[name] ?? state.values?.[name] ?? initial} readOnly />;
}

interface ActionFormProps {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  /** "panel" shows success as a prominent block above the form (for visitor-facing forms); "inline" is a quiet note. */
  successStyle?: "inline" | "panel";
  children: ReactNode;
}

/** Form wired to a server action: pending state, field errors, a status message, and typed values kept after an error. */
export function ActionForm({ action, submitLabel, pendingLabel = "Saving...", successStyle = "inline", children }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const panel = successStyle === "panel";
  const success = state.ok ? state.message : null;

  // After a failed submit, move focus to the first invalid field so keyboard and screen reader users land on the problem.
  useEffect(() => {
    if (state.errors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return (
    <FormContext.Provider value={state}>
      <form ref={formRef} action={formAction} className="space-y-5">
        {/* Live regions stay mounted so changes to them are announced reliably. */}
        <div
          role="status"
          aria-live="polite"
          className={panel && success ? "rounded-base border border-border-strong bg-surface p-4 text-base text-text" : panel ? "hidden" : "sr-only"}
        >
          {panel ? success : null}
        </div>
        {children}
        <div className="flex flex-wrap items-center gap-4">
          {/* aria-disabled (not disabled) keeps keyboard focus on the button while the request runs. */}
          <Button
            type="submit"
            aria-disabled={pending}
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
          >
            {pending ? pendingLabel : submitLabel}
          </Button>
          {!panel ? (
            <div role="status" aria-live="polite" className="text-sm text-muted">
              {success}
            </div>
          ) : null}
          <div role="alert" className="text-sm text-danger">
            {!state.ok && state.message ? <span className="font-medium">Error: </span> : null}
            {!state.ok ? state.message : null}
          </div>
        </div>
      </form>
    </FormContext.Provider>
  );
}

interface FieldBase {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
  required?: boolean;
}

function useField({ name, defaultValue, hint }: Pick<FieldBase, "name" | "defaultValue" | "hint">) {
  const state = useContext(FormContext);
  const id = useId();
  const errors = state.errors?.[name];
  const describedBy = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean).join(" ");
  return {
    id,
    value: state.values?.[name] ?? defaultValue ?? "",
    error: errors?.[0],
    describedBy: describedBy || undefined,
  };
}

function FieldShell({
  id,
  label,
  hint,
  required,
  error,
  children,
}: Pick<FieldBase, "label" | "hint" | "required"> & { id: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          <span className="font-medium">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  type = "text",
  inputMode,
  autoComplete,
  ...props
}: FieldBase & { type?: "text" | "email" | "url" | "month"; inputMode?: "numeric" | "text"; autoComplete?: string }) {
  const field = useField(props);
  return (
    <FieldShell {...props} id={field.id} error={field.error}>
      <input
        id={field.id}
        name={props.name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={field.value}
        required={props.required}
        aria-invalid={field.error ? true : undefined}
        aria-describedby={field.describedBy}
        className={`${controlClass} h-11 sm:h-10`}
      />
    </FieldShell>
  );
}

export function TextAreaField({ rows = 4, ...props }: FieldBase & { rows?: number }) {
  const field = useField(props);
  return (
    <FieldShell {...props} id={field.id} error={field.error}>
      <textarea
        id={field.id}
        name={props.name}
        rows={rows}
        defaultValue={field.value}
        required={props.required}
        aria-invalid={field.error ? true : undefined}
        aria-describedby={field.describedBy}
        className={`${controlClass} resize-y py-2`}
      />
    </FieldShell>
  );
}

export function SelectField({ options, ...props }: FieldBase & { options: ReadonlyArray<{ value: string; label: string }> }) {
  const field = useField(props);
  return (
    <FieldShell {...props} id={field.id} error={field.error}>
      <select
        id={field.id}
        name={props.name}
        defaultValue={field.value}
        aria-invalid={field.error ? true : undefined}
        aria-describedby={field.describedBy}
        className={`${controlClass} h-11 sm:h-10`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  value,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  /** Needed when several checkboxes share one name (a checkbox group). */
  value?: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          id={id}
          name={name}
          value={value}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="size-5 accent-(--accent)"
        />
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
