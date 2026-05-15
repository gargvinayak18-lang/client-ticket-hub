import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/tickets/")({
  component: TicketsList,
});

const statusColor: Record<string, string> = {
  open: "bg-accent text-accent-foreground",
  in_progress: "bg-primary text-primary-foreground",
  resolved: "bg-emerald-600 text-white",
  closed: "bg-muted text-muted-foreground",
};
const priorityColor: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

function TicketsList() {
  const { role } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [websites, setWebsites] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: ts } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
    setTickets(ts ?? []);
    const { data: ws } = await supabase.from("websites").select("id, name, url");
    const wMap: Record<string, any> = {};
    (ws ?? []).forEach((w) => (wMap[w.id] = w));
    setWebsites(wMap);
    if (role === "admin") {
      const { data: ps } = await supabase.from("profiles").select("id, email, full_name");
      const pMap: Record<string, any> = {};
      (ps ?? []).forEach((p) => (pMap[p.id] = p));
      setProfiles(pMap);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [role]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("tickets").update({ status }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Tickets</h1>
          <p className="text-muted-foreground mt-1">
            {role === "admin" ? "All client tickets" : "Your tickets"}
          </p>
        </div>
        {role === "client" && (
          <Button asChild>
            <Link to="/tickets/new"><Plus className="h-4 w-4 mr-2" /> New Ticket</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : tickets.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No tickets yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">{t.title}</h3>
                    <Badge className={priorityColor[t.priority]} variant="secondary">{t.priority}</Badge>
                    <Badge variant="outline">{t.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                  <div className="text-xs text-muted-foreground mt-2 flex gap-3 flex-wrap">
                    <span>Website: {websites[t.website_id]?.name ?? "—"}</span>
                    {role === "admin" && (
                      <span>Client: {profiles[t.client_id]?.email ?? "—"}</span>
                    )}
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  {role === "admin" ? (
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusColor[t.status]}>{t.status.replace("_", " ")}</Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}