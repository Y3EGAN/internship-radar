import { requireOwner } from "../../lib/auth";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  const { user } = await requireOwner();
  return <DashboardShell ownerId={user.id}>{children}</DashboardShell>;
}
