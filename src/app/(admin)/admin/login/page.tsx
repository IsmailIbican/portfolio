import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Admin sign in" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/admin");

  return (
    <main id="content" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Sign in to manage the portfolio.</p>
      <LoginForm />
    </main>
  );
}
