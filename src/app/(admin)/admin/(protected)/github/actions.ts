"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { fetchRepo, GithubError } from "@/features/github/client";
import { importRepo, syncFromGithub } from "@/features/github/service";
import { getProfile } from "@/features/profile/service";
import { getDb } from "@/lib/db";
import { revalidatePublic } from "@/lib/revalidate";
import { requireAdmin } from "@/lib/session";

// Results travel as short codes in the URL (never free text), and the page turns them into messages.
const GITHUB_TOKEN = () => process.env.GITHUB_TOKEN || undefined;

const noticeFor = (error: unknown) => (error instanceof GithubError ? error.kind : "unavailable");

async function configuredUsername() {
  const profile = await getProfile(getDb());
  return profile?.githubUsername ?? null;
}

/** Imports one repository. The metadata is re-fetched from GitHub here; nothing from the form is trusted except the name. */
export async function importRepoAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const username = await configuredUsername();
  if (!username) redirect("/admin/github?notice=no-username");

  let target: string;
  try {
    const repo = await fetchRepo(String(formData.get("fullName") ?? ""), { token: GITHUB_TOKEN() });
    // Only repositories of the configured account can be imported.
    if (repo.ownerLogin.toLowerCase() !== username.toLowerCase()) redirect("/admin/github?notice=not-owner");

    const result = await importRepo(getDb(), repo);
    revalidatePublic();
    target = result.projectId ? `/admin/projects/${result.projectId}` : "/admin/github?notice=already-imported";
  } catch (error) {
    // redirect() works by throwing; Next's own helper lets those through and nothing else.
    unstable_rethrow(error);
    redirect(`/admin/github?notice=${noticeFor(error)}`);
  }
  redirect(target);
}

/** Refreshes stars, language and last-push date of every linked project. */
export async function syncAction(): Promise<void> {
  await requireAdmin();

  const username = await configuredUsername();
  if (!username) redirect("/admin/github?notice=no-username");

  let query: string;
  try {
    const summary = await syncFromGithub(getDb(), username, { token: GITHUB_TOKEN() });
    revalidatePublic();
    query = `synced=${summary.updated}&missing=${summary.missing.length}`;
  } catch (error) {
    query = `notice=${noticeFor(error)}`;
  }
  redirect(`/admin/github?${query}`);
}
