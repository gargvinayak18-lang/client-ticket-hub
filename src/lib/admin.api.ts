import { supabase } from "@/integrations/supabase/client";

async function adminCall(action: string, data?: any) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, data }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export async function apiListStaff() {
  return adminCall("listStaff");
}

export async function apiCreateStaff(data: {
  email: string;
  password: string;
  full_name: string;
  role: string;
}) {
  return adminCall("createStaff", data);
}

export async function apiListClients() {
  return adminCall("listClients");
}

export async function apiCreateClient(data: {
  email: string;
  password: string;
  full_name: string;
}) {
  return adminCall("createClient", data);
}

export async function apiListAdmins() {
  return adminCall("listAdmins");
}

export async function apiCreateAdmin(data: {
  email: string;
  password: string;
  full_name: string;
}) {
  return adminCall("createAdmin", data);
}

export async function apiDeleteUser(userId: string) {
  return adminCall("deleteUser", { userId });
}

export async function apiUpdatePassword(userId: string, password: string) {
  return adminCall("updatePassword", { userId, password });
}

export async function apiUpdateRole(userId: string, role: string) {
  return adminCall("updateRole", { userId, role });
}

export async function apiAddWebsite(data: {
  client_id: string;
  name: string;
  url: string;
}) {
  return adminCall("addWebsite", data);
}

export async function apiListWebsites(client_id: string) {
  return adminCall("listWebsites", { client_id });
}
