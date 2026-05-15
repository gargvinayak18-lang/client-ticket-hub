import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tickets/new")({
  component: NewTicket,
});

function NewTicket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [websites, setWebsites] = useState<any[]>([]);
  const [websiteId, setWebsiteId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"issue" | "improvement" | "enhancement">("issue");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("websites").select("id, name, url").order("name");
      setWebsites(data ?? []);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteId) return toast.error("Pick a website");
    setBusy(true);
    const { error } = await supabase.from("tickets").insert({
      client_id: user!.id,
      website_id: websiteId,
      title,
      description,
      type,
      priority,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket created");
    navigate({ to: "/tickets" });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold mb-6">New Ticket</h1>
      <Card className="p-6">
        {websites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't have any websites assigned yet. Please contact your admin.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Website</Label>
              <Select value={websiteId} onValueChange={setWebsiteId}>
                <SelectTrigger><SelectValue placeholder="Select a website" /></SelectTrigger>
                <SelectContent>
                  {websites.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} — {w.url}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="issue">Issue / Bug</SelectItem>
                    <SelectItem value="enhancement">Enhancement / New Feature</SelectItem>
                    <SelectItem value="improvement">Improvement / Design Changes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea required rows={6} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/tickets" })}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Create ticket"}</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}