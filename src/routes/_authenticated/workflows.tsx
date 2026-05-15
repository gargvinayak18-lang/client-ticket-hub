import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger 
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  GitPullRequest, Plus, Trash2, ArrowRight, Shield, Users, ClipboardCheck, Hammer, Zap, ShieldAlert, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workflows")({
  component: WorkflowsConsole,
});

interface LocalStep {
  name: string;
  approver_role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "System Admin",
  jr_dev: "Junior Developer",
  sr_dev: "Senior Developer",
  pm: "Product Manager",
  client: "Customer / Client",
};

function WorkflowsConsole() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Blueprint Creator States
  const [flowName, setFlowName] = useState("");
  const [flowDesc, setFlowDesc] = useState("");
  const [targetType, setTargetType] = useState<"staff" | "client">("staff");
  const [assignedRole, setAssignedRole] = useState<"jr_dev" | "sr_dev">("jr_dev");
  const [steps, setSteps] = useState<LocalStep[]>([
    { name: "Senior Validation", approver_role: "sr_dev" }
  ]);

  // Run-on-Ticket Console Form States
  const [deployOpen, setDeployOpen] = useState(false);
  const [activeDeployFlow, setActiveDeployFlow] = useState<any>(null); // Flow template object enriched with blueprint steps
  const [unassignedTickets, setUnassignedTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [eligibleDevs, setEligibleDevs] = useState<any[]>([]);
  const [selectedDevId, setSelectedDevId] = useState("");
  const [eligibleReviewers, setEligibleReviewers] = useState<any[]>([]);
  
  // RELATIONAL MAPPING STORE: maps { step_number: reviewer_id }
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<Record<number, string>>({});

  const canManage = role === "admin" || role === "pm" || role === "sr_dev";

  const loadFlows = async () => {
    setLoading(true);
    try {
      let query = supabase.from("approval_flows").select("*").order("created_at", { ascending: false });
      
      if (role === "client") {
        query = query.eq("target_type", "client");
      } else if (role && role !== "admin") {
        query = query.eq("target_type", "staff");
      }

      const { data: flowsData, error: flowsErr } = await query;
      if (flowsErr) throw flowsErr;

      if (flowsData && flowsData.length > 0) {
        const { data: stepsData, error: stepsErr } = await supabase
          .from("approval_steps")
          .select("*")
          .in("flow_id", flowsData.map(f => f.id))
          .order("step_number", { ascending: true });
        
        if (stepsErr) throw stepsErr;

        const enriched = flowsData.map(f => ({
          ...f,
          steps: (stepsData ?? []).filter(s => s.flow_id === f.id)
        }));
        setFlows(enriched);
      } else {
        setFlows([]);
      }
    } catch (err: any) {
      toast.error("Load failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, [role]);

  const handleOpenDeploy = async (flow: any) => {
    setActiveDeployFlow(flow);
    setSelectedTicketId("");
    setSelectedDevId("");
    setSelectedReviewerIds({});
    setDeployOpen(true);

    try {
      // A. Pull tickets with no flow assigned
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, title")
        .is("flow_id", null)
        .neq("status", "closed")
        .order("created_at", { ascending: false });
      setUnassignedTickets(tickets ?? []);

      // B. Pull devs matching tier
      const { data: devRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", flow.assigned_role);
      const dIds = (devRoles ?? []).map(r => r.user_id);

      if (dIds.length > 0) {
        const { data: devs } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", dIds)
          .order("email");
        setEligibleDevs(devs ?? []);
      } else {
        setEligibleDevs([]);
      }

      // C. Pull senior pools including multiple roles
      const { data: revRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "pm", "sr_dev", "client"]);

      if (revRoles && revRoles.length > 0) {
        const roleMap = revRoles.reduce((acc, r) => {
          if (!acc[r.user_id]) acc[r.user_id] = [];
          acc[r.user_id].push(r.role);
          return acc;
        }, {} as Record<string, string[]>);

        const rIds = Object.keys(roleMap);
        const { data: revs } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", rIds)
          .order("email");

        const enriched = (revs ?? []).map(p => ({
          ...p,
          roles: roleMap[p.id] || []
        }));

        setEligibleReviewers(enriched);
      } else {
        setEligibleReviewers([]);
      }
    } catch (e) {
      toast.error("Deploy console data fetch aborted.");
    }
  };

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqSteps = activeDeployFlow?.steps?.length || 0;
    const mapped = Object.keys(selectedReviewerIds).length;

    if (!selectedTicketId || !selectedDevId || mapped < reqSteps || !activeDeployFlow) {
      return toast.error("Designate a specific supervisor for every validation stage.");
    }

    setBusy(true);
    try {
      // 1. Bind Flow framework to Ticket
      const { error } = await supabase
        .from("tickets")
        .update({
          flow_id: activeDeployFlow.id,
          current_step: 1,
          assigned_to_user: selectedDevId,
          workflow_step_status: "working",
          last_submission_notes: null,
          status: "in_progress",
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedTicketId);

      if (error) throw error;

      // 2. Commit multi-stage relational reviewer mapping payloads
      const mappings = Object.entries(selectedReviewerIds).map(([sNum, rId]) => ({
        ticket_id: selectedTicketId,
        step_number: parseInt(sNum),
        reviewer_id: rId
      }));

      const { error: mapErr } = await supabase
        .from("ticket_step_reviewers")
        .insert(mappings);

      if (mapErr) throw mapErr;

      toast.success("🚀 Sequence deployed! Multi-stage reviewer grid initialized.");
      setDeployOpen(false);
      
      navigate({ to: `/tickets/${selectedTicketId}` as any });
    } catch (err: any) {
      toast.error(err.message || "Deployment failure.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddStep = () => {
    setSteps([...steps, { name: "", approver_role: targetType === "client" ? "client" : "sr_dev" }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: keyof LocalStep, value: string) => {
    setSteps(steps.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (steps.length === 0) {
      return toast.error("Define at least 1 operational stage.");
    }
    if (steps.some(s => !s.name.trim())) {
      return toast.error("Identify the title for all validation steps.");
    }

    setBusy(true);
    try {
      const { data: f, error: fErr } = await supabase
        .from("approval_flows")
        .insert({
          name: flowName,
          description: flowDesc || null,
          target_type: targetType,
          assigned_role: assignedRole,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (fErr) throw fErr;

      const insertSteps = steps.map((s, index) => ({
        flow_id: f.id,
        name: s.name,
        approver_role: s.approver_role,
        step_number: index + 1,
      }));

      const { error: sErr } = await supabase.from("approval_steps").insert(insertSteps);
      if (sErr) throw sErr;

      toast.success("Custom sequence built and secured!");
      
      setFlowName("");
      setFlowDesc("");
      setTargetType("staff");
      setAssignedRole("jr_dev");
      setSteps([{ name: "Senior Validation", approver_role: "sr_dev" }]);
      setCreateOpen(false);

      loadFlows();
    } catch (err: any) {
      toast.error(err.message || "Construction terminated.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFlow = async (id: string) => {
    if (!confirm("Discard this configuration?")) return;
    
    setBusy(true);
    try {
      const { error } = await supabase.from("approval_flows").delete().eq("id", id);
      if (error) throw error;
      toast.success("Sequence removed.");
      loadFlows();
    } catch (err: any) {
      toast.error(err.message || "Aborted deletion.");
    } finally {
      setBusy(false);
    }
  };

  const staffFlows = flows.filter(f => f.target_type === "staff");
  const clientFlows = flows.filter(f => f.target_type === "client");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2 text-foreground">
            <GitPullRequest className="h-7 w-7 text-primary" /> Process Architect
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Standardize validation lifecycles and pipeline orchestration.
          </p>
        </div>

        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg font-bold rounded-xl bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1" /> Construct Flow
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-black tracking-tight text-xl">
                  <GitPullRequest className="h-6 w-6 text-primary" />
                  Build Custom Sequence
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateFlow} className="space-y-6 pt-2">
                <div className="space-y-4 border-b pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-black text-xs uppercase tracking-widest opacity-80">1. Design Identity</Label>
                      <Input 
                        placeholder="e.g. Standard Escalation" 
                        required
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-black text-xs uppercase tracking-widest opacity-80">2. Lifecycle Classification</Label>
                      <Select 
                        value={targetType} 
                        onValueChange={(v: any) => {
                          setTargetType(v);
                          setSteps([{ name: "Initial Validation", approver_role: v === "client" ? "client" : "sr_dev" }]);
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Internal Operators (Developers)</SelectItem>
                          <SelectItem value="client">External Validation (Client Review)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-black text-xs uppercase tracking-widest opacity-80">Operational Goals (Optional)</Label>
                    <Textarea 
                      placeholder="Outline parameters..."
                      rows={2}
                      value={flowDesc}
                      onChange={(e) => setFlowDesc(e.target.value)}
                      className="rounded-xl resize-none"
                    />
                  </div>

                  {targetType === "staff" && (
                    <div className="p-4 bg-primary/[0.03] border rounded-xl space-y-2 animate-in fade-in duration-300">
                      <Label className="font-black text-xs uppercase tracking-widest opacity-80 flex items-center gap-1.5 text-primary">
                        <Hammer className="h-3.5 w-3.5" /> 3. Task Assignment Level
                      </Label>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-medium pb-1">
                        Direct which operational tier executes adjustments.
                      </p>
                      <Select value={assignedRole} onValueChange={(v: any) => setAssignedRole(v)}>
                        <SelectTrigger className="bg-background rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="jr_dev">Junior Developer Pool</SelectItem>
                          <SelectItem value="sr_dev">Senior Developer Pool</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-black text-xs uppercase tracking-widest opacity-80 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" /> 4. Sequential Validation Map
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAddStep}
                      className="h-7 text-xs font-bold border-dashed hover:bg-accent rounded-lg"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Step
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                    {steps.map((st, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 bg-muted/20 border p-2.5 rounded-xl animate-in zoom-in-95">
                        <div className="h-6 w-6 rounded-full bg-background border flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                          {idx + 1}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                          <Input 
                            placeholder="Identify validation target..." 
                            required
                            value={st.name}
                            onChange={(e) => handleStepChange(idx, "name", e.target.value)}
                            className="rounded-lg h-9 text-xs font-medium bg-background"
                          />
                          <Select 
                            value={st.approver_role} 
                            onValueChange={(v) => handleStepChange(idx, "approver_role", v)}
                          >
                            <SelectTrigger className="rounded-lg h-9 text-xs font-semibold bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {targetType === "staff" ? (
                                <>
                                  <SelectItem value="sr_dev">Senior Developer</SelectItem>
                                  <SelectItem value="pm">Product Manager</SelectItem>
                                  <SelectItem value="admin">System Admin</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="client">Owner Customer</SelectItem>
                                  <SelectItem value="admin">System Admin</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {steps.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive h-8 w-8 shrink-0 hover:bg-destructive/5"
                            onClick={() => handleRemoveStep(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={busy} className="w-full sm:w-auto font-black rounded-xl px-6">
                    {busy ? "Finalizing Schema..." : "Publish Process Template"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* RUN BLUEPRINT DIRECTLY ON SELECTED TICKET */}
      {activeDeployFlow && (
        <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black tracking-tight text-xl">
                <Zap className="h-6 w-6 text-primary fill-current animate-pulse" />
                Deploy Workflow Engine
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleDeploySubmit} className="space-y-5 py-3 max-h-[80vh] overflow-y-auto pr-1 scrollbar-thin">
              <div className="p-3 rounded-xl bg-primary/[0.02] border border-primary/10 text-xs font-semibold">
                Selected Template: <span className="font-black text-primary">{activeDeployFlow.name}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="font-black text-xs uppercase tracking-widest opacity-80 flex items-center gap-1">
                  1. Select Target Ticket
                </Label>
                <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
                  <SelectTrigger className="rounded-xl shadow-sm">
                    <SelectValue placeholder="Select unassigned ticket..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedTickets.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                    {unassignedTickets.length === 0 && (
                      <SelectItem value="none" disabled>No available open tickets</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTicketId && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="space-y-1.5 border-t pt-3">
                    <Label className="font-black text-xs uppercase tracking-widest opacity-80">
                      2. Designated Execution Dev
                    </Label>
                    <p className="text-[10px] text-muted-foreground pb-0.5 font-medium">
                      Candidates limited to matching execution tier: **{ROLE_LABELS[activeDeployFlow.assigned_role]}**.
                    </p>
                    <Select value={selectedDevId} onValueChange={setSelectedDevId}>
                      <SelectTrigger className="rounded-xl shadow-sm">
                        <SelectValue placeholder="Select specific developer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleDevs.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                        ))}
                        {eligibleDevs.length === 0 && <SelectItem value="none" disabled>No staff available</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* MULTI-STAGE STAGE REVIEWER ASSIGNMENTS */}
                  <div className="space-y-3 border-t pt-3">
                    <Label className="font-black text-xs uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> 3. Designated Stage Reviewers
                    </Label>
                    <p className="text-[10px] text-muted-foreground pb-1 font-medium">
                      Select a specific supervisor to audit each individual step:
                    </p>
                    
                    <div className="space-y-2.5">
                      {(activeDeployFlow.steps || []).map((step: any) => {
                        const matchingOptions = eligibleReviewers.filter(u => u.roles?.includes(step.approver_role));

                        return (
                          <div key={step.id} className="space-y-1.5 p-2.5 bg-muted/20 border rounded-xl shadow-sm animate-in slide-in-from-top-1">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground px-1">
                              <span>Stage {step.step_number}: {step.name}</span>
                              <span className="bg-background border px-1.5 py-0.5 rounded-md tracking-normal">{ROLE_LABELS[step.approver_role]}</span>
                            </div>
                            <Select 
                              value={selectedReviewerIds[step.step_number] || ""} 
                              onValueChange={(v) => setSelectedReviewerIds(prev => ({ ...prev, [step.step_number]: v }))}
                            >
                              <SelectTrigger className="h-9 bg-background text-xs font-bold rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
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
                </div>
              )}

              <DialogFooter className="pt-2 border-t border-dashed">
                <Button 
                  type="submit" 
                  disabled={busy || !selectedTicketId || !selectedDevId || Object.keys(selectedReviewerIds).length < (activeDeployFlow.steps?.length || 0)} 
                  className="w-full sm:w-auto font-black shadow-md rounded-xl"
                >
                  {busy ? "Linking Database..." : "⚡ Initialize & Dispatch"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12 font-bold text-xs tracking-wider">AUDITING SEQUENCES...</div>
      ) : flows.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center bg-card border rounded-2xl shadow-sm">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-black mb-1 tracking-tight">Empty Framework</h3>
          <p className="text-xs text-muted-foreground max-w-sm font-medium leading-relaxed">
            {canManage 
              ? "Construct templates above to standardize task executions and sequential peer-reviews." 
              : "There are currently no custom processes configured for your credentials."
            }
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Service Providers Grid */}
          {(canManage || (role && role !== "client" && role !== "admin")) && staffFlows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-primary/15">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-black tracking-tight">Developer Standard Operating Procedures</h2>
                <Badge variant="secondary" className="ml-1 rounded-md font-bold">{staffFlows.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {staffFlows.map(f => (
                  <FlowCard 
                    key={f.id} 
                    flow={f} 
                    onDelete={handleDeleteFlow} 
                    onDeploy={handleOpenDeploy}
                    canManage={canManage} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Clients Grid */}
          {(canManage || role === "client") && clientFlows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-emerald-500/15">
                <Users className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-black tracking-tight">Customer Validation Lifecycles</h2>
                <Badge className="ml-1 rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80 border-emerald-200 font-bold">{clientFlows.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {clientFlows.map(f => (
                  <FlowCard 
                    key={f.id} 
                    flow={f} 
                    onDelete={handleDeleteFlow} 
                    onDeploy={handleOpenDeploy}
                    canManage={canManage} 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlowCard({ 
  flow, 
  onDelete, 
  onDeploy,
  canManage 
}: { 
  flow: any; 
  onDelete: (id: string) => void; 
  onDeploy: (flow: any) => void;
  canManage: boolean 
}) {
  return (
    <Card className="p-6 bg-card relative overflow-hidden shadow-sm hover:shadow-md transition-all border rounded-2xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-2 max-w-xl flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-black tracking-tight text-foreground">{flow.name}</h3>
            {flow.target_type === "staff" && (
              <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/[0.03] text-primary font-black uppercase tracking-wide">
                🧑‍💻 Target Tier: {ROLE_LABELS[flow.assigned_role] || flow.assigned_role}
              </Badge>
            )}
          </div>
          {flow.description && (
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">{flow.description}</p>
          )}
          <div className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
            Established {new Date(flow.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && flow.target_type === "staff" && (
            <Button 
              size="sm" 
              onClick={() => onDeploy(flow)}
              className="bg-primary hover:bg-primary/90 font-bold text-[11px] px-3.5 h-8 shadow rounded-xl"
            >
              <Zap className="h-3.5 w-3.5 mr-1 fill-current animate-pulse" /> Run on Ticket
            </Button>
          )}
          
          {canManage && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => onDelete(flow.id)}
              className="text-destructive/70 border-destructive/10 hover:bg-destructive/5 h-8 w-8 rounded-xl shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 border-t pt-5">
        <div className="flex items-center flex-wrap gap-3 relative py-1 overflow-x-auto pb-3 scrollbar-thin">
          {(flow.steps || []).map((step: any, idx: number) => {
            const isLast = idx === (flow.steps?.length || 0) - 1;
            return (
              <div key={step.id} className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-start border border-border bg-muted/[0.15] px-3.5 py-2.5 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] min-w-[165px]">
                  <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/80 flex items-center gap-1 mb-1">
                    <div className="h-3.5 w-3.5 rounded-full bg-background border flex items-center justify-center text-[8px] font-black">
                      {step.step_number}
                    </div>
                    Stage
                  </div>
                  <div className="text-xs font-black truncate max-w-[175px] leading-tight text-foreground mb-1.5">{step.name}</div>
                  <div className="inline-flex items-center text-[9px] font-black tracking-wide uppercase bg-background text-foreground border rounded-lg px-2 py-0.5 shadow-sm">
                    🛡️ {ROLE_LABELS[step.approver_role] || step.approver_role}
                  </div>
                </div>
                
                {!isLast && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/35 mx-0.5 shrink-0 hidden sm:block" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
