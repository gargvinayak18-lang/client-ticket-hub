import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";

type TicketSearch = {
  status?: "total" | "open" | "in_progress" | "resolved" | "closed";
};

export const Route = createFileRoute("/_authenticated/tickets/")({
  component: TicketsList,
  validateSearch: (search: Record<string, unknown>): TicketSearch => {
    return {
      status: (search.status as any) || "total"
    };
  }
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
  const navigate = useNavigate();
  const { status: activeStatusFilter } = Route.useSearch();
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [websites, setWebsites] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const isStaff = role && role !== "client";

  const canChangeStatus = role === "admin" || role === "pm";

  const load = async () => {
    setLoading(true);
    const { data: ts } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
    setTickets(ts ?? []);
    const { data: ws } = await supabase.from("websites").select("id, name, url");
    const wMap: Record<string, any> = {};
    (ws ?? []).forEach((w) => (wMap[w.id] = w));
    setWebsites(wMap);
    if (isStaff) {
      const { data: ps } = await supabase.from("profiles").select("id, email, full_name");
      const pMap: Record<string, any> = {};
      (ps ?? []).forEach((p) => (pMap[p.id] = p));
      setProfiles(pMap);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [role]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("tickets").update({ status: status as any }).eq("id", id);
    load();
  };

  const filteredTickets = ((!activeStatusFilter || activeStatusFilter === "total")
    ? tickets
    : tickets.filter(t => t.status === activeStatusFilter)
  ).filter(t => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      (t.title?.toLowerCase() || "").includes(term) ||
      (t.description?.toLowerCase() || "").includes(term) ||
      (websites[t.website_id]?.name?.toLowerCase() || "").includes(term) ||
      (profiles[t.client_id]?.full_name?.toLowerCase() || "").includes(term) ||
      (profiles[t.client_id]?.email?.toLowerCase() || "").includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Tickets</h1>
          <p className="text-muted-foreground mt-1">
            {isStaff ? "All client tickets" : "Your tickets"}
          </p>
        </div>
        {role === "client" && (
          <Button asChild>
            <Link to="/tickets/new"><Plus className="h-4 w-4 mr-2" /> New Ticket</Link>
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 border-border/60">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "total", label: "All Logs" },
            { key: "open", label: "Open" },
            { key: "in_progress", label: "In Progress" },
            { key: "resolved", label: "In Review" },
            { key: "closed", label: "Closed" },
          ].map(tab => {
            const isActive = (activeStatusFilter || "total") === tab.key;
            const count = tab.key === "total" ? tickets.length : tickets.filter(t => t.status === tab.key).length;
            return (
              <Button
                key={tab.key}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-full transition-all shadow-none",
                  isActive ? "shadow-sm" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => navigate({ search: { status: tab.key as any } })}
              >
                {tab.label}
                <span className={cn(
                  "ml-1.5 py-0.5 px-1.5 rounded-md text-[9px] font-black tracking-normal",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
        
        <div className="relative w-full md:w-72 flex-shrink-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title, client or website..."
            className="pl-9 text-xs h-9 rounded-full shadow-none bg-background/50 border-muted-foreground/20 focus-visible:ring-1 focus-visible:border-primary transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : filteredTickets.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground font-medium italic">No {activeStatusFilter !== "total" ? activeStatusFilter?.replace("_", " ") : ""} tickets found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <Card 
              key={t.id} 
              className="p-5 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md bg-card"
              onClick={() => navigate({ to: "/tickets/$ticketId", params: { ticketId: t.id } })}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">{t.title}</h3>
                    <Badge className={priorityColor[t.priority]} variant="secondary">{t.priority}</Badge>
                    <Badge variant="outline" className="capitalize">
                      {t.type === "enhancement" ? "Enhancement" : (t.type === "improvement" ? "Improvement" : (t.type === "issue" ? "Issue" : t.type))}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                  <div className="text-xs text-muted-foreground mt-2 flex gap-3 flex-wrap">
                    <span>Website: {websites[t.website_id]?.name ?? "—"}</span>
                    {isStaff && (
                      <span>Client: {profiles[t.client_id]?.full_name || profiles[t.client_id]?.email || "—"}</span>
                    )}
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  {canChangeStatus ? (
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">In Review</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusColor[t.status]}>
                      {t.status === "resolved" ? "In Review" : t.status.replace("_", " ")}
                    </Badge>
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