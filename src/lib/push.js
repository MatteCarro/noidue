import { supabase, dbLoad, dbSave } from "./supabase";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC;
const SUBS_KEY = "noidue:push_subs";
const ME_KEY = "noidue:me"; // 'a' (Lui) o 'b' (Lei), per-dispositivo

export function getMe() {
  return localStorage.getItem(ME_KEY) || null;
}
export function setMe(person) {
  localStorage.setItem(ME_KEY, person);
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function permissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Registra il service worker, chiede permesso e salva la subscription
export async function enablePush(person) {
  if (!pushSupported()) throw new Error("Questo dispositivo non supporta le notifiche push.");
  setMe(person);

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permesso notifiche negato.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  // Salva nella tabella store (array, dedup per endpoint)
  const subs = await dbLoad(SUBS_KEY, []);
  const json = sub.toJSON();
  const entry = { endpoint: json.endpoint, keys: json.keys, person };
  const altri = subs.filter((s) => s.endpoint !== entry.endpoint);
  await dbSave(SUBS_KEY, [...altri, entry]);

  return true;
}

// Invia una notifica push "diario" all'altra persona (via Edge Function)
export async function notifyDiary(titolo, autore) {
  const me = getMe();
  const from = me || (autore === "b" ? "b" : "a");
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        mode: "diary",
        from,
        title: "Nuovo ricordo 💛",
        body: titolo ? `“${titolo}”` : "C'è un nuovo pensiero nel diario",
      }),
    });
  } catch (e) {
    console.warn("push diario non inviato:", e);
  }
}
