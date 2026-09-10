// class-info: 반 코드로 어느 갤러리인지 확인하고, 현재 슬롯 상태를 학생 페이지에 돌려줍니다.
// 로그인하지 않은 학생이 호출합니다. service_role 로 조회하므로 RLS 를 우회합니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { code } = await req.json().catch(() => ({}));
    if (!code || typeof code !== "string") return json({ error: "코드가 필요해요." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cc } = await admin
      .from("class_codes")
      .select("uid, is_open")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (!cc) return json({ error: "코드를 찾을 수 없어요. 선생님께 확인해 주세요." }, 404);
    if (!cc.is_open) return json({ error: "지금은 업로드를 받지 않아요." }, 403);

    const [{ data: prof }, { data: gal }] = await Promise.all([
      admin.from("profiles").select("nickname").eq("uid", cc.uid).maybeSingle(),
      admin.from("galleries").select("slots").eq("uid", cc.uid).maybeSingle(),
    ]);

    return json({
      uid: cc.uid,
      nickname: prof?.nickname ?? "",
      slots: Array.isArray(gal?.slots) ? gal!.slots : [],
    });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
