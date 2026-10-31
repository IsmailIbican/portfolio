"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteForm } from "@/components/admin/delete-form";
import { Button } from "@/components/ui/button";

interface MediaItem {
  id: string;
  url: string;
  alt: string;
}

interface MediaManagerProps {
  projectId: string;
  media: MediaItem[];
  deleteAction: (formData: FormData) => Promise<void>;
}

export function MediaManager({ projectId, media, deleteAction }: MediaManagerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return; // aria-disabled keeps focus on the button, so the guard lives here
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set("target", "project-media");
    body.set("projectId", projectId);

    setBusy(true);
    setSuccess("");
    setError("");
    try {
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      form.reset();
      setSuccess("Image added.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {media.length === 0 ? (
        <p className="text-sm text-muted">No images yet. The first image is used as the cover.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {media.map((item, index) => (
            <li key={item.id} className="rounded-base border border-border p-3">
              <div className="relative aspect-video overflow-hidden rounded-base bg-surface">
                <Image src={item.url} alt={item.alt} fill sizes="(min-width: 640px) 320px, 100vw" className="object-cover" />
              </div>
              <p className="mt-2 text-sm">{item.alt}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted">{index === 0 ? "Cover" : `Image ${index + 1}`}</span>
                <DeleteForm
                  action={deleteAction}
                  id={item.id}
                  label={`Delete image ${index + 1}: ${item.alt}`}
                  confirmMessage="Delete this image? This cannot be undone."
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={upload} className="mt-6 space-y-4 rounded-base border border-border bg-surface p-4">
        <p className="text-sm font-medium">Add an image</p>
        <div>
          <label htmlFor="media-file" className="text-sm">
            File (JPG, PNG or WebP, up to 4 MB)
          </label>
          <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1.5 block w-full text-sm" />
        </div>
        <div>
          <label htmlFor="media-alt" className="text-sm">
            Description <span aria-hidden="true">*</span>
          </label>
          <input
            id="media-alt"
            name="alt"
            required
            maxLength={200}
            aria-describedby="media-alt-hint"
            className="mt-1.5 h-11 w-full rounded-base border border-border-strong bg-surface px-3 text-base sm:h-10 sm:text-sm"
          />
          <p id="media-alt-hint" className="mt-1 text-xs text-muted">
            Describe what the image shows, for people who cannot see it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" aria-disabled={busy}>
            {busy ? "Uploading..." : "Upload"}
          </Button>
          <div role="status" aria-live="polite" className="text-sm text-muted">
            {success}
          </div>
          <div role="alert" className="text-sm text-danger">
            {error ? <span className="font-medium">Error: </span> : null}
            {error}
          </div>
        </div>
      </form>
    </div>
  );
}
