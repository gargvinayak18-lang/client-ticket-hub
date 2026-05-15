import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
  apiCreateClient, 
  apiListClients,
  apiDeleteUser,
  apiUpdatePassword
} from "@/lib/admin.api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreVertical, KeyRound, UserMinus, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const { role, loading } = useAuth();
  
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [busy, setBusy] = useState(false);

  // Password changing state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPwd, setUpdatingPwd] = useState(false);

  // Deletion state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    try {
      const c = await apiListClients();
      setClients(c);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (role === "admin") load();
  }, [role]);

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiCreateClient(form);
      toast.success("Client account created");
      setForm({ email: "", password: "", full_name: "" });
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || newPassword.length < 8) return;
    setUpdatingPwd(true);
    try {
      await apiUpdatePassword(targetUser.id, newPassword);
      toast.success(`Password updated for client ${targetUser.full_name}`);
      setNewPassword("");
      setTargetUser(null);
      setPasswordOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdatingPwd(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await apiDeleteUser(deletingUser.id);
      toast.success(`Client account deleted for ${deletingUser.full_name}`);
      setDeletingUser(null);
      setDeleteOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Create and manage client accounts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Client Account</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input 
                  placeholder="e.g. Jane Smith"
                  required 
                  value={form.full_name} 
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email" 
                  placeholder="client@email.com"
                  required 
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Temporary password (min 8 chars)</Label>
                <Input 
                  type="text" 
                  placeholder="Enter secure temporary password"
                  required 
                  minLength={8} 
                  value={form.password} 
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create Client"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reset Client Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={(v) => { if(!v) { setTargetUser(null); setNewPassword(""); } setPasswordOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Client Password</DialogTitle>
          </DialogHeader>
          {targetUser && (
            <form onSubmit={handlePasswordUpdate} className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                Set a new password for <strong className="text-foreground">{targetUser.full_name}</strong>.
              </div>
              <div className="space-y-2">
                <Label>New Password (min 8 chars)</Label>
                <Input
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updatingPwd}>
                  {updatingPwd ? "Updating…" : "Save Password"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Client Account Alert */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove client <strong className="text-foreground">{deletingUser?.full_name}</strong>. 
              All associated websites and support tickets for this client will also be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, delete client"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {clients.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No clients found.</Card>
      ) : (
        <Card className="divide-y border overflow-hidden shadow-sm">
          {clients.map((c) => (
            <div key={c.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center border flex-shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-sm text-muted-foreground">{c.email}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-muted-foreground">
                    Joined {new Date(c.created_at).toLocaleDateString()}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Client Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="cursor-pointer flex items-center gap-2"
                      onClick={() => {
                        setTargetUser(c);
                        setPasswordOpen(true);
                      }}
                    >
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      Change Password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-2"
                      onClick={() => {
                        setDeletingUser(c);
                        setDeleteOpen(true);
                      }}
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove Client
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}