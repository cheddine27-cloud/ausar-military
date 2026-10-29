/**
 * وظيفة مؤقتة: إعادة تعيين كلمات مرور حسابات الديمو بدقة — بحث يدوي في كل الصفحات
 * لتفادي مشكلة emailFilter الخاطئة في admin.listUsers.
 * تُحذف بعد الفحص.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TARGETS: Record<string, string> = {
  "owner.demo@Ausar Military.example": "owner_qhudoor",
  "admin@smartattend.dz": "admin",
  "director.training@Ausar Military.test": "director_training",
  "director.kessab@Ausar Military.test": "director_kessab",
  "supervisor.kessab@Ausar Military.test": "supervisor_kessab",
  "admin.skikda@Ausar Military.test": "admin_skikda",
  "head.it@Ausar Military.test": "head_it_demo",
  "dean.sciences@Ausar Military.test": "dean_sciences_demo",
  "staff.skikda@Ausar Military.test": "staff_skikda_demo",
  "viewer@Ausar Military.test": "viewer_demo",
};

Deno.serve(async (_req: Request) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // جلب كل المستخدمين عبر التصفح يدويًا بدون emailFilter
  let allUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page });
    if (error || !data?.users?.length) break;
    allUsers = allUsers.concat(data.users);
    if (data.users.length < 50) break;
    page++;
  }

  const password = "Demo@2026";
  const results = [];
  for (const [email, username] of Object.entries(TARGETS)) {
    const user = allUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      results.push({ username, email, status: "not_found" });
      continue;
    }
    const { error: updErr, data: updated } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
    if (updErr) {
      results.push({ username, email, status: `update_failed: ${updErr.message}` });
      continue;
    }
    // تحقق فوري
    const c2 = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: lErr } = await c2.auth.signInWithPassword({ email, password });
    results.push({
      username,
      email,
      status: lErr ? `verify_failed: ${lErr.message}` : "verified",
    });
  }

  return new Response(JSON.stringify({ totalUsers: allUsers.length, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
