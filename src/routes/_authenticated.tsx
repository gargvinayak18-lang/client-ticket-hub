import { createFileRoute, Navigate, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import {
  Sheet, SheetTrigger, SheetContent
} from "@/components/ui/sheet";
import { 
  TicketIcon, LayoutDashboard, Users, LogOut, Globe, Shield, KeyRound, UserCog, GitPullRequest,
  Bell, ShieldCheck, ChevronRight, Inbox, Clock, Menu, Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { session, role, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Personal password management
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Approvals Inbox Data Store
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // 1. Dynamic Realtime Hook to fetch pending requests for current Senior Reviewer
  const fetchInbox = async () => {
    if (!user?.id) return;
    try {
      if (role === "client") {
        // A. For Clients: Fetch resolved tickets belonging to them
        const { data: clientTickets, error } = await supabase
          .from("tickets")
          .select("id, title, status, updated_at")
          .eq("client_id", user.id)
          .eq("status", "resolved")
          .order("updated_at", { ascending: false });
        
        if (error) throw error;

        const mapped = (clientTickets ?? []).map(t => ({
          id: t.id,
          title: t.title,
          isClientReview: true,
          last_submission_notes: "Engineering sequence is complete. Tap below to verify resolution & finalize.",
          updated_at: t.updated_at
        }));

        setPendingApprovals(mapped);
      } else {
        // B. For Staff: Fetch submitted steps requiring reviewer audit
        const { data: tickets, error } = await supabase
          .from("tickets")
          .select("id, title, current_step, flow_id, last_submission_notes, updated_at")
          .eq("workflow_step_status", "submitted")
          .not("status", "in", '("resolved","closed")')
          .order("updated_at", { ascending: false });
        
        if (error) throw error;

        if (!tickets || tickets.length === 0) {
          setPendingApprovals([]);
          return;
        }

        const { data: reviewers } = await supabase
          .from("ticket_step_reviewers")
          .select("ticket_id, step_number, reviewer_id")
          .in("ticket_id", tickets.map(t => t.id));

        const myQueue = tickets.filter(t => {
          const cur = t.current_step || 1;
          const stepDef = (reviewers ?? []).find(r => r.ticket_id === t.id && r.step_number === cur);
          return stepDef?.reviewer_id === user.id;
        });

        setPendingApprovals(myQueue);
      }
    } catch (e) {
      console.error("Inbox evaluation aborted", e);
    }
  };

  useEffect(() => {
    if (!user?.id || !role) return;
    fetchInbox();

    // Subscribe to Realtime updates on Tickets table
    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          fetchInbox();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, role]);

  // 2. Quick Action Handler inside Inbox popover
  const handleQuickApprove = async (t: any) => {
    setApprovingId(t.id);
    try {
      if (t.isClientReview) {
        // Client accepts finished ticket -> LOCK IT (Close)
        const { error } = await supabase
          .from("tickets")
          .update({ 
            status: "closed",
            updated_at: new Date().toISOString()
          })
          .eq("id", t.id);
        
        if (error) throw error;
        toast.success("Ticket verified & archived successfully!");
      } else {
        // Staff audits sequential step
        const { data: steps } = await supabase
          .from("approval_steps")
          .select("step_number")
          .eq("flow_id", t.flow_id)
          .order("step_number", { ascending: false });
        
        const totalSteps = steps ? steps.length : 1;
        const nextStepNum = (t.current_step || 1) + 1;
        const isLast = (t.current_step || 1) >= totalSteps;

        const updatePayload: any = {
          updated_at: new Date().toISOString(),
          last_submission_notes: null
        };

        if (isLast) {
          updatePayload.status = "resolved";
          updatePayload.workflow_step_status = "working";
        } else {
          updatePayload.current_step = nextStepNum;
          updatePayload.workflow_step_status = "working";
        }

        const { error } = await supabase.from("tickets").update(updatePayload).eq("id", t.id);
        if (error) throw error;

        if (isLast && user?.id) {
          // Post formal systemic notification message to client feed
          await supabase.from("ticket_comments").insert({
            ticket_id: t.id,
            user_id: user.id,
            content: "🔔 **TICKET ESCALATED FOR CLIENT REVIEW**\n\nAll internal engineering workflows have successfully passed verification. The ticket status is now set to **In Review**.\n\nDear Customer, please evaluate the resolution. Once satisfied, use the verification console below to grant final acceptance approval."
          });
        }

        toast.success(`Approved Ticket: "${t.title}"`);
      }
      fetchInbox();
    } catch (e: any) {
      toast.error(e.message || "Validation failure.");
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;

  const isAdmin = role === "admin";
  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/tickets", label: "Tickets", icon: TicketIcon },
    { to: "/workflows", label: "Workflows", icon: GitPullRequest },
    ...(isAdmin
      ? [
          { to: "/admin/users", label: "Users (Staff)", icon: UserCog },
          { to: "/admin/admins", label: "Admins", icon: Shield },
          { to: "/admin/clients", label: "Clients", icon: Users },
          { to: "/admin/websites", label: "Products/Solutions", icon: Package },
        ]
      : []),
  ];

  const getRoleLabel = (r: typeof role) => {
    switch (r) {
      case "admin": return "Admin";
      case "client": return "Client";
      case "jr_dev": return "Jr. Developer";
      case "sr_dev": return "Sr. Developer";
      case "pm": return "Product Manager";
      case "tester": return "Tester";
      default: return "User";
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      return toast.error("Password must be at least 8 characters long.");
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Your password has been updated successfully!");
      setNewPassword("");
      setPwdOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  };


  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderSidebarContent = (onNavClick?: () => void) => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-6 py-5 border-b border-sidebar-border flex flex-col gap-3 bg-sidebar-accent/10">
        <div className="flex items-center justify-start py-0.5">
          <Logo className="h-6 w-auto" />
        </div>
        <div className="px-1">
          <div className="text-[10px] text-sidebar-foreground/60 font-bold tracking-wider uppercase leading-none">{getRoleLabel(role)} Workspace</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((n) => {
          const active = location.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div className="text-[11px] opacity-60 px-3 pb-2 truncate font-medium">{user?.email}</div>
        
        <Dialog open={pwdOpen} onOpenChange={(v) => { if(!v) setNewPassword(""); setPwdOpen(v); }}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent font-medium text-xs"
            >
              <KeyRound className="h-3.5 w-3.5 mr-2 opacity-80" />
              Change Password
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Your Password</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdatePassword} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>New Secure Password (min 8 chars)</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setPwdOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving..." : "Save Password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent font-medium text-xs"
          onClick={async () => {
            await signOut();
            if (onNavClick) onNavClick();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="h-3.5 w-3.5 mr-2 opacity-80" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Sidebar Navigation - Desktop Only */}
      <aside className="w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col fixed inset-y-0 left-0 z-20 shadow-md hidden md:flex">
        {renderSidebarContent()}
      </aside>

      {/* Main Body Wrap with Sticky Dynamic Header */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen w-full">
        
        {/* TOP APP HEADER BAR */}
        <header className="h-14 bg-background border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
                  {renderSidebarContent(() => setMobileMenuOpen(false))}
                </SheetContent>
              </Sheet>
            </div>
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Operational Console</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* APPROVALS INBOX POPOVER */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-full">
                  <Bell className="h-4 w-4" />
                  {pendingApprovals.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-[9px] animate-pulse shadow border-2 border-background">
                      {pendingApprovals.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] sm:w-[360px] p-0 shadow-2xl rounded-xl" align="end">
                <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                  <h4 className="font-bold text-sm flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Pending Requests
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {pendingApprovals.length} Active
                  </Badge>
                </div>
                
                <div className="max-h-[350px] overflow-y-auto p-1.5 space-y-1.5">
                  {pendingApprovals.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center text-muted-foreground/60">
                      <Inbox className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-xs font-medium">Inbox Clear.</p>
                      <p className="text-[10px] mt-0.5">No tickets currently await your verification.</p>
                    </div>
                  ) : (
                    pendingApprovals.map((t) => (
                      <div key={t.id} className="p-3 rounded-lg border hover:bg-accent/30 transition-all space-y-2.5">
                        <div className="space-y-0.5">
                          <div className="font-bold text-xs truncate max-w-[260px] sm:max-w-[280px]">{t.title}</div>
                          <div className="text-[9px] flex items-center gap-1 text-muted-foreground font-medium">
                            <Clock className="h-3 w-3" />
                            Submitted {new Date(t.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        {t.last_submission_notes && (
                          <p className="text-[11px] text-muted-foreground p-2 rounded bg-muted/40 truncate italic font-medium">
                            "{t.last_submission_notes}"
                          </p>
                        )}

                        <div className="flex gap-2 items-center pt-0.5 border-t border-dashed border-border mt-1">
                          <Button 
                            size="sm" 
                            onClick={() => handleQuickApprove(t)}
                            disabled={approvingId === t.id}
                            className="h-7 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white flex-1 shadow-sm font-semibold"
                          >
                            {approvingId === t.id ? "Approving..." : "✓ Quick Approve"}
                          </Button>
                          <Link 
                            to="/tickets/$ticketId" 
                            params={{ ticketId: t.id }}
                            className="flex-1"
                          >
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 px-2.5 text-[10px] w-full font-semibold"
                            >
                              View Ticket
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Right Corner User Meta */}
            <div className="h-8 px-3 border bg-muted/40 text-xs font-semibold rounded-full text-foreground flex items-center shadow-sm border-border max-w-[100px] sm:max-w-none truncate">
              <span className="truncate">{user?.email?.split("@")[0]}</span>
            </div>
          </div>
        </header>

        {/* Layout Content Body */}
        <main className="p-4 sm:p-8 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}