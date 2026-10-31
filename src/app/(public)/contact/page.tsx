import type { Metadata } from "next";
import { ActionForm, HiddenField, TextAreaField, TextField } from "@/components/forms/form";
import { TurnstileWidget } from "@/components/forms/turnstile-widget";
import { createFormToken, HONEYPOT_FIELD } from "@/features/contact/protection";
import { getTurnstileConfig } from "@/features/contact/turnstile";
import { getContactMailto, getSocialLinks } from "@/features/profile/links";
import { getProfile } from "@/features/profile/service";
import { getDb } from "@/lib/db";
import { submitContactAction } from "./actions";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");

  const profile = await getProfile(getDb());
  const mailto = getContactMailto(profile);
  const links = getSocialLinks(profile);

  // The same helper the server action uses: the widget appears exactly when the server will ask for it.
  const turnstile = getTurnstileConfig();

  return (
    <div className="relative max-w-(--container-prose) pt-16 sm:pt-24">
      <h1 className="hero-in text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
      <p className="hero-in mt-4 text-muted" style={{ "--i": 1 } as React.CSSProperties}>
        Send a message with the form below{mailto ? " or write to me directly" : ""}.
      </p>

      {mailto || links.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-x-5 text-sm">
          {mailto ? (
            <li>
              <a href={mailto} className="inline-flex min-h-11 items-center underline underline-offset-4">
                {profile?.contactEmail}
              </a>
            </li>
          ) : null}
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                rel="noopener noreferrer"
                target="_blank"
                className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 transition-colors duration-(--duration-hover) hover:text-text"
              >
                {link.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-10">
        <ActionForm action={submitContactAction} submitLabel="Send message" pendingLabel="Sending..." successStyle="panel">
          <p className="text-sm text-muted">Fields marked * are required.</p>
          <TextField name="name" label="Name" required autoComplete="name" />
          <TextField name="email" type="email" label="Email" required autoComplete="email" hint="Used only to reply to you." />
          <TextAreaField name="message" label="Message" required rows={7} />

          {/* One-time signed token: a form posted instantly, without this page, or twice with the same token is refused. */}
          <HiddenField name="formToken" initial={createFormToken(secret)} />
          {/* Honeypot: invisible to people, tempting to bots. The name is deliberately not "website", "url" or
              "email", which browsers and password managers like to autofill for real visitors. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Leave this field empty
              <input
                type="text"
                name={HONEYPOT_FIELD}
                tabIndex={-1}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
              />
            </label>
          </div>

          {turnstile ? <TurnstileWidget siteKey={turnstile.siteKey} /> : null}
          <p className="text-sm text-muted">Your name, email and message are stored only so I can reply to you.</p>
        </ActionForm>
      </div>
    </div>
  );
}
