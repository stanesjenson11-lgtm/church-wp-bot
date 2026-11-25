import { AppShell } from "@/components/shell/app-shell";

/**
 * The admin shell.
 *
 * This layout is convenience, NOT the authorisation boundary. It keeps a
 * signed-out visitor from seeing the navigation, but every /api route checks
 * the session and role for itself.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="admin">{children}</AppShell>;
}
