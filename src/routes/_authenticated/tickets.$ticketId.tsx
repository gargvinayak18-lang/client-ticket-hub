import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  ArrowLeft, Calendar, User, Globe, AlertTriangle, Info, CheckCircle2, Clock, 
  GitPullRequest, UserCheck, Zap, ShieldCheck, ChevronRight, MessageSquare, ArrowRightLeft, XCircle, Send, Quote
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tickets/$ticketId")({
  component: TicketDetail,
});

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Open", color: "bg-orange-100 text-orange-800 border-orange-200", icon: Info },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  resolved: { label: "In Review", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-800 border-slate-200", icon: AlertTriangle },
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "System Admin",
  jr_dev: "Junior Developer",
  sr_dev: "Senior Developer",
  pm: "Product Manager",
  client: "Customer / Client",
};

function TicketDetail() {
  const { ticketId } = Route.useParams();
  const { role, user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState<any | null>(null);
  const [website, setWebsite] = useState<any | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Workflow Runtime Metrics
  const [activeFlow, setActiveFlow] = useState<any | null>(null);
  const [activeSteps, setActiveSteps] = useState<any[]>([]);
  const [assignedStaff, setAssignedStaff] = useState<any | null>(null);
  const [stepReviewers, setStepReviewers] = useState<any[]>([]); // Array of { step_number, reviewer_id, reviewer: profile }
  const [assignedReviewer, setAssignedReviewer] = useState<any | null>(null); // Active reviewer for CURRENT step
  
  const [devSubmissionText, setDevSubmissionText] = useState("");

  // Mandatory Review Feedbacks
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  // Launch Form States
  const [launchOpen, setLaunchOpen] = useState(false);
  const [allFlows, setAllFlows] = useState<any[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [selectedFlowSteps, setSelectedFlowSteps] = useState<any[]>([]); // Blueprint steps for launching modal
  const [eligibleDevs, setEligibleDevs] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [eligibleReviewers, setEligibleReviewers] = useState<any[]>([]);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<Record<number, string>>({}); // Map { step_number: user_id }

  // Chat Data Stores
  const [comments, setComments] = useState<any[]>([]);
  const [msgText, setMsgText] = useState("");
  const [postingMsg, setPostingMsg] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isStaff = role && role !== "client";
  const canManageWorkflows = role === "admin" || role === "pm" || role === "sr_dev";
  const canChangeStatus = role === "admin" || role === "pm";

  const loadComments = async () => {
    try {
      const { data: rawComments, error: cErr } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      
      if (cErr) throw cErr;

      if (rawComments && rawComments.length > 0) {
        const userIds = Array.from(new Set(rawComments.map(c => c.user_id)));
        const { data: userProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        
        const profileMap = (userProfiles ?? []).reduce((acc, curr) => {
          acc[curr.id] = curr;
          return acc;
        }, {} as Record<string, any>);

        const enriched = rawComments.map(c => ({
          ...c,
          user: profileMap[c.user_id] || { email: "Deleted Account" }
        }));

        setComments(enriched);
      } else {
        setComments([]);
      }
    } catch (e) {
      console.error("Comments evaluation aborted", e);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data: t, error: tErr } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();
      
      if (tErr) throw tErr;
      if (!t) {
        toast.error("Ticket not found.");
        navigate({ to: "/dashboard" });
        return;
      }
      setTicket(t);

      const { data: w } = await supabase.from("websites").select("*").eq("id", t.website_id).maybeSingle();
      setWebsite(w);

      const { data: p } = await supabase.from("profiles").select("*").eq("id", t.client_id).maybeSingle();
      setClient(p);

      // Hydrate active sequential workflow runtime
      if (t.flow_id) {
        const { data: flow } = await supabase.from("approval_flows").select("*").eq("id", t.flow_id).maybeSingle();
        setActiveFlow(flow);

        const { data: steps } = await supabase
          .from("approval_steps")
          .select("*")
          .eq("flow_id", t.flow_id)
          .order("step_number", { ascending: true });
        setActiveSteps(steps ?? []);

        if (t.assigned_to_user) {
          const { data: staff } = await supabase.from("profiles").select("*").eq("id", t.assigned_to_user).maybeSingle();
          setAssignedStaff(staff);
        }

        // LOAD STEP REVIEWERS MAP RELATIONAL METADATA
        const { data: sReviewers } = await supabase
          .from("ticket_step_reviewers")
          .select("step_number, reviewer_id")
          .eq("ticket_id", ticketId);
        
        if (sReviewers && sReviewers.length > 0) {
          const uniqueRevIds = Array.from(new Set(sReviewers.map(r => r.reviewer_id)));
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email, full_name")
            .in("id", uniqueRevIds);
          
          const pMap = (profiles ?? []).reduce((acc, u) => {
            acc[u.id] = u;
            return acc;
          }, {} as Record<string, any>);

          const enrichedReviewers = sReviewers.map(r => ({
            ...r,
            reviewer: pMap[r.reviewer_id] || { email: "Supervisor" }
          }));
          
          setStepReviewers(enrichedReviewers);

          // Identify active stage supervisor
          const currNum = t.current_step || 1;
          const activeRev = enrichedReviewers.find(r => r.step_number === currNum);
          setAssignedReviewer(activeRev?.reviewer || null);
        } else {
          setStepReviewers([]);
          setAssignedReviewer(null);
        }

      } else {
        setActiveFlow(null);
        setActiveSteps([]);
        setAssignedStaff(null);
        setStepReviewers([]);
        setAssignedReviewer(null);
      }

      await loadComments();

    } catch (err: any) {
      toast.error(err.message || "Load terminated.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`comments-live-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_comments", filter: `ticket_id=eq.${ticketId}` },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const loadLauncherData = async () => {
    try {
      const { data: flows } = await supabase.from("approval_flows").select("*").eq("target_type", "staff").order("name");
      setAllFlows(flows ?? []);

      // 1. Fetch user roles including key labels
      const { data: revRoles } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "pm", "sr_dev", "client"]);
      
      if (revRoles && revRoles.length > 0) {
        const roleMap = revRoles.reduce((acc, r) => {
          if (!acc[r.user_id]) acc[r.user_id] = [];
          acc[r.user_id].push(r.role);
          return acc;
        }, {} as Record<string, string[]>);

        const reviewerIds = Object.keys(roleMap);
        const { data: revProfiles } = await supabase.from("profiles").select("id, email, full_name").in("id", reviewerIds).order("email");
        
        const enriched = (revProfiles ?? []).map(p => ({
          ...p,
          roles: roleMap[p.id] || []
        }));

        setEligibleReviewers(enriched);
      } else {
        setEligibleReviewers([]);
      }
    } catch (e) {
      toast.error("Launch preparations failed.");
    }
  };

  useEffect(() => {
    if (launchOpen) {
      loadLauncherData();
    }
  }, [launchOpen]);

  const handleFlowSelect = async (flowId: string) => {
    setSelectedFlowId(flowId);
    setSelectedStaffId("");
    setSelectedReviewerIds({});
    setSelectedFlowSteps([]);
    const targetFlow = allFlows.find(f => f.id === flowId);
    if (!targetFlow) return;

    try {
      // 1. Load matching candidate developers
      const { data: devRoles } = await supabase.from("user_roles").select("user_id").eq("role", targetFlow.assigned_role);
      const uIds = (devRoles ?? []).map(r => r.user_id);

      if (uIds.length > 0) {
        const { data: devs } = await supabase.from("profiles").select("id, email, full_name").in("id", uIds).order("email");
        setEligibleDevs(devs ?? []);
      } else {
        setEligibleDevs([]);
      }

      // 2. Load blueprint steps to prompt for multi-stage reviewers
      const { data: steps } = await supabase
        .from("approval_steps")
        .select("*")
        .eq("flow_id", flowId)
        .order("step_number", { ascending: true });
      setSelectedFlowSteps(steps ?? []);

    } catch (e) {
      toast.error("Validation selection error.");
    }
  };

  const handleLaunchWorkflow = async () => {
    const reqSteps = selectedFlowSteps.length;
    const mapped = Object.keys(selectedReviewerIds).length;
    if (!selectedFlowId || !selectedStaffId || mapped < reqSteps) {
      return toast.error("Select a supervisor for every validation stage.");
    }

    setSaving(true);
    try {
      // 1. Setup dynamic ticket settings
      const { error } = await supabase
        .from("tickets")
        .update({
          flow_id: selectedFlowId,
          current_step: 1,
          assigned_to_user: selectedStaffId,
          workflow_step_status: "working",
          last_submission_notes: null,
          status: "in_progress",
          updated_at: new Date().toISOString()
        })
        .eq("id", ticketId);

      if (error) throw error;

      // 2. Construct multi-stage reviewer payloads and commit to database
      const mappings = Object.entries(selectedReviewerIds).map(([sNum, rId]) => ({
        ticket_id: ticketId,
        step_number: parseInt(sNum),
        reviewer_id: rId
      }));

      const { error: mapErr } = await supabase
        .from("ticket_step_reviewers")
        .insert(mappings);

      if (mapErr) throw mapErr;

      toast.success("Sequencing initiated! Stage-specific reviewers locked.");
      setLaunchOpen(false);
      setSelectedFlowId("");
      setSelectedStaffId("");
      setSelectedReviewerIds({});
      load();
    } catch (err: any) {
      toast.error(err.message || "Deployment failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDevSubmitNotes = async () => {
    if (!devSubmissionText.trim()) return toast.error("Detail your implemented actions.");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          workflow_step_status: "submitted",
          last_submission_notes: devSubmissionText,
          updated_at: new Date().toISOString()
        })
        .eq("id", ticketId);

      if (error) throw error;
      toast.success("Updates packaged and delivered to senior validation console.");
      setDevSubmissionText("");
      load();
    } catch (err: any) {
      toast.error("Submission failure.");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerReview = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setFeedbackText("");
    setReviewOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || !currentUser?.id) {
      return toast.error("Provide mandatory review comments before submitting.");
    }

    setSaving(true);
    try {
      const stageName = currentStepObj?.name || `Stage ${ticket.current_step}`;
      const reviewHeader = reviewAction === "approve"
        ? `🟢 APPROVED [${stageName}]`
        : `🔴 CHANGES REQUIRED [${stageName}]`;

      const commentPayload = `${reviewHeader}\n\nSupervisor Feedback:\n"${feedbackText.trim()}"`;

      const { error: cErr } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: ticketId,
          user_id: currentUser.id,
          content: commentPayload
        });
      
      if (cErr) throw cErr;

      if (reviewAction === "approve") {
        await executeApproveStep();
      } else {
        await executeRejectStep();
      }

      setReviewOpen(false);
      await loadComments();

    } catch (e: any) {
      toast.error(e.message || "Database link broken.");
    } finally {
      setSaving(false);
    }
  };

  const executeRejectStep = async () => {
    const { error } = await supabase
      .from("tickets")
      .update({ workflow_step_status: "working", updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (error) throw error;
    toast.success("Audit complete. Revisions requested.");
    load();
  };

  const executeApproveStep = async () => {
    if (!ticket || !activeSteps || activeSteps.length === 0) return;
    const cStep = ticket.current_step ?? 1;
    const total = activeSteps.length;

    const isLast = cStep >= total;
    const next = cStep + 1;
    const payload: any = { updated_at: new Date().toISOString(), last_submission_notes: null };

    if (isLast) {
      payload.status = "resolved";
      payload.workflow_step_status = "working";
    } else {
      payload.current_step = next;
      payload.workflow_step_status = "working";
    }

    const { error } = await supabase.from("tickets").update(payload).eq("id", ticket.id);
    if (error) throw error;

    if (isLast) {
      // Automatically notify the Client via formal systemic chat feed insertion
      if (currentUser?.id) {
        await supabase.from("ticket_comments").insert({
          ticket_id: ticketId,
          user_id: currentUser.id,
          content: "🔔 **TICKET ESCALATED FOR CLIENT REVIEW**\n\nAll internal engineering workflows have successfully passed verification. The ticket status is now set to **In Review**.\n\nDear Customer, please evaluate the resolution. Once satisfied, use the verification console below to grant final acceptance approval."
        });
      }
      toast.success("🏆 Final validation approved! Ticket escalated to In Review.");
    } else {
      toast.success(`Stage ${cStep} verified. Advanced to Stage ${next}.`);
    }
    load();
  };

  const handleStatusChange = async (ns: string) => {
    if (!ticket) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: ns as any, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);

      if (error) throw error;
      const pretty = ns === "resolved" ? "In Review" : ns.replace("_", " ");
      toast.success(`Overall ticket progress shifted to ${pretty}`);
      setTicket((prev: any) => ({ ...prev, status: ns }));
    } catch (err: any) {
      toast.error(err.message || "Operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleClientFinalApprove = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ 
          status: "closed", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", ticket.id);

      if (error) throw error;
      
      if (currentUser?.id) {
        await supabase.from("ticket_comments").insert({
          ticket_id: ticketId,
          user_id: currentUser.id,
          content: "🎯 TICKET FINAL APPROVED & CLOSED\n\nClient verified engineering resolution and finalized the request sequence."
        });
      }

      toast.success("Ticket successfully accepted and closed!");
      load();
    } catch (err: any) {
      toast.error("Finalization failure.");
    } finally {
      setSaving(false);
    }
  };

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim() || !currentUser?.id) return;

    setPostingMsg(true);
    try {
      const { error } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: ticketId,
          user_id: currentUser.id,
          content: msgText
        });
      
      if (error) throw error;
      setMsgText("");
      await loadComments();
    } catch (err: any) {
      toast.error("Message send aborted.");
    } finally {
      setPostingMsg(false);
    }
  };

  if (loading) return <div className="text-muted-foreground py-10 text-center font-semibold tracking-wide">Accessing Secure Environment...</div>;
  if (!ticket) return null;

  const StatusIcon = statusMap[ticket.status]?.icon || Info;
  const statusDisplay = statusMap[ticket.status]?.label || ticket.status;

  const cUid = currentUser?.id;
  const isDevNode = cUid && cUid === ticket.assigned_to_user;
  
  // CRITICAL SECURE EVALUATION: Checks dynamic step-specific reviewer instead of hardcoded column
  const activeStageMap = stepReviewers.find(r => r.step_number === (ticket.current_step || 1));
  const isRevNode = cUid && cUid === activeStageMap?.reviewer_id;
  
  const activeStepIndex = ticket.current_step ? ticket.current_step - 1 : 0;
  const currentStepObj = activeSteps[activeStepIndex];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => window.history.back()}
          className="text-muted-foreground font-semibold"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Return
        </Button>
      </div>

      {/* FEEDBACK MODAL FOR ACTIVE STAGE SUPERVISOR */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black tracking-tight text-xl">
              {reviewAction === "approve" ? (
                <><CheckCircle2 className="h-6 w-6 text-emerald-600" /> Submit Pass Clearance</>
              ) : (
                <><XCircle className="h-6 w-6 text-destructive" /> Submit Change Directions</>
              )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitReview} className="space-y-5 py-3">
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase tracking-widest text-muted-foreground">
                Mandatory Review Summary / Compliment / Directives
              </Label>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                {reviewAction === "approve"
                  ? "Compliment the assigned developer's implementation, record observations, or verify code standards."
                  : "Clearly list technical directives or adjustments necessary before this stage receives approval."}
              </p>
              <Textarea 
                placeholder={reviewAction === "approve" ? "Excellent code design. Complies with specs perfectly..." : "Adjust the visual padding and bind validation triggers..."}
                required
                rows={4}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="bg-background rounded-xl text-xs leading-relaxed border-muted-foreground/25 focus-visible:ring-primary"
              />
            </div>

            <DialogFooter className="pt-1 border-t border-dashed">
              <Button 
                type="submit" 
                disabled={saving || !feedbackText.trim()}
                className={cn(
                  "w-full sm:w-auto font-black shadow-md rounded-xl",
                  reviewAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"
                )}
              >
                {saving ? "Publishing..." : "Publish Review & Discard Step"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("font-black uppercase tracking-widest text-[10px]", priorityColors[ticket.priority])}>
                {ticket.priority}
              </Badge>
              <Badge variant="outline" className="font-black tracking-widest text-[10px] uppercase bg-muted/20">
                {ticket.type === "enhancement" ? "Enhancement" : (ticket.type === "improvement" ? "Improvement" : (ticket.type === "issue" ? "Issue" : ticket.type))}
              </Badge>
              {activeFlow && (
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 flex items-center gap-1 font-bold text-[10px] uppercase">
                  <GitPullRequest className="h-3 w-3" /> Multi-Stage
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight text-foreground">{ticket.title}</h1>
          </div>

          {(isStaff || activeFlow) && (
            <Card className="relative overflow-hidden border-2 border-primary/15 shadow-md rounded-2xl">
              <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-primary via-indigo-500 to-emerald-500" />
              
              {!activeFlow ? (
                <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-primary/[0.01]">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0 mt-1 shadow-inner">
                      <GitPullRequest className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg tracking-tight">Deploy Sequential Process</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed font-medium">
                        Deploy a structured workflow and select specific, different supervisors to verify individual validation stages.
                      </p>
                    </div>
                  </div>

                  {canManageWorkflows ? (
                    <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
                      <DialogTrigger asChild>
                        <Button className="shadow-sm font-bold">
                          <Zap className="h-4 w-4 mr-1.5 fill-current animate-pulse" /> Build Pipeline
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[520px] rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 font-black tracking-tight text-xl">
                            <GitPullRequest className="h-6 w-6 text-primary" /> 
                            Pipeline Configuration
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 py-3 max-h-[80vh] overflow-y-auto pr-1 scrollbar-thin">
                          
                          <div className="space-y-2">
                            <Label className="font-black text-sm tracking-tight">Step A: Workflow Template</Label>
                            <Select value={selectedFlowId} onValueChange={handleFlowSelect}>
                              <SelectTrigger className="rounded-xl shadow-sm">
                                <SelectValue placeholder="Filter templates" />
                              </SelectTrigger>
                              <SelectContent>
                                {allFlows.map(f => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name} ({ROLE_LABELS[f.assigned_role]} task)
                                  </SelectItem>
                                ))}
                                {allFlows.length === 0 && <SelectItem value="none" disabled>No active workflows</SelectItem>}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedFlowId && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200 border-t pt-3">
                              <Label className="font-black text-sm tracking-tight">Step B: Specific Developer Assignment</Label>
                              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                                <SelectTrigger className="rounded-xl shadow-sm">
                                  <SelectValue placeholder="Assign developer" />
                                </SelectTrigger>
                                <SelectContent>
                                  {eligibleDevs.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                                  ))}
                                  {eligibleDevs.length === 0 && <SelectItem value="none" disabled>No available matches</SelectItem>}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* MULTI-STAGE REVIEWER SELECTION GRID */}
                          {selectedFlowId && selectedFlowSteps.length > 0 && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 border-t pt-3">
                              <Label className="font-black text-sm tracking-tight text-primary">
                                Step C: Designated Stage Reviewers
                              </Label>
                              <p className="text-[11px] text-muted-foreground font-medium">
                                Map a specific supervisor for EACH sequential validation step:
                              </p>
                              <div className="space-y-2.5">
                                {selectedFlowSteps.map(step => {
                                  const matchingOptions = eligibleReviewers.filter(u => u.roles?.includes(step.approver_role));

                                  return (
                                    <div key={step.id} className="space-y-1.5 p-2.5 bg-muted/20 border rounded-xl shadow-sm">
                                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-muted-foreground px-1">
                                        <span>Stage {step.step_number}: {step.name}</span>
                                        <span className="bg-background border px-1.5 py-0.5 rounded-md">{ROLE_LABELS[step.approver_role]}</span>
                                      </div>
                                      <Select 
                                        value={selectedReviewerIds[step.step_number] || ""} 
                                        onValueChange={(v) => setSelectedReviewerIds(prev => ({ ...prev, [step.step_number]: v }))}
                                      >
                                        <SelectTrigger className="rounded-xl h-9 bg-background text-xs font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                                          <SelectValue placeholder={`Assign ${ROLE_LABELS[step.approver_role]}...`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {matchingOptions.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                                          ))}
                                          {matchingOptions.length === 0 && (
                                            <SelectItem value="none" disabled>No matching staff</SelectItem>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="pt-2 border-t border-dashed">
                          <Button 
                            onClick={handleLaunchWorkflow} 
                            disabled={saving || !selectedFlowId || !selectedStaffId || Object.keys(selectedReviewerIds).length < selectedFlowSteps.length}
                            className="w-full sm:w-auto font-black shadow-lg rounded-xl px-6"
                          >
                            {saving ? "Securing Registry..." : "🔒 Commit Stage Mappings"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Badge variant="outline" className="rounded-md tracking-wider font-black text-[10px]">AWAITING DISPATCH</Badge>
                  )}
                </div>
              ) : (
                <div className="bg-card">
                  <div className="p-5 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest font-black text-primary mb-0.5 opacity-80">Live Matrix</div>
                      <h3 className="text-base font-black tracking-tight flex items-center gap-1.5">
                        {activeFlow.name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-full border text-[10px] font-black shrink-0 shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>DEV: {assignedStaff?.full_name?.split(" ")[0] || assignedStaff?.email?.split("@")[0]}</span>
                      </div>
                      {assignedReviewer && (
                        <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-full border text-[10px] font-black shrink-0 shadow-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                          <span>ACTIVE REV: {assignedReviewer.full_name?.split(" ")[0] || assignedReviewer.email?.split("@")[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {activeSteps.map((s, idx) => {
                        const isC = (ticket.status === "resolved" || ticket.status === "closed") || idx < activeStepIndex;
                        const isN = !isC && idx === activeStepIndex;
                        const isF = idx > activeStepIndex && ticket.status !== "resolved" && ticket.status !== "closed";

                        // Extract stage reviewer from the hydrated relational mappings
                        const stepMap = stepReviewers.find(r => r.step_number === s.step_number);
                        const revName = stepMap?.reviewer?.full_name || stepMap?.reviewer?.email?.split("@")[0] || "Supervisor";

                        return (
                          <div 
                            key={s.id}
                            className={cn(
                              "flex flex-col items-start p-3 border rounded-xl leading-tight text-xs transition-all relative shadow-sm",
                              isC ? "bg-emerald-500/[0.04] border-emerald-500/25 text-emerald-900 dark:text-emerald-400" : "",
                              isN ? "bg-primary/[0.03] border-primary ring-1 ring-primary/20 shadow-md" : "",
                              isF ? "bg-muted/15 border-muted text-muted-foreground opacity-65" : ""
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1.5 w-full">
                              <div className={cn(
                                "h-5 w-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-black shadow border",
                                isC ? "bg-emerald-500 border-emerald-600 text-white" : "",
                                isN ? "bg-primary text-primary-foreground border-primary animate-pulse" : "",
                                isF ? "bg-background border-muted text-muted-foreground" : ""
                              )}>
                                {isC ? <CheckCircle2 className="h-3 w-3" /> : s.step_number}
                              </div>
                              <div className="font-black truncate flex-1">{s.name}</div>
                            </div>
                            
                            <div className="text-[9px] font-black uppercase opacity-70 mt-0.5 flex items-center gap-1 border-t border-border/10 w-full pt-1.5">
                              <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">Rev: {revName}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {ticket.status !== "resolved" && ticket.status !== "closed" && currentStepObj && (
                    <div className="p-5 border-t bg-muted/5">
                      {isDevNode ? (
                        ticket.workflow_step_status === "working" ? (
                          <div className="space-y-3 animate-in zoom-in-95">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
                              <Zap className="h-3.5 w-3.5" /> PUSH DEPLOYMENT: STAGE {ticket.current_step}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                              You hold active custody of this step. Record changes to alert designated validator (**{assignedReviewer?.full_name || assignedReviewer?.email}**).
                            </p>
                            <Textarea 
                              placeholder="Document technical modifications here..."
                              rows={2}
                              value={devSubmissionText}
                              onChange={(e) => setDevSubmissionText(e.target.value)}
                              className="bg-background text-xs border-border rounded-xl focus-visible:ring-primary"
                            />
                            <Button onClick={handleDevSubmitNotes} disabled={saving || !devSubmissionText.trim()} className="h-8 text-xs font-black px-4 rounded-lg shadow">
                              🚀 Dispatch to Supervisor
                            </Button>
                          </div>
                        ) : (
                          <div className="p-4 border border-emerald-500/20 rounded-xl bg-emerald-500/[0.02] text-emerald-900 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 shadow-inner">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>Updates secured. Awaiting supervisor inspection.</span>
                          </div>
                        )
                      ) : isRevNode ? (
                        ticket.workflow_step_status === "submitted" ? (
                          <div className="space-y-3 border border-orange-500/25 p-4 rounded-2xl bg-orange-500/[0.02] animate-in slide-in-from-bottom-2 duration-300 shadow-sm">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-orange-600" />
                              <h4 className="text-xs font-black uppercase tracking-widest text-orange-800 dark:text-orange-400">Audit Queue: Evaluation Active</h4>
                            </div>
                            
                            <div className="p-3 rounded-xl bg-background border border-border leading-relaxed text-xs italic text-muted-foreground font-medium whitespace-pre-wrap">
                              "{ticket.last_submission_notes || "No summary documented."}"
                            </div>

                            <div className="flex gap-2 pt-0.5">
                              <Button onClick={() => handleTriggerReview('approve')} disabled={saving} className="h-8 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs px-4 rounded-lg text-white shadow">
                                ✓ Pass Stage
                              </Button>
                              <Button onClick={() => handleTriggerReview('reject')} disabled={saving} variant="outline" className="h-8 text-xs font-bold px-4 text-destructive border-destructive/20 rounded-lg hover:bg-destructive/5">
                                ✕ Request Iteration
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 border bg-muted/30 rounded-xl text-xs text-muted-foreground italic font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 animate-spin opacity-40" style={{ animationDuration: "4s" }} />
                            <span>Standby. Dev (**{assignedStaff?.full_name || assignedStaff?.email}**) is authoring updates.</span>
                          </div>
                        )
                      ) : (
                        <div className="p-4 border rounded-xl bg-muted/20 text-xs text-muted-foreground leading-relaxed flex gap-2 items-start font-medium">
                          <Info className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
                          <div>
                            <strong className="text-foreground block mb-0.5">Matrix Tracker</strong>
                            {ticket.workflow_step_status === "working" 
                              ? <span>Developer **{assignedStaff?.full_name || assignedStaff?.email}** is processing requirements.</span>
                              : <span>Ready for inspection! Sitting in supervisor queue for **{assignedReviewer?.full_name || assignedReviewer?.email}**.</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {ticket.status === "resolved" && role === "client" && (
                    <div className="p-5 border-t bg-emerald-500/[0.02] animate-in zoom-in-95">
                      <div className="border border-emerald-500/25 p-5 rounded-2xl bg-background shadow-md space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 animate-pulse" />
                          <h4 className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                            Client Acceptance Verification
                          </h4>
                        </div>
                        
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                          The engineering team has successfully completed the resolution sequence for this ticket. Please review the changes. Once satisfied, lock and archive this ticket below to finalize billing/accounting milestones.
                        </p>

                        <Button 
                          onClick={handleClientFinalApprove} 
                          disabled={saving} 
                          className="h-9 font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl shadow-lg"
                        >
                          ✓ Confirm Acceptance & Close Ticket
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          <Card className="p-6 space-y-4 rounded-2xl border shadow-sm">
            <div className="border-b pb-3 flex justify-between items-center">
              <h3 className="font-black text-lg tracking-tight text-foreground">Ticket Objective</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm font-medium">
              {ticket.description || "No context documented."}
            </p>
          </Card>

          {/* COMMUNICATION HUB */}
          {isStaff && (
            <Card className="border rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-muted/20 p-4 border-b flex items-center justify-between">
              <h3 className="font-black text-base tracking-tight flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Communication Thread
              </h3>
              <Badge variant="secondary" className="rounded-lg font-black text-[10px] uppercase tracking-wide">
                {comments.length} Message{comments.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="h-[320px] p-5 overflow-y-auto bg-gradient-to-b from-background to-muted/5 space-y-4 flex flex-col scrollbar-thin">
              {comments.length === 0 ? (
                <div className="flex-1 grid place-items-center text-center text-muted-foreground/50 text-xs italic">
                  <div className="space-y-1">
                    <MessageSquare className="h-8 w-8 mx-auto opacity-30 mb-1" />
                    <p className="font-bold">No activity yet.</p>
                    <p className="font-medium">Initiate correspondence in the console below.</p>
                  </div>
                </div>
              ) : (
                comments.map((c) => {
                  const isSelf = c.user_id === cUid;
                  const isReviewLog = c.content.startsWith("🟢 APPROVED") || c.content.startsWith("🔴 CHANGES REQUIRED");

                  return (
                    <div 
                      key={c.id} 
                      className={cn(
                        "flex flex-col max-w-[85%] space-y-1 animate-in fade-in slide-in-from-bottom-1",
                        isReviewLog ? "self-center w-full max-w-[90%] items-center" : (isSelf ? "self-end items-end" : "self-start items-start")
                      )}
                    >
                      {!isReviewLog && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground opacity-80 px-1">
                          <span>{isSelf ? "You" : (c.user?.full_name || c.user?.email?.split("@")[0] || "User")}</span>
                          <span className="font-normal text-[9px]">• {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      
                      {isReviewLog ? (
                        <div className="w-full p-4 rounded-2xl bg-muted/40 border-2 border-dashed border-muted-foreground/10 text-center space-y-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                          <div className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <Quote className="h-3 w-3" /> Official Record Stamp • {new Date(c.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs leading-relaxed whitespace-pre-wrap font-bold italic text-foreground/90 max-w-md mx-auto">
                            {c.content}
                          </div>
                        </div>
                      ) : (
                        <div 
                          className={cn(
                            "p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap font-medium shadow-sm",
                            isSelf 
                              ? "bg-primary text-primary-foreground rounded-br-none" 
                              : "bg-card border border-border text-foreground rounded-bl-none"
                          )}
                        >
                          {c.content}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t bg-card">
              <form onSubmit={handlePostMessage} className="flex gap-2 items-center">
                <Input 
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder="Message contributors..."
                  className="h-10 rounded-xl bg-muted/30 border-border flex-1 text-xs font-medium focus-visible:ring-primary"
                  maxLength={1000}
                />
                <Button 
                  type="submit" 
                  disabled={postingMsg || !msgText.trim()} 
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0 shadow"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
          )}

        </div>

        {/* Right Utilities */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4 shadow-sm rounded-2xl">
            <h3 className="font-black text-xs tracking-widest uppercase text-muted-foreground">Global Console</h3>
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wide">Ticket Status</label>
              {canChangeStatus ? (
                <Select value={ticket.status} onValueChange={handleStatusChange} disabled={saving}>
                  <SelectTrigger className="w-full shadow-sm rounded-xl font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">In Review</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black tracking-wide uppercase", statusMap[ticket.status]?.color)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusDisplay}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-5 shadow-sm rounded-2xl">
            <h3 className="font-black text-xs tracking-widest uppercase text-muted-foreground">Metrics & Context</h3>
            <div className="space-y-4 font-medium text-xs">
              
              <div className="flex gap-3 items-start text-xs">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0 opacity-70" />
                <div>
                  <div className="font-black text-[9px] tracking-widest uppercase text-muted-foreground mb-0.5">Created</div>
                  <div className="font-bold text-foreground">
                    {new Date(ticket.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-start border-t pt-3">
                <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0 opacity-70" />
                <div className="min-w-0 flex-1">
                  <div className="font-black text-[9px] tracking-widest uppercase text-muted-foreground mb-0.5">Environment</div>
                  {website ? (
                    <div className="space-y-0.5 truncate">
                      <div className="text-primary font-black truncate leading-tight">{website.name}</div>
                      <a href={website.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline text-[10px] block truncate">
                        {website.url}
                      </a>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-[10px]">—</div>
                  )}
                </div>
              </div>

              {isStaff && (
                <div className="flex gap-3 items-start border-t pt-3">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-[9px] tracking-widest uppercase text-muted-foreground mb-0.5">Origin Client</div>
                    {client ? (
                      <div className="space-y-0.5 truncate">
                        <div className="font-black text-foreground truncate leading-tight">{client.full_name || "Unnamed"}</div>
                        <div className="text-muted-foreground text-[10px] truncate leading-none">{client.email}</div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-[10px]">—</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
