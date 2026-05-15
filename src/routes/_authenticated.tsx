import { createFileRoute, Navigate, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { TicketIcon, LayoutDashboard, Users, LogOut, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { session, role, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;

  const isAdmin = role === "admin";
  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/tickets", label: "Tickets", icon: TicketIcon },
    ...(isAdmin
      ? [
          { to: "/admin/clients", label: "Clients", icon: Users },
          { to: "/admin/websites", label: "Websites", icon: Globe },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <aside className="fixed inset-y-0 left-0 w-60 bg-primary text-primary-foreground flex flex-col">
        <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent grid place-items-center">
            <TicketIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Helpdesk</div>
            <div className="text-xs opacity-70">{isAdmin ? "Admin" : "Client"}</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const active = location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="text-xs opacity-70 px-3 pb-2 truncate">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="ml-60 p-8">
        <Outlet />
      </main>
    </div>
  );
}