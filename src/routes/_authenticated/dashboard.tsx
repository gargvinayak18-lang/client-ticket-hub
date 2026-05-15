import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TicketIcon, Plus, Clock, CheckCircle2, AlertCircle, LayoutGrid, RefreshCw, Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type FilterType = "total" | TicketStatus;

const columns: { status: TicketStatus; label: string; color: string; bg: string }[] = [
  { status: "open", label: "Open", color: "text-orange-600 border-orange-200", bg: "bg-orange-50 dark:bg-orange-950/20" },
  { status: "in_progress", label: "In Progress", color: "text-blue-600 border-blue-200", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { status: "resolved", label: "In Review", color: "text-emerald-600 border-emerald-200", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  { status: "closed", label: "Closed", color: "text-slate-600 border-slate-200", bg: "bg-slate-50 dark:bg-slate-950/20" },
];

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

function Dashboard() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [websites, setWebsites] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Interactive filtering
  const [filter, setFilter] = useState<FilterType>("total");
  const [searchQuery, setSearchQuery] = useState("");

  const isStaff = role && role !== "client";

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: ts } = await supabase.from("tickets").select("*").order("updated_at", { ascending: false });
      setTickets(ts ?? []);

      const { data: ws } = await supabase.from("websites").select("id, name");
      const wMap: Record<string, any> = {};
      (ws ?? []).forEach((w) => (wMap[w.id] = w));
      setWebsites(wMap);

      if (isStaff) {
        const { data: ps } = await supabase.from("profiles").select("id, email, full_name");
        const pMap: Record<string, any> = {};
        (ps ?? []).forEach((p) => (pMap[p.id] = p));
        setProfiles(pMap);
      }
    } catch (e: any) {
      toast.error("Failed to load dashboard content.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  // Handle updating ticket status (Drag and Drop)
  const handleUpdateStatus = async (ticketId: string, nextStatus: TicketStatus) => {
    const t = tickets.find(x => x.id === ticketId);
    if (!t || t.status === nextStatus) return;

    setUpdatingId(ticketId);
    // Optimistic update
    const prevTickets = [...tickets];
    setTickets(tickets.map(x => x.id === ticketId ? { ...x, status: nextStatus } : x));

    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      
      if (error) throw error;
      const displayStatus = nextStatus === "resolved" ? "In Review" : nextStatus.replace("_", " ");
      toast.success(`Ticket status updated to ${displayStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to move ticket.");
      setTickets(prevTickets); // Rollback
    } finally {
      setUpdatingId(null);
    }
  };

  // Compute initial search-filtered logs globally
  const searchedTickets = tickets.filter(t => {
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

  // Calculate interactive counts based on live search query
  const stats = {
    total: searchedTickets.length,
    open: searchedTickets.filter((t) => t.status === "open").length,
    in_progress: searchedTickets.filter((t) => t.status === "in_progress").length,
    resolved: searchedTickets.filter((t) => t.status === "resolved").length,
    closed: searchedTickets.filter((t) => t.status === "closed").length,
  };

  const filteredTickets = filter === "total" ? searchedTickets : searchedTickets.filter((t) => t.status === filter);

  return (
    <div className="space-y-6 max-w-7xl h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workboard</h1>
          <p className="text-muted-foreground mt-1">
            {isStaff ? "Track and review active client tickets" : `Viewing tickets for ${user?.email}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks & websites..."
              className="pl-9 h-9 text-xs rounded-full shadow-none border-muted-foreground/20 bg-background/40 focus-visible:ring-1 focus-visible:border-primary transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading} className="rounded-full shadow-none hover:bg-muted/50 flex-shrink-0">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          {role === "client" && (
            <Button asChild className="rounded-full shadow-sm flex-shrink-0">
              <Link to="/tickets/new">
                <Plus className="h-4 w-4 mr-2" /> New Ticket
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Filter Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 flex-shrink-0">
        {[
          { type: "total" as const, label: "Total Tickets", val: stats.total, icon: LayoutGrid, activeColor: "border-primary ring-1 ring-primary" },
          { type: "open" as const, label: "Open Issues", val: stats.open, icon: AlertCircle, activeColor: "border-orange-500 ring-1 ring-orange-500 bg-orange-50/20" },
          { type: "in_progress" as const, label: "In Progress", val: stats.in_progress, icon: Clock, activeColor: "border-blue-500 ring-1 ring-blue-500 bg-blue-50/20" },
          { type: "resolved" as const, label: "In Review", val: stats.resolved, icon: CheckCircle2, activeColor: "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/20" },
          { type: "closed" as const, label: "Closed Logs", val: stats.closed, icon: TicketIcon, activeColor: "border-slate-500 ring-1 ring-slate-500 bg-slate-50/20" },
        ].map((item) => {
          const isActive = filter === item.type;
          const Icon = item.icon;
          return (
            <Card 
              key={item.type} 
              className={cn(
                "p-4 flex flex-col cursor-pointer transition-all duration-200 hover:scale-[1.02] select-none relative overflow-hidden border-2 shadow-sm hover:shadow-md",
                isActive ? item.activeColor : "border-border bg-card/70 hover:border-muted-foreground/30 border-transparent"
              )}
              onClick={() => setFilter(item.type)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-md", isActive ? "bg-background shadow-sm text-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className={cn(
                  "text-[10px] px-2 py-0.5 font-black tracking-wide uppercase rounded-full flex items-center gap-0.5 border transition-all",
                  isActive 
                    ? "bg-primary/10 text-primary border-primary/20" 
                    : "bg-muted text-muted-foreground border-transparent"
                )}>
                  {isActive ? "Active View" : "Expand →"}
                </div>
              </div>
              <div className="text-2xl font-bold leading-tight">{item.val}</div>
              <div className="text-xs text-muted-foreground font-medium">{item.label}</div>
            </Card>
          );
        })}
      </div>

      {/* Kanban View */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {loading && tickets.length === 0 ? (
          <div className="h-full grid place-items-center text-muted-foreground">Preparing board...</div>
        ) : (
          <div className={cn(
            filter === "total" 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-hidden min-h-0"
              : "w-full flex flex-col flex-1 overflow-hidden min-h-0"
          )}>
            {columns.filter((col) => filter === "total" || col.status === filter).map((col) => {
              const columnTickets = filteredTickets.filter((t) => t.status === col.status);
              // Determine if column is disabled by active filter
              const isDisabled = filter !== "total" && filter !== col.status;

              return (
                <div 
                  key={col.status} 
                  className={cn(
                    "rounded-lg border flex flex-col h-full min-h-0 transition-all duration-300 overflow-hidden shadow-inner",
                    col.bg,
                    isDisabled ? "opacity-30 scale-[0.98] border-transparent bg-muted/40" : "border-border bg-background/40"
                  )}
                  onDragOver={(e) => {
                    if (!isDisabled && isStaff) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (isDisabled || !isStaff) return;
                    const id = e.dataTransfer.getData("ticketId");
                    if (id) handleUpdateStatus(id, col.status);
                  }}
                >
                  {/* Column Header */}
                  <div className="p-4 font-black flex items-center justify-between border-b bg-card flex-shrink-0 select-none shadow-sm">
                    <span className={cn("text-xs uppercase tracking-wider flex items-center gap-2.5", col.color)}>
                      <div className={cn("h-2.5 w-2.5 rounded-full bg-current shadow-sm")} />
                      {col.label}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-black rounded-md px-2 py-0.5">
                      {columnTickets.length} Item{columnTickets.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {/* Column Content */}
                  <div className={cn(
                    "flex-1 overflow-y-auto p-4 min-h-0 scrollbar-thin transition-all",
                    filter === "total"
                      ? "space-y-3"
                      : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                  )}>
                    {columnTickets.map((t) => (
                      <Card 
                        key={t.id} 
                        draggable={isStaff && !isDisabled}
                        onDragStart={(e) => {
                          if(isStaff) {
                            e.dataTransfer.setData("ticketId", t.id);
                            e.currentTarget.style.opacity = "0.5";
                          }
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                        className={cn(
                          "p-3.5 space-y-3 shadow-sm border transition-all bg-card cursor-pointer hover:border-primary/40 hover:shadow-md",
                          isStaff && !isDisabled ? "cursor-grab active:cursor-grabbing" : "",
                          updatingId === t.id && "animate-pulse bg-muted/50 opacity-60"
                        )}
                        onClick={(e) => {
                          // Guard: only navigate if we aren't actively dragging
                          if (updatingId === t.id) return;
                          navigate({ to: "/tickets/$ticketId", params: { ticketId: t.id } });
                        }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm tracking-tight leading-tight line-clamp-2 flex-1">
                              {t.title}
                            </h4>
                            <Badge variant="outline" className="text-[10px] border font-semibold flex-shrink-0">
                              {t.type === "enhancement" ? "Enhancement" : (t.type === "improvement" ? "Improvement" : (t.type === "issue" ? "Issue" : t.type))}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        </div>

                        <div className="space-y-2 pt-1 border-t border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-medium truncate max-w-[120px] text-muted-foreground">
                              🌐 {websites[t.website_id]?.name || "Website"}
                            </div>
                            <Badge className={cn("text-[10px] px-1.5 font-semibold", priorityColors[t.priority] || "bg-secondary")}>
                              {t.priority}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                            <span className="font-medium flex items-center gap-1 truncate flex-1 pr-2">
                              👤 {isStaff 
                                ? (profiles[t.client_id]?.full_name || profiles[t.client_id]?.email || "Client")
                                : "You"
                              }
                            </span>
                            <span className="flex-shrink-0 whitespace-nowrap font-medium">
                              {new Date(t.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {columnTickets.length === 0 && (
                      <div className={cn(
                        "h-full flex flex-col items-center justify-center text-center p-8 py-12 text-muted-foreground/50",
                        filter !== "total" && "col-span-full"
                      )}>
                        <LayoutGrid className="h-8 w-8 mb-2 opacity-30" strokeWidth={1.5} />
                        <div className="text-xs font-bold uppercase tracking-wide">No records in this stage</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}