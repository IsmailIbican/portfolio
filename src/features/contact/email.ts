import type { ContactInput } from "./schema";

const RESEND_URL = "https://api.resend.com/emails";

export interface EmailConfig {
  apiKey: string;
  to: string;
  from: string;
}

/** Reads the notification settings. Returns null when any of them is missing, which simply turns notifications off. */
export function getEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.EMAIL_PROVIDER_API_KEY?.trim();
  const to = env.CONTACT_TO_EMAIL?.trim();
  const from = env.EMAIL_FROM?.trim();
  return apiKey && to && from ? { apiKey, to, from } : null;
}

export type NotifyResult = "sent" | "skipped" | "failed";

/**
 * Emails you a copy of a new message through Resend's HTTP API. The message is already saved in the database
 * before this runs, so a failure here never loses it.
 */
export async function notifyNewMessage(
  message: ContactInput,
  config: EmailConfig | null,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  if (!config) return "skipped";

  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        // Replying to the notification answers the visitor.
        reply_to: message.email,
        // Fixed prefix, and the visitor-chosen name is shortened, so the subject cannot pose as something else.
        subject: `[Portfolio contact] ${message.name.slice(0, 60)}`,
        text: `From: ${message.name} <${message.email}>\n\n${message.message}`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
