"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface UploadUrlFieldProps {
  name: string;
  label: string;
  target: "cv" | "avatar";
  defaultValue?: string | null;
  hint?: string;
  accept: string;
}

/** A URL text field plus an upload button. The uploaded file's path is written into the field; saving the form stores it. */
export function UploadUrlField({ name, label, target, defaultValue, hint, accept }: UploadUrlFieldProps) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setSuccess("");
    setError("");
    const body = new FormData();
    body.set("target", target);
    body.set("file", file);
    try {
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Upload failed.");
      setValue(result.url);
      setSuccess("Uploaded. Save the profile to keep it.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1.5 h-11 w-full rounded-base border border-border-strong bg-surface px-3 text-base text-text sm:h-10 sm:text-sm"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          aria-disabled={busy}
          onClick={() => {
            if (!busy) fileInput.current?.click();
          }}
        >
          {busy ? "Uploading..." : `Upload ${label.toLowerCase()} file`}
        </Button>
        {/* Opened by the button above; hidden from assistive technology so it is not announced twice. */}
        <input
          ref={fileInput}
          type="file"
          accept={accept}
          aria-hidden="true"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <div role="status" aria-live="polite" className="text-sm text-muted">
          {success}
        </div>
        <div role="alert" className="text-sm text-danger">
          {error ? <span className="font-medium">Error: </span> : null}
          {error}
        </div>
      </div>
    </div>
  );
}
