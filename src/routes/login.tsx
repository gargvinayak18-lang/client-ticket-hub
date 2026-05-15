import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
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
  const [mode, setMode] = useState<"signin" | "admin-signup">("signin");
  const [fullName, setFullName] = useState("");

  if (!loading && session) return <Navigate to="/dashboard" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "admin-signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Admin account created. Signing in…");
      const { error: e2 } = await signIn(email, password);
      if (e2) return toast.error(e2);
      navigate({ to: "/dashboard" });
      return;
    }
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
          <h1 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in to Helpdesk" : "Create admin account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage tickets for your websites</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "admin-signup" && (
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create admin account"}
          </Button>
          <div className="text-xs text-muted-foreground text-center pt-2 space-y-1">
            <p>Client accounts are created by your admin.</p>
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setMode(mode === "signin" ? "admin-signup" : "signin")}
            >
              {mode === "signin" ? "First-time admin? Create account" : "Back to sign in"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}