import { ActionForm, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/form";
import type { Project, Technology } from "@/generated/prisma/client";
import { createProjectAction, updateProjectAction } from "./actions";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft (hidden from the site)" },
  { value: "PUBLISHED", label: "Published (visible on the site)" },
];

interface ProjectFormProps {
  project?: Project;
  technologies: Technology[];
  selectedTechnologyIds?: string[];
}

export function ProjectForm({ project, technologies, selectedTechnologyIds = [] }: ProjectFormProps) {
  return (
    <ActionForm action={project ? updateProjectAction : createProjectAction} submitLabel={project ? "Save changes" : "Create project"}>
      {project ? <input type="hidden" name="id" value={project.id} /> : null}

      <fieldset className="space-y-5">
        <legend className="mb-1 text-sm font-semibold">Basics</legend>
        <TextField name="title" label="Title" required defaultValue={project?.title} />
        <TextField
          name="slug"
          label="URL name"
          defaultValue={project?.slug}
          hint={project ? "Part of the project's web address. Changing it breaks existing links." : "Leave empty to create it from the title."}
        />
        <TextAreaField name="summary" label="Summary" required rows={2} defaultValue={project?.summary} hint="One or two sentences shown on cards." />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="repoUrl" type="url" label="Repository URL" defaultValue={project?.repoUrl} />
          <TextField name="liveUrl" type="url" label="Live demo URL" defaultValue={project?.liveUrl} />
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-sm font-semibold">Details (all optional, empty sections are hidden)</legend>
        <TextAreaField name="overview" label="Overview" rows={4} defaultValue={project?.overview} />
        <TextAreaField name="problem" label="Problem" rows={4} defaultValue={project?.problem} />
        <TextAreaField name="solution" label="Solution" rows={4} defaultValue={project?.solution} />
        <TextAreaField name="architecture" label="Technical architecture" rows={4} defaultValue={project?.architecture} />
        <TextAreaField name="implementation" label="Implementation details" rows={4} defaultValue={project?.implementation} />
        <TextAreaField name="challenges" label="Challenges" rows={4} defaultValue={project?.challenges} />
        <TextAreaField name="results" label="Results" rows={4} defaultValue={project?.results} />
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Technologies</legend>
        {technologies.length === 0 ? (
          <p className="text-sm text-muted">No technologies yet. Add some under Technologies first.</p>
        ) : (
          <div className="grid gap-x-6 sm:grid-cols-2">
            {technologies.map((technology) => (
              <CheckboxField
                key={technology.id}
                name="technologyIds"
                value={technology.id}
                label={technology.name}
                defaultChecked={selectedTechnologyIds.includes(technology.id)}
              />
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-sm font-semibold">Publishing</legend>
        <SelectField
          name="status"
          label="Visibility"
          options={STATUS_OPTIONS}
          defaultValue={project?.status ?? "DRAFT"}
          hint="New projects start as drafts and stay hidden from the site until you choose Published."
        />
        <CheckboxField name="featured" label="Featured" defaultChecked={project?.featured} hint="Featured projects are listed first and shown on the home page." />
        <TextField name="sortOrder" inputMode="numeric" label="Order" defaultValue={String(project?.sortOrder ?? 0)} hint="Lower numbers come first." />
      </fieldset>
    </ActionForm>
  );
}
