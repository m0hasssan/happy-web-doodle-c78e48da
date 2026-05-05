// Edge function: create a new user (admin only or with create_users permission)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AppPermission =
  | "view_dashboard"
  | "export_data"
  | "view_users"
  | "manage_users"
  | "create_users";

interface Payload {
  email: string;
  password: string;
  full_name?: string;
  is_admin?: boolean;
  permissions?: AppPermission[];
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
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Caller-scoped client to identify who is calling
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = userData.user.id;

    // Admin client (service role) for privileged operations
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check authorization: admin OR has create_users permission
    const { data: canCreate, error: permErr } = await admin.rpc(
      "has_permission",
      { _user_id: callerId, _permission: "create_users" },
    );
    if (permErr) throw permErr;
    if (!canCreate) {
      return json({ error: "Forbidden: missing create_users permission" }, 403);
    }

    const body: Payload = await req.json();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const fullName = body.full_name?.trim() || email.split("@")[0];
    const isAdmin = !!body.is_admin;
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "بريد إلكتروني غير صالح" }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: "كلمة المرور يجب أن تكون 6 أحرف فأكثر" }, 400);
    }

    // Create the auth user (auto-confirmed so they can sign in immediately)
    const { data: created, error: createErr } = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "تعذر إنشاء المستخدم" }, 400);
    }

    const newUserId = created.user.id;

    // Trigger handle_new_user creates profile + default 'user' role.
    // Ensure profile reflects the supplied full_name in case of race/edge.
    await admin.from("profiles").upsert({
      id: newUserId,
      email,
      full_name: fullName,
    });

    if (isAdmin) {
      await admin.from("user_roles").upsert(
        { user_id: newUserId, role: "admin" },
        { onConflict: "user_id,role" },
      );
    }

    if (permissions.length > 0) {
      await admin.from("user_permissions").insert(
        permissions.map((p) => ({ user_id: newUserId, permission: p })),
      );
    }

    return json({ success: true, user_id: newUserId });
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
