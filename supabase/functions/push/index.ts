// NoiDue — Edge Function "push"
// Modalità:
//   { mode: "diary", from: "a"|"b", title, body }  -> avvisa l'altra persona
//   { mode: "cron" }                               -> scansiona i promemoria scaduti e li invia
//
// Variabili d'ambiente richieste (Project Settings -> Edge Functions -> Secrets):
//   VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (es. mailto:tuamail@example.com)
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili in automatico)

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:noidue@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const db = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function loadStore(key: string, fallback: unknown) {
  const { data } = await db.from("store").select("data").eq("key", key).single();
  return data?.data ?? fallback;
}
async function saveStore(key: string, value: unknown) {
  await db.from("store").upsert({ key, data: value });
}

type Sub = { endpoint: string; keys: { p256dh: string; auth: string }; person: string };

async function sendTo(subs: Sub[], payload: unknown) {
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint); // subscription scaduta
      }
    })
  );
  return dead;
}

async function pruneDead(deadEndpoints: string[]) {
  if (!deadEndpoints.length) return;
  const subs = (await loadStore("noidue:push_subs", [])) as Sub[];
  await saveStore("noidue:push_subs", subs.filter((s) => !deadEndpoints.includes(s.endpoint)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const body = await req.json().catch(() => ({}));
  const subs = (await loadStore("noidue:push_subs", [])) as Sub[];

  if (body.mode === "diary") {
    const targets = subs.filter((s) => s.person !== body.from);
    const dead = await sendTo(targets, {
      title: body.title || "NoiDue",
      body: body.body || "Novità nel diario",
      url: "/",
    });
    await pruneDead(dead);
    return json({ sent: targets.length });
  }

  if (body.mode === "cron") {
    const cal = (await loadStore("noidue:calendario", [])) as any[];
    const state = (await loadStore("noidue:push_state", { notified: [] })) as { notified: string[] };
    const now = Date.now();
    let inviati = 0;
    const dead: string[] = [];

    for (const e of cal) {
      if (!e.promemoria || !e.data || state.notified.includes(e.id)) continue;
      const t = new Date(`${e.data}T${e.ora || "09:00"}`).getTime();
      if (isNaN(t)) continue;
      // scattato nell'ultima ora (così non perde l'evento tra un giro e l'altro del cron)
      if (t <= now && now - t < 60 * 60 * 1000) {
        const d = await sendTo(subs, {
          title: "Promemoria ⏰",
          body: `${e.titolo}${e.ora ? " · " + e.ora : ""}`,
          url: "/",
        });
        dead.push(...d);
        state.notified.push(e.id);
        inviati++;
      }
    }
    if (inviati) await saveStore("noidue:push_state", state);
    await pruneDead(dead);
    return json({ reminders: inviati });
  }

  return json({ ok: true });
});
