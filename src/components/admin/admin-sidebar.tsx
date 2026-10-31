import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { AdminNav } from "./admin-nav";

interface AdminSidebarProps {
  email: string;
  logout: () => Promise<void>;
}

export function AdminSidebar({ email, logout }: AdminSidebarProps) {
  return (
    <aside className="flex w-full flex-col gap-4 border-b border-border p-4 md:min-h-dvh md:w-60 md:gap-6 md:border-r md:border-b-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Admin</span>
        <ThemeToggle />
      </div>
      <AdminNav />
      <div className="space-y-3 md:mt-auto">
        <p className="truncate text-xs text-muted" title={email}>
          {email}
        </p>
        <form action={logout}>
          <Button type="submit" variant="secondary" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
