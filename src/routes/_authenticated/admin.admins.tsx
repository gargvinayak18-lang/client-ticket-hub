import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
  apiCreateAdmin, 
  apiListAdmins, 
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
import { ShieldPlus, UserRound, MoreVertical, KeyRound, UserMinus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  component: AdminsPage,
});

function AdminsPage() {
  const { role, loading, user } = useAuth();
  
  const [admins, setAdmins] = useState<any[]>([]);
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
      const a = await apiListAdmins();
      setAdmins(a);
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
      await apiCreateAdmin(form);
      toast.success("Admin user created successfully");
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
      toast.success(`Password updated for ${targetUser.full_name}`);
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
      toast.success(`Account deleted for ${deletingUser.full_name}`);
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
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            Administrators
          </h1>
          <p className="text-muted-foreground mt-1">Manage team members with administrative access</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
              <ShieldPlus className="h-4 w-4" /> Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Administrator Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input 
                  placeholder="e.g. John Doe"
                  required 
                  value={form.full_name} 
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input 
                  type="email" 
                  placeholder="email@company.com"
                  required 
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Temporary Password (min 8 chars)</Label>
                <Input 
                  type="text" 
                  placeholder="Create a secure password"
                  required 
                  minLength={8} 
                  value={form.password} 
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                  {busy ? "Creating…" : "Provision Admin"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Manage Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={(v) => { if(!v) { setTargetUser(null); setNewPassword(""); } setPasswordOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {targetUser && (
            <form onSubmit={handlePasswordUpdate} className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                Set a new password for <strong className="text-foreground">{targetUser.full_name}</strong> ({targetUser.email}).
              </div>
              <div className="space-y-2">
                <Label>New Password (min 8 chars)</Label>
                <Input
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updatingPwd}>
                  {updatingPwd ? "Saving…" : "Update Password"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Alert */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the administrative account for{" "}
              <strong className="text-foreground">{deletingUser?.full_name}</strong> ({deletingUser?.email}) and remove all their platform access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, delete account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {admins.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Loading administrators...</Card>
      ) : (
        <Card className="divide-y overflow-hidden border shadow-sm bg-card">
          {admins.map((admin) => {
            const isMe = admin.email === user?.email;
            return (
              <div key={admin.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-accent/20 text-accent flex items-center justify-center border flex-shrink-0">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {admin.full_name}
                      {isMe && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold border border-primary/20">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{admin.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-medium text-primary/80 bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md inline-block mb-1">
                      Administrator
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(admin.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {!isMe && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="cursor-pointer flex items-center gap-2"
                          onClick={() => {
                            setTargetUser(admin);
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
                            setDeletingUser(admin);
                            setDeleteOpen(true);
                          }}
                        >
                          <UserMinus className="h-4 w-4" />
                          Remove Admin
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
