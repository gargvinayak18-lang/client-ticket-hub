import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TicketIcon, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { role, user } = useAuth();
  const [stats, setStats] = useState({ open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tickets").select("status");
      const s = { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 };
      (data ?? []).forEach((t: any) => {
        s.total++;
        s[t.status as keyof typeof s]++;
      });
      setStats(s);
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {role === "admin" ? "Overview of all tickets" : `Welcome back, ${user?.email}`}
          </p>
        </div>
        {role === "client" && (
          <Button asChild>
            <Link to="/tickets/new">
              <Plus className="h-4 w-4 mr-2" /> New Ticket
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, color: "bg-primary text-primary-foreground" },
          { label: "Open", value: stats.open, color: "bg-accent text-accent-foreground" },
          { label: "In Progress", value: stats.in_progress, color: "bg-secondary text-secondary-foreground border" },
          { label: "Resolved", value: stats.resolved, color: "bg-secondary text-secondary-foreground border" },
          { label: "Closed", value: stats.closed, color: "bg-secondary text-secondary-foreground border" },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`h-10 w-10 rounded-lg grid place-items-center mb-3 ${s.color}`}>
              <TicketIcon className="h-5 w-5" />
            </div>
            <div className="text-3xl font-semibold">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-2">Getting started</h2>
        <p className="text-sm text-muted-foreground">
          {role === "admin"
            ? "Create client accounts under Clients, then assign websites to them under Websites."
            : "Head to Tickets to raise an issue or request an improvement for one of your websites."}
        </p>
      </Card>
    </div>
  );
}