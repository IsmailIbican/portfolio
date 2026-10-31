"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";
import { useFormResult } from "./form";

interface TurnstileApi {
  render(element: HTMLElement, options: { sitekey: string; theme: "light" | "dark"; size: "flexible" }): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile challenge, rendered explicitly so it also appears when the visitor arrives by client-side
 * navigation, and reset after every submission (a token can be used only once).
 * It adds a hidden "cf-turnstile-response" field to the surrounding form.
 */
export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const result = useFormResult();

  const mount = useCallback(() => {
    if (!container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
      size: "flexible",
    });
  }, [siteKey]);

  useEffect(() => {
    mount(); // the script may already be loaded from an earlier visit to this page
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [mount]);

  // A new form result means the previous token was spent, successfully or not.
  useEffect(() => {
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [result]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={mount} />
      {/* Reserves the widget's height so the page does not jump when it loads. */}
      <div ref={container} className="min-h-[65px] w-full max-w-full" />
    </>
  );
}
