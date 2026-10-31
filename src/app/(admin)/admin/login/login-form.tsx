"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "./actions";

const inputClass =
  "mt-1.5 h-11 w-full rounded-base border border-border-strong bg-surface px-3 text-base text-text placeholder:text-muted sm:h-10 sm:text-sm aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const invalid = state.error ? true : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={invalid}
          aria-describedby={state.error ? "login-error" : undefined}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={invalid}
          aria-describedby={state.error ? "login-error" : undefined}
          className={inputClass}
        />
      </div>
      <div role="status" aria-live="polite">
        {state.error ? (
          <p id="login-error" className="text-sm text-danger">
            <span className="font-medium">Error: </span>
            {state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
