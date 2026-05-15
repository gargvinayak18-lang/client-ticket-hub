import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TicketIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/dashboard" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center mb-3">
            <TicketIcon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Sign in to Helpdesk</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage tickets for your websites</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-xs text-muted-foreground text-center pt-2">
            Client accounts are created by your admin.
          </p>
        </form>
      </Card>
    </div>
  );
}