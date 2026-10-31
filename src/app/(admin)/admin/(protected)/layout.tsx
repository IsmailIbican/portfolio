import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdmin } from "@/lib/session";
import { logoutAction } from "./actions";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AdminSidebar email={user.email} logout={logoutAction} />
      <main id="content" className="flex-1 p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
