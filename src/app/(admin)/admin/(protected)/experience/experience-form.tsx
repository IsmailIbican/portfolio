import { ActionForm, SelectField, TextAreaField, TextField } from "@/components/forms/form";
import type { Experience } from "@/generated/prisma/client";
import { toMonthInput } from "@/lib/dates";
import { createExperienceAction, updateExperienceAction } from "./actions";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft (hidden from the site)" },
  { value: "PUBLISHED", label: "Published (visible on the site)" },
];

export function ExperienceForm({ experience }: { experience?: Experience }) {
  return (
    <ActionForm action={experience ? updateExperienceAction : createExperienceAction} submitLabel={experience ? "Save changes" : "Add experience"}>
      {experience ? <input type="hidden" name="id" value={experience.id} /> : null}
      <TextField name="company" label="Company" required defaultValue={experience?.company} />
      <TextField name="role" label="Role" required defaultValue={experience?.role} />
      <TextField name="location" label="Location" defaultValue={experience?.location} hint="City, country or Remote." />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="startDate" type="month" label="Start" required defaultValue={toMonthInput(experience?.startDate)} />
        <TextField name="endDate" type="month" label="End" defaultValue={toMonthInput(experience?.endDate)} hint="Leave empty if this is your current role." />
      </div>
      <TextAreaField name="description" label="Description" required rows={6} defaultValue={experience?.description} hint="What you did and the outcome. Plain text." />
      <SelectField name="status" label="Visibility" options={STATUS_OPTIONS} defaultValue={experience?.status ?? "DRAFT"} hint="New entries start as drafts so nothing goes live half-written. Choose Published when ready." />
    </ActionForm>
  );
}
