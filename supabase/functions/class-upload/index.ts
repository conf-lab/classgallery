// class-upload: 학생이 반 코드로 자기 출석번호 칸에 그림(또는 작품 이름만)을 저장합니다.
// 로그인 없이 호출되며, 코드 검증 후 service_role 로 교사 계정 폴더에 업로드합니다.
//   body: { code, slot, name, imageBase64?, aspect? }
//   - imageBase64 가 있으면: 이미지 업로드 + 이름 저장
//   - imageBase64 가 없으면: 해당 칸의 작품 이름만 변경 (이미 사진이 있어야 함)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "gallery-images";
const MAX_SLOT = 29;
const MAX_BYTES = 3 * 1024 * 1024; // 압축된 이미지 상한 (약 3MB)
const MAX_NAME = 24;

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
    const { code, slot, name, imageBase64, aspect } = await req.json().catch(() => ({}));

    const s = Number(slot);
    if (!Number.isInteger(s) || s < 0 || s > MAX_SLOT) {
      return json({ error: "출석번호가 올바르지 않아요." }, 400);
    }
    const cleanName = String(name ?? "").slice(0, MAX_NAME);
    const hasImage = typeof imageBase64 === "string" && imageBase64.startsWith("data:image/");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cc } = await admin
      .from("class_codes")
      .select("uid, is_open")
      .eq("code", String(code ?? "").trim().toUpperCase())
      .maybeSingle();
    if (!cc) return json({ error: "코드를 찾을 수 없어요." }, 404);
    if (!cc.is_open) return json({ error: "지금은 업로드를 받지 않아요." }, 403);

    const path = `${cc.uid}/${s}.jpg`;
    let value: Record<string, unknown>;

    if (hasImage) {
      const comma = imageBase64.indexOf(",");
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(imageBase64.slice(comma + 1)), (c) => c.charCodeAt(0));
      } catch {
        return json({ error: "이미지를 읽을 수 없어요." }, 400);
      }
      if (bytes.byteLength === 0) return json({ error: "이미지가 비어 있어요." }, 400);
      if (bytes.byteLength > MAX_BYTES) return json({ error: "이미지 용량이 너무 커요." }, 413);

      const up = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (up.error) throw up.error;

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      value = {
        src: `${pub.publicUrl}?t=${Date.now()}`,
        path,
        aspect: Number(aspect) || 1,
        name: cleanName,
      };
    } else {
      // 이름만 변경: 기존 칸이 있어야 함
      const { data: gal } = await admin
        .from("galleries").select("slots").eq("uid", cc.uid).maybeSingle();
      const cur = Array.isArray(gal?.slots) ? gal!.slots[s] : null;
      if (!cur) return json({ error: "먼저 사진을 올려 주세요." }, 400);
      value = { ...cur, name: cleanName };
    }

    const { error: rpcErr } = await admin.rpc("set_gallery_slot", {
      p_uid: cc.uid,
      p_index: s,
      p_value: value,
    });
    if (rpcErr) throw rpcErr;

    return json({ url: value.src, path });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
