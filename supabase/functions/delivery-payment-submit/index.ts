import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function getSecretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return parsed.default || parsed.service_role || parsed.serviceRole || Object.values(parsed)[0];
    } catch {}
  }
  return "";
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const secret = getSecretKey();
  if (!url || !secret) return reply({ error: "Server configuration is incomplete" }, 500);

  let uploadedPath = "";
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const form = await req.formData();
    const token = String(form.get("token") || "").trim();
    const paymentType = String(form.get("payment_type") || "").trim().toUpperCase();
    const paymentMethod = String(form.get("payment_method") || "").trim().toUpperCase();
    const payerPhone = String(form.get("payer_phone") || "").trim();
    const transactionId = String(form.get("transaction_id") || "").trim();
    const amount = Number(form.get("amount"));
    const selectedDaysRaw = String(form.get("selected_days") || "").trim();
    const selectedDays = selectedDaysRaw ? Number(selectedDaysRaw) : null;
    const file = form.get("screenshot");
    if (!token || token.length < 12 || token.length > 128) return reply({ error: "Invalid delivery link" }, 400);
    if (!(file instanceof File)) return reply({ error: "Upload a payment screenshot" }, 400);
    if (file.size < 1 || file.size > 5 * 1024 * 1024) return reply({ error: "Screenshot must be 5 MB or smaller" }, 400);
    const extByType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = extByType[file.type];
    if (!ext) return reply({ error: "Screenshot must be JPEG, PNG, or WebP" }, 400);
    if (!["BKASH", "NAGAD", "DBBL", "ROCKET"].includes(paymentMethod)) return reply({ error: "Choose bKash, Nagad, Dutch-Bangla Bank, or Rocket" }, 400);

    const { data: portal, error: portalError } = await admin
      .from("delivery_portals")
      .select("id")
      .eq("secure_token", token)
      .maybeSingle();
    if (portalError || !portal) return reply({ error: "Delivery portal not found" }, 404);

    uploadedPath = `${portal.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage.from("delivery-payment-proofs").upload(uploadedPath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await admin.rpc("submit_delivery_payment", {
      p_token: token,
      p_payment_type: paymentType,
      p_payer_phone: payerPhone,
      p_transaction_id: transactionId,
      p_amount: amount,
      p_selected_days: selectedDays,
      p_payment_method: paymentMethod,
      p_proof_storage_path: uploadedPath,
    });
    if (error) {
      await admin.storage.from("delivery-payment-proofs").remove([uploadedPath]);
      uploadedPath = "";
      return reply({ error: error.message || "Could not submit payment" }, 400);
    }
    return reply(data || { success: true });
  } catch (error) {
    if (uploadedPath) await admin.storage.from("delivery-payment-proofs").remove([uploadedPath]);
    console.error("delivery-payment-submit error", error);
    return reply({ error: error instanceof Error ? error.message : "Payment submission failed" }, 500);
  }
});
