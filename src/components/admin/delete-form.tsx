"use client";

import { Button } from "@/components/ui/button";

interface DeleteFormProps {
  action: (formData: FormData) => Promise<void>;
  id: string;
  confirmMessage: string;
  /** Accessible name that says what is deleted, so a list of delete buttons is not a list of identical "Delete"s. */
  label: string;
}

/** Delete button that asks for confirmation first. The server action still re-checks authorization. */
export function DeleteForm({ action, id, confirmMessage, label }: DeleteFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" aria-label={label} className="text-danger hover:text-danger hover:opacity-80">
        Delete
      </Button>
    </form>
  );
}
