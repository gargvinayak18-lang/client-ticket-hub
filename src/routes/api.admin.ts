import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function verifyAdmin(authHeader: string | null) {
  if (!authHeader) throw new Error("Unauthorized");
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Forbidden: admin only");
  return user;
}

export const APIRoute = createAPIFileRoute("/api/admin")({
  POST: async ({ request }) => {
    try {
      const authHeader = request.headers.get("Authorization");
      const user = await verifyAdmin(authHeader);
      const { action, data } = await request.json() as any;

      switch (action) {
        case "listStaff": {
          const { data: roles, error } = await supabaseAdmin
            .from("user_roles")
            .select("user_id, role")
            .in("role", ["jr_dev", "sr_dev", "pm", "tester"]);
          if (error) throw new Error(error.message);
          if (!roles || roles.length === 0) return new Response(JSON.stringify([]));
          const ids = roles.map((r) => r.user_id);
          const { data: profiles, error: pe } = await supabaseAdmin
            .from("profiles")
            .select("id, email, full_name, created_at")
            .in("id", ids)
            .order("created_at", { ascending: false });
          if (pe) throw new Error(pe.message);
          return new Response(
            JSON.stringify(
              (profiles || []).map((p) => ({
                ...p,
                role: roles.find((r) => r.user_id === p.id)?.role || "jr_dev",
              }))
            )
          );
        }

        case "createStaff": {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: { full_name: data.full_name },
          });
          if (error) throw new Error(error.message);
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .update({ role: data.role })
            .eq("user_id", created.user!.id);
          if (roleErr) throw new Error(roleErr.message);
          return new Response(JSON.stringify({ id: created.user!.id }));
        }

        case "listClients": {
          const { data: roles, error } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "client");
          if (error) throw new Error(error.message);
          const ids = (roles || []).map((r) => r.user_id);
          if (ids.length === 0) return new Response(JSON.stringify([]));
          const { data: profiles, error: pe } = await supabaseAdmin
            .from("profiles")
            .select("id, email, full_name, created_at")
            .in("id", ids)
            .order("created_at", { ascending: false });
          if (pe) throw new Error(pe.message);
          return new Response(JSON.stringify(profiles || []));
        }

        case "createClient": {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: { full_name: data.full_name },
          });
          if (error) throw new Error(error.message);
          return new Response(JSON.stringify({ id: created.user!.id }));
        }

        case "listAdmins": {
          const { data: roles, error } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          if (error) throw new Error(error.message);
          const ids = (roles || []).map((r) => r.user_id);
          if (ids.length === 0) return new Response(JSON.stringify([]));
          const { data: profiles, error: pe } = await supabaseAdmin
            .from("profiles")
            .select("id, email, full_name, created_at")
            .in("id", ids)
            .order("created_at", { ascending: false });
          if (pe) throw new Error(pe.message);
          return new Response(JSON.stringify(profiles || []));
        }

        case "createAdmin": {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: { full_name: data.full_name },
          });
          if (error) throw new Error(error.message);
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .update({ role: "admin" })
            .eq("user_id", created.user!.id);
          if (roleErr) throw new Error(roleErr.message);
          return new Response(JSON.stringify({ id: created.user!.id }));
        }

        case "deleteUser": {
          if (data.userId === user.id) throw new Error("Self-deletion is prohibited.");
          const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
          if (error) throw new Error(error.message);
          return new Response(JSON.stringify({ success: true }));
        }

        case "updatePassword": {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
            password: data.password,
          });
          if (error) throw new Error(error.message);
          return new Response(JSON.stringify({ success: true }));
        }

        case "updateRole": {
          if (data.userId === user.id) throw new Error("You cannot change your own role.");
          const { error } = await supabaseAdmin
            .from("user_roles")
            .update({ role: data.role })
            .eq("user_id", data.userId);
          if (error) throw new Error(error.message);
          return new Response(JSON.stringify({ success: true }));
        }

        case "addWebsite": {
          const { error } = await supabaseAdmin.from("websites").insert({
            client_id: data.client_id,
            name: data.name,
            url: data.url,
          });
          if (error) throw new Error(error.message);
          return new Response(JSON.stringify({ ok: true }));
        }

        case "listWebsites": {
          const { data: ws, error } = await supabaseAdmin
            .from("websites")
            .select("id, name, url, created_at")
            .eq("client_id", data.client_id)
            .order("created_at", { ascending: false });
          if (error) throw new Error(error.message);
          return new Response(JSON.stringify(ws || []));
        }

        default:
          return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
      }
    } catch (err: any) {
      const status = err.message === "Unauthorized" ? 401 : err.message?.includes("Forbidden") ? 403 : 500;
      return new Response(JSON.stringify({ error: err.message || "Server error" }), { status });
    }
  },
});
