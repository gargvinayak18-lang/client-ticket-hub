import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const adminCreateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(72),
        full_name: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    return { id: created.user!.id };
  });

export const adminListClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profiles, error: pe } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (pe) throw new Error(pe.message);
    return profiles ?? [];
  });

export const adminCreateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(72),
        full_name: z.string().min(1).max(120),
        role: z.enum(["jr_dev", "sr_dev", "pm", "tester"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);

    // Override the trigger's default 'client' assignment
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", created.user!.id);

    if (roleErr) throw new Error(roleErr.message);

    return { id: created.user!.id };
  });

export const adminListStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["jr_dev", "sr_dev", "pm", "tester"]);

    if (error) throw new Error(error.message);
    if (!roles || roles.length === 0) return [];

    const ids = roles.map((r) => r.user_id);
    const { data: profiles, error: pe } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });

    if (pe) throw new Error(pe.message);

    // Merge the roles back into the profiles object
    return (profiles ?? []).map((p) => {
      const userRole = roles.find((r) => r.user_id === p.id);
      return {
        ...p,
        role: userRole?.role || "jr_dev",
      };
    });
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.userId === context.userId) {
      throw new Error("Self-deletion is prohibited.");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminUpdateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminAddWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        client_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        url: z.string().url().max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("websites").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListWebsitesForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ client_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: ws, error } = await supabaseAdmin
      .from("websites")
      .select("id, name, url, created_at")
      .eq("client_id", data.client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ws ?? [];
  });

export const adminCreateAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(72),
        full_name: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);

    // Wait, since the handle_new_user trigger runs on creation and defaults to 'client',
    // we explicitly UPDATE their role to 'admin'.
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", created.user!.id);

    if (roleErr) throw new Error(roleErr.message);

    return { id: created.user!.id };
  });

export const adminListAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profiles, error: pe } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (pe) throw new Error(pe.message);
    return profiles ?? [];
  });

export const adminUpdateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "client", "jr_dev", "sr_dev", "pm", "tester"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.userId === context.userId) {
      throw new Error("You cannot change your own role.");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", data.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });