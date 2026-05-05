// Edge function: delete a user (admin only or with manage_users permission)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: canManage, error: permErr } = await admin.rpc(
      "has_permission",
      { _user_id: callerId, _permission: "manage_users" },
    );
    if (permErr) throw permErr;
    if (!canManage) {
      return json({ error: "Forbidden: missing manage_users permission" }, 403);
    }

    const body: Payload = await req.json();
    const targetId = (body.user_id ?? "").trim();
    if (!targetId) return json({ error: "user_id مطلوب" }, 400);

    if (targetId === callerId) {
      return json({ error: "لا يمكنك حذف حسابك الخاص" }, 400);
    }

    // Cleanup related rows (no FK cascades configured)
    await admin.from("user_permissions").delete().eq("user_id", targetId);
    await admin.from("user_roles").delete().eq("user_id", targetId);
    await admin.from("profiles").delete().eq("id", targetId);

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
    return json({ error: msg }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
