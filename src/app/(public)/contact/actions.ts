"use server";

import { headers } from "next/headers";
import { getEmailConfig, notifyNewMessage } from "@/features/contact/email";
import {
  createFormToken,
  getClientIp,
  hashIp,
  HONEYPOT_FIELD,
  tokenHash,
  trustedProxyHops,
  verifyFormToken,
} from "@/features/contact/protection";
import { contactSchema } from "@/features/contact/schema";
import { submitMessage } from "@/features/contact/service";
import { getTurnstileConfig, verifyTurnstile } from "@/features/contact/turnstile";
import { formValues, fromZodError, type FormState } from "@/features/shared/form-state";
import { getDb } from "@/lib/db";

const THANKS = "Thank you. Your message was sent and I will reply by email.";
const RELOAD = "Something went wrong. Please reload the page and try again.";

// Only the fields the form really has are echoed back, never arbitrary extra input.
const ECHO = ["name", "email", "message", "formToken"] as const;

const refuse = (message: string, formData: FormData): FormState => ({ message, values: formValues(formData, ECHO) });

/**
 * Public contact form. Order matters: cheap checks first, the database last.
 * Refusals that would help a bot (token, Turnstile) share one message; the rate-limit message is distinct because
 * a real visitor needs to know to wait.
 */
export async function submitContactAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");

  // A spent token is replaced, so the same open page can send another message later.
  const nextToken = () => ({ formToken: createFormToken(secret) });

  // Honeypot: real visitors never see this field. Bots that fill it get a fake success and nothing is stored.
  if (String(formData.get(HONEYPOT_FIELD) ?? "") !== "") return { ok: true, message: THANKS, fresh: nextToken() };

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData, ECHO);

  const token = formData.get("formToken");
  if (typeof token !== "string" || !verifyFormToken(secret, token)) return refuse(RELOAD, formData);

  const ip = getClientIp(await headers(), trustedProxyHops());

  const turnstile = getTurnstileConfig();
  if (turnstile && !(await verifyTurnstile(formData.get("cf-turnstile-response"), { secret: turnstile.secret, ip: ip ?? undefined }))) {
    return refuse(RELOAD, formData);
  }

  let outcome;
  try {
    outcome = await submitMessage(getDb(), parsed.data, {
      ipHash: ip ? hashIp(secret, ip) : null,
      formTokenHash: tokenHash(token),
    });
  } catch (error) {
    // Log what failed, never who wrote to us. The visitor keeps what they typed.
    console.error("contact: could not save a message:", error instanceof Error ? error.name : "unknown error");
    return refuse("Your message could not be sent right now. Please try again later.", formData);
  }

  if (outcome === "rate-limited") return refuse("Too many messages from your connection. Please try again later.", formData);
  if (outcome === "duplicate") return refuse(RELOAD, formData);

  // The message is safely stored; a failed notification must not turn this into an error for the visitor.
  if ((await notifyNewMessage(parsed.data, getEmailConfig())) === "failed") {
    console.error("contact: notification email could not be sent");
  }

  return { ok: true, message: THANKS, fresh: nextToken() };
}
