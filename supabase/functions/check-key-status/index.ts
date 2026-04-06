import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { key, deviceFingerprint } = await req.json();

    if (!key) {
      return new Response(JSON.stringify({ valid: false, error: "Missing key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: row, error } = await supabase
      .from("access_keys")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (error || !row) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid access key." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!row.active) {
      return new Response(JSON.stringify({ valid: false, error: "This key has been deactivated." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "This key has expired." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Device fingerprint check
    const fingerprints: string[] = row.device_fingerprints || [];
    
    if (deviceFingerprint && !fingerprints.includes(deviceFingerprint)) {
      if (fingerprints.length >= (row.max_devices || 1)) {
        return new Response(JSON.stringify({
          valid: false,
          error: `Device limit reached (${row.max_devices}). Contact support.`,
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Register new device
      fingerprints.push(deviceFingerprint);
      await supabase
        .from("access_keys")
        .update({ device_fingerprints: fingerprints, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    return new Response(JSON.stringify({ valid: true, label: row.label }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
