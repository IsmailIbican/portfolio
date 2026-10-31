import { ActionForm, TextAreaField, TextField } from "@/components/forms/form";
import { UploadUrlField } from "@/components/admin/upload-url-field";
import { getProfile, getSiteSettings } from "@/features/profile/service";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { saveProfileAction } from "./actions";

export const metadata = { title: "Profile" };

export default async function AdminProfilePage() {
  await requireAdmin();
  const db = getDb();
  const [profile, settings] = await Promise.all([getProfile(db), getSiteSettings(db)]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-muted">Everything here appears publicly. Leave a field empty to hide it.</p>

      <div className="mt-8">
        <ActionForm action={saveProfileAction} submitLabel="Save profile">
          <fieldset className="space-y-5">
            <legend className="mb-1 text-sm font-semibold">Identity</legend>
            <TextField name="fullName" label="Full name" defaultValue={profile?.fullName} />
            <TextField name="headline" label="Headline" defaultValue={profile?.headline} hint="One line, e.g. your role." />
            <TextField name="location" label="Location" defaultValue={profile?.location} />
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="mb-1 text-sm font-semibold">Text</legend>
            <TextAreaField name="statement" label="Engineering statement" rows={3} defaultValue={profile?.statement} hint="1-2 sentences shown on the home page." />
            <TextAreaField name="bio" label="Biography" rows={8} defaultValue={profile?.bio} hint="Separate paragraphs with a blank line." />
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="mb-1 text-sm font-semibold">Contact and links</legend>
            <TextField name="contactEmail" type="email" label="Public contact email" defaultValue={profile?.contactEmail} />
            <TextField name="githubUsername" label="GitHub username" defaultValue={profile?.githubUsername} hint="Username only. Used by the GitHub integration later." />
            <TextField name="linkedinUrl" type="url" label="LinkedIn URL" defaultValue={profile?.linkedinUrl} />
            <TextField name="xUrl" type="url" label="X URL" defaultValue={profile?.xUrl} />
            <TextField name="websiteUrl" type="url" label="Website URL" defaultValue={profile?.websiteUrl} />
            <UploadUrlField name="cvUrl" label="CV" target="cv" accept="application/pdf" defaultValue={profile?.cvUrl} hint="Upload a PDF (up to 4 MB) or paste a link." />
            <UploadUrlField name="avatarUrl" label="Photo" target="avatar" accept="image/jpeg,image/png,image/webp" defaultValue={profile?.avatarUrl} hint="JPG, PNG or WebP, up to 4 MB, or paste a link." />
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="mb-1 text-sm font-semibold">Site</legend>
            <TextField name="siteTitle" label="Site title" defaultValue={settings?.siteTitle} hint="Browser tab and search results." />
            <TextAreaField name="siteDescription" label="Site description" rows={2} defaultValue={settings?.siteDescription} hint="About 155 characters works best." />
          </fieldset>
        </ActionForm>
      </div>
    </div>
  );
}
