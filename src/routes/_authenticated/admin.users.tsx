import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
  apiCreateStaff, 
  apiListStaff, 
  apiDeleteUser, 
  apiUpdatePassword,
  apiUpdateRole 
} from "@/lib/admin.api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { UserPlus, UserRoundCog, MoreVertical, KeyRound, UserMinus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: StaffManagementPage,
});

type StaffRole = "jr_dev" | "sr_dev" | "pm" | "tester";

function StaffManagementPage() {
  const { role, loading } = useAuth();
  
  const [staff, setStaff] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "jr_dev" as StaffRole });
  const [busy, setBusy] = useState(false);

  // Password changing state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPwd, setUpdatingPwd] = useState(false);

  // Deletion state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);

  // Role change state
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [updatingRole, setUpdatingRole] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    try {
      const s = await apiListStaff();
      setStaff(s);
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
      await apiCreateStaff(form);
      toast.success("Staff account provisioned successfully");
      setForm({ email: "", password: "", full_name: "", role: "jr_dev" });
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
      toast.success(`Account removed for ${deletingUser.full_name}`);
      setDeletingUser(null);
      setDeleteOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTarget || !selectedRole) return;
    setUpdatingRole(true);
    try {
      await apiUpdateRole(roleTarget.id, selectedRole);
      toast.success(`Role updated to ${selectedRole} for ${roleTarget.full_name}`);
      setRoleTarget(null);
      setSelectedRole("");
      setRoleOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdatingRole(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "jr_dev":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 font-medium">
            Jr. Developer
          </Badge>
        );
      case "sr_dev":
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 font-medium">
            Sr. Developer
          </Badge>
        );
      case "pm":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 font-medium">
            Product Manager
          </Badge>
        );
      case "tester":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 font-medium">
            Tester
          </Badge>
        );
      default:
        return <Badge variant="outline">Staff</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            Staff & Developers
          </h1>
          <p className="text-muted-foreground mt-1">Manage developers and product managers who view and review client tickets</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Provision Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Provision Staff Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input 
                  placeholder="e.g. Alice Vance"
                  required 
                  value={form.full_name} 
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input 
                  type="email" 
                  placeholder="developer@company.com"
                  required 
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>System Assignment / Role</Label>
                <Select 
                  value={form.role} 
                  onValueChange={(v: StaffRole) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jr_dev">Jr. Developer</SelectItem>
                    <SelectItem value="sr_dev">Sr. Developer</SelectItem>
                    <SelectItem value="pm">Product Manager</SelectItem>
                    <SelectItem value="tester">Tester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temporary Password (min 8 chars)</Label>
                <Input 
                  type="text" 
                  placeholder="Enter temporary secure password"
                  required 
                  minLength={8} 
                  value={form.password} 
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                  {busy ? "Provisioning…" : "Provision Account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Password Change Modal */}
      <Dialog open={passwordOpen} onOpenChange={(v) => { if(!v) { setTargetUser(null); setNewPassword(""); } setPasswordOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Staff Password</DialogTitle>
          </DialogHeader>
          {targetUser && (
            <form onSubmit={handlePasswordUpdate} className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                Change password for <strong className="text-foreground">{targetUser.full_name}</strong> ({targetUser.email}).
              </div>
              <div className="space-y-2">
                <Label>New Password (min 8 chars)</Label>
                <Input
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
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

      {/* Remove User Alert */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently remove staff account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove {" "}
              <strong className="text-foreground">{deletingUser?.full_name}</strong> ({deletingUser?.email}) from your platform team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Yes, remove staff"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Modal */}
      <Dialog open={roleOpen} onOpenChange={(v) => { if(!v) { setRoleTarget(null); setSelectedRole(""); } setRoleOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Change User Role
            </DialogTitle>
          </DialogHeader>
          {roleTarget && (
            <form onSubmit={handleRoleChange} className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                Reassign role for <strong className="text-foreground">{roleTarget.full_name}</strong> ({roleTarget.email}).
              </div>
              <div className="space-y-2">
                <Label>Current Role</Label>
                <div>{getRoleBadge(roleTarget.role)}</div>
              </div>
              <div className="space-y-2">
                <Label>New Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jr_dev">Jr. Developer</SelectItem>
                    <SelectItem value="sr_dev">Sr. Developer</SelectItem>
                    <SelectItem value="pm">Product Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="tester">Tester</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setRoleOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updatingRole || !selectedRole || selectedRole === roleTarget.role}>
                  {updatingRole ? "Updating…" : "Update Role"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {staff.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No staff members found yet.</Card>
      ) : (
        <Card className="divide-y overflow-hidden border shadow-sm bg-card">
          {staff.map((member) => {
            return (
              <div key={member.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center border flex-shrink-0">
                    <UserRoundCog className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {member.full_name}
                    </div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right flex flex-col items-end justify-center hidden sm:flex gap-1">
                    <div>{getRoleBadge(member.role)}</div>
                    <div className="text-xs text-muted-foreground">
                      Added {new Date(member.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Staff Utilities</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          setTargetUser(member);
                          setPasswordOpen(true);
                        }}
                      >
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          setRoleTarget(member);
                          setSelectedRole(member.role);
                          setRoleOpen(true);
                        }}
                      >
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-2"
                        onClick={() => {
                          setDeletingUser(member);
                          setDeleteOpen(true);
                        }}
                      >
                        <UserMinus className="h-4 w-4" />
                        Remove Staff
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
