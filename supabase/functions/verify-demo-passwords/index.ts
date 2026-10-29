/**
 * وظيفة مؤقتة للتحقق من كلمات مرور حسابات الديمو — تعيد قائمة الحسابات مع نتيجة تسجيل دخول فعلي.
 * تُحذف بعد الفحص.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req: Request) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const accounts = [
    { username: "owner_qhudoor", email: "owner.demo@Ausar Military.example" },
    { username: "admin", email: "admin@smartattend.dz" },
    { username: "director_training", email: "director.training@Ausar Military.test" },
  ];

  const results = [];
  for (const acc of accounts) {
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
      emailFilter: acc.email,
    });
    if (error || !users?.users?.length) {
      results.push({ ...acc, found: false });
      continue;
    }
    const u = users.users[0];
    // try login as the user via service role (signInWithPassword as admin)
    const { data: authRes, error: authErr } =
      await supabaseAdmin.auth.signInWithPassword({
        email: acc.email,
        password: "Demo@2026",
      });
    results.push({
      ...acc,
      found: true,
      updated_at: u.updated_at,
      loginOk: !authErr && !!authRes.user,
      err: authErr?.message ?? null,
    });
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
