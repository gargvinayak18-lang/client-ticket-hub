import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiAddWebsite, apiListClients, apiListWebsites } from "@/lib/admin.api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Globe } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/websites")({
  component: WebsitesPage,
});

function WebsitesPage() {
  const { role, loading } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [websites, setWebsites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role === "admin") {
      apiListClients()
        .then(setClients)
        .catch((e) => toast.error(e.message));
    }
  }, [role]);

  useEffect(() => {
    if (selected) {
      apiListWebsites(selected)
        .then(setWebsites)
        .catch((e) => toast.error(e.message));
    }
  }, [selected]);

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiAddWebsite({ client_id: selected, ...form });
      toast.success("Website added");
      setForm({ name: "", url: "" });
      setOpen(false);
      const ws = await apiListWebsites(selected);
      setWebsites(ws);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-semibold">Websites</h1>
        <p className="text-muted-foreground mt-1">Assign websites to clients</p>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 w-full space-y-2">
            <Label>Client</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selected} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Add Website</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Website</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input type="url" required placeholder="https://example.com" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {selected && (
          websites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No websites for this client yet.</p>
          ) : (
            <div className="divide-y border rounded-md">
              {websites.map((w) => (
                <div key={w.id} className="p-3 flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{w.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{w.url}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </Card>
    </div>
  );
}