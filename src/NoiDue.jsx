import React, { useState, useEffect, useRef, useMemo } from "react";
import { dbLoad, dbSave } from "./lib/supabase";
import {
  Heart, CalendarDays, UtensilsCrossed, FolderHeart, Users,
  Plus, Trash2, ShoppingCart, Sparkles, Check, X, Bell,
  MapPin, Loader2, PenLine, ChevronDown, CalendarClock,
} from "lucide-react";

/* ============================================================
   NoiDue — "Maison Noir" edition
   Dark, warm, editoriale. Tipografia in italico drammatico,
   accenti pesca/oro, vetro scuro. Sezioni: Noi, Agenda, Cucina,
   Progetti (con cascade + checklist + scadenza).
   Persistenza: localStorage tramite load/save.
   ============================================================ */

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

/* ---------- AI ingredienti via Groq (gratis) ---------- */
const CATEGORIE_VALIDE = ["Frutta e Verdura", "Carne e Pesce", "Latticini e Uova", "Pane e Pasta", "Dispensa", "Altro"];

async function generaIngredienti(piatto, porzioni) {
  const apiKey = import.meta.env.VITE_GROQ_KEY;
  const prompt = `Sei un assistente culinario italiano. Per il piatto "${piatto}" per ${porzioni} persone, elenca gli ingredienti necessari.
Rispondi SOLO con un array JSON valido, senza markdown, senza spiegazioni. Formato:
[{"nome":"...","quantita":"...","categoria":"..."}]
Le categorie devono essere esattamente una di queste: "Frutta e Verdura", "Carne e Pesce", "Latticini e Uova", "Pane e Pasta", "Dispensa", "Altro".
Adatta le quantità per ${porzioni} persone.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${errBody?.error?.message || res.statusText}`);
  }
  const json = await res.json();
  const testo = json.choices?.[0]?.message?.content || "";
  const pulito = testo.replace(/```json|```/g, "").trim();
  const ingredienti = JSON.parse(pulito).map((i) => ({
    nome: i.nome,
    quantita: i.quantita,
    categoria: CATEGORIE_VALIDE.includes(i.categoria) ? i.categoria : "Altro",
  }));

  return { piatto, porzioni, ingredienti };
}

/* ============================================================ */
const DEFAULT_PROFILES = {
  a: { nome: "Lui", emoji: "🧔", bio: "Videomaker e artista visivo, non bello quanto lei, ma talentuoso anche lui." },
  b: { nome: "Lei", emoji: "👩", bio: "Musicista esperta, bella e talentuosa." },
  since: "2026-01-10",
};

export default function NoiDue() {
  const [tab, setTab] = useState("home");
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [posts, setPosts] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [pasti, setPasti] = useState([]);
  const [spesa, setSpesa] = useState([]);
  const [progetti, setProgetti] = useState([]);
  const [pianoPasti, setPianoPasti] = useState({ a: {}, b: {} });

  useEffect(() => {
    async function init() {
      const [p, po, cal, pa, sp, pr, piano] = await Promise.all([
        dbLoad("noidue:profiles", DEFAULT_PROFILES),
        dbLoad("noidue:posts", []),
        dbLoad("noidue:calendario", []),
        dbLoad("noidue:pasti", []),
        dbLoad("noidue:spesa", []),
        dbLoad("noidue:progetti", []),
        dbLoad("noidue:pianoPasti", { a: {}, b: {} }),
      ]);
      setProfiles(p);
      setPosts(po);
      setCalendario(cal);
      setPasti(pa);
      setSpesa(sp);
      setProgetti(pr);
      setPianoPasti(piano);
      initialized.current = true;
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => { if (initialized.current) dbSave("noidue:profiles", profiles); }, [profiles]);
  useEffect(() => { if (initialized.current) dbSave("noidue:posts", posts); }, [posts]);
  useEffect(() => { if (initialized.current) dbSave("noidue:calendario", calendario); }, [calendario]);
  useEffect(() => { if (initialized.current) dbSave("noidue:pasti", pasti); }, [pasti]);
  useEffect(() => { if (initialized.current) dbSave("noidue:spesa", spesa); }, [spesa]);
  useEffect(() => { if (initialized.current) dbSave("noidue:progetti", progetti); }, [progetti]);
  useEffect(() => { if (initialized.current) dbSave("noidue:pianoPasti", pianoPasti); }, [pianoPasti]);

  const autori = [
    { key: "a", label: profiles.a.nome, tone: "peach" },
    { key: "b", label: profiles.b.nome, tone: "rose" },
    { key: "noi", label: "Noi", tone: "gold" },
  ];
  const nav = [
    { id: "home", label: "Noi", Icon: Users },
    { id: "calendario", label: "Agenda", Icon: CalendarDays },
    { id: "pasti", label: "Cucina", Icon: UtensilsCrossed },
    { id: "progetti", label: "Progetti", Icon: FolderHeart },
  ];
  const giorni = useMemo(() => {
    if (!profiles.since) return null;
    const d = Math.floor((Date.now() - new Date(profiles.since).getTime()) / 86400000);
    return d >= 0 ? d : null;
  }, [profiles.since]);

  if (!ready) {
    return (
      <div className="nd-root relative min-h-screen flex items-center justify-center">
        <NDStyles />
        <Backdrop />
        <div className="relative z-[1] flex flex-col items-center gap-3 text-[var(--ink3)]">
          <Loader2 size={28} className="animate-spin text-[var(--peach)]" />
          <span className="nd-hand text-[20px]">caricamento…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="nd-root relative min-h-screen">
      <NDStyles />
      <Backdrop />

      <div className="relative z-[1] pb-[120px] sm:pb-12">
        <header className="nd-wrap pt-7 sm:pt-10">
          <div className="flex items-center justify-between mb-9 nd-up">
            <div className="flex items-center gap-2.5">
              <div className="nd-mark"><Heart size={13} fill="currentColor" /></div>
              <span className="text-[13px] uppercase tracking-[0.32em] text-[var(--ink2)]">noidue</span>
            </div>
            <nav className="hidden sm:flex items-center gap-1">
              {nav.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={`nd-toplink ${tab === id ? "is-active" : ""}`}>
                  {label}
                </button>
              ))}
            </nav>
            {giorni != null && (
              <div className="nd-pill-stat sm:hidden">
                <span className="opacity-70">giorno</span>
                <span className="font-semibold text-[var(--ink)]">{giorni}</span>
              </div>
            )}
          </div>

          {tab === "home" && (
            <Hero profiles={profiles} giorni={giorni} />
          )}
          {tab !== "home" && (
            <div className="nd-up mb-2">
              <p className="nd-kicker">{tabKicker(tab)}</p>
              <h1 className="nd-h1">{tabTitle(tab)}</h1>
              <div className="nd-rule" />
            </div>
          )}
        </header>

        <main className="nd-wrap mt-8 sm:mt-12">
          <div key={tab} className="nd-up">
            {tab === "home" && <Home profiles={profiles} setProfiles={setProfiles} posts={posts} setPosts={setPosts} autori={autori} giorni={giorni} />}
            {tab === "calendario" && <Calendario eventi={calendario} setEventi={setCalendario} autori={autori} />}
            {tab === "pasti" && <Pasti pasti={pasti} setPasti={setPasti} spesa={spesa} setSpesa={setSpesa} pianoPasti={pianoPasti} setPianoPasti={setPianoPasti} profiles={profiles} />}
            {tab === "progetti" && <Progetti progetti={progetti} setProgetti={setProgetti} autori={autori} />}
          </div>
        </main>

        <footer className="nd-wrap mt-16 mb-2 text-center">
          <p className="nd-hand text-[var(--ink3)] text-[18px]">
            fatto con <Heart size={12} className="inline align-[-1px] text-[var(--peach)]" fill="currentColor" /> solo per noi
          </p>
        </footer>
      </div>

      <nav className="nd-bottomnav sm:hidden">
        <div className="nd-bottomnav-inner">
          {nav.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={`nd-tab ${active ? "is-active" : ""}`} aria-label={label}>
                <Icon size={19} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const tabKicker = (t) => ({ calendario: "le nostre date", pasti: "ai fornelli", progetti: "cose insieme" }[t] || "");
const tabTitle = (t) => ({ calendario: "Agenda", pasti: "Cucina", progetti: "Progetti" }[t] || "");

/* ---------- HERO ---------- */
function Hero({ profiles, giorni }) {
  return (
    <div className="nd-hero nd-up">
      <p className="nd-kicker">il nostro angolo di mondo</p>
      <h1 className="nd-display">
        <span className="nd-name">{profiles.a.nome}</span>
        <span className="nd-amp">
          <Heart className="nd-heart" size={28} fill="currentColor" />
        </span>
        <span className="nd-name nd-name-b">{profiles.b.nome}</span>
      </h1>

      {giorni != null && (
        <div className="nd-monument">
          <div className="nd-monument-num">{giorni}</div>
          <div className="nd-monument-label">insieme</div>
          <div className="nd-monument-sub">insieme da {giorni} giorn{giorni === 1 ? "o" : "i"} · dal {formatDateIT(profiles.since)}</div>
        </div>
      )}
    </div>
  );
}

function formatDateIT(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
}

/* ============================================================ STILI */
function NDStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,500;1,9..144,600;1,9..144,700&family=Inter:wght@400;500;600;700&family=Caveat:wght@500;600;700&display=swap');

      .nd-root {
        --bg: #14100E;
        --bg2: #1B1512;
        --bg3: #241B17;
        --bg4: #2E2320;
        --ink: #F2E9DC;
        --ink2: #C9B9A6;
        --ink3: #897B6E;
        --line: #38291F;
        --line2: #4A372C;
        --peach: #FF9870;
        --peachDeep: #E5683E;
        --rose: #E08080;
        --gold: #E8B86A;
        --sage: #9DB389;
        --plum: #B287AC;
        font-family: 'Inter', system-ui, sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      .nd-root .nd-serif { font-family: 'Fraunces', Georgia, serif; font-feature-settings: "ss01"; }
      .nd-root .nd-hand  { font-family: 'Caveat', cursive; }

      .nd-wrap { max-width: 760px; margin: 0 auto; padding-left: 22px; padding-right: 22px; }
      @media (min-width: 900px) { .nd-wrap { max-width: 920px; } }

      input, textarea, select { font-family: inherit; font-size: 16px; color: inherit; }
      input::placeholder, textarea::placeholder { color: var(--ink3); opacity: 1; }
      :is(input, textarea, select):focus { outline: none; }
      button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
        outline: 2px solid var(--peach); outline-offset: 2px; border-radius: 14px;
      }
      ::selection { background: var(--peach); color: #1a1110; }

      /* BACKDROP: ambient warm glows */
      .nd-backdrop { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: var(--bg); }
      .nd-backdrop .glow { position: absolute; border-radius: 50%; filter: blur(100px); will-change: transform; opacity: .55; }
      .nd-backdrop .g1 { width: 70vw; height: 70vw; left: -22vw; top: -28vw; background: radial-gradient(circle, #C24D2D 0%, transparent 65%); animation: ndDrift1 28s ease-in-out infinite alternate; }
      .nd-backdrop .g2 { width: 60vw; height: 60vw; right: -24vw; top: 5vh; background: radial-gradient(circle, #8B5E83 0%, transparent 65%); animation: ndDrift2 32s ease-in-out infinite alternate; opacity: .45; }
      .nd-backdrop .g3 { width: 70vw; height: 70vw; left: -10vw; bottom: -36vw; background: radial-gradient(circle, #6E4F2A 0%, transparent 65%); animation: ndDrift3 36s ease-in-out infinite alternate; opacity: .42; }
      .nd-backdrop .grain {
        position: absolute; inset: 0; opacity: .14; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      }
      .nd-backdrop .vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,.55) 100%); }

      @keyframes ndDrift1 { from { transform: translate(0,0) scale(1);} to { transform: translate(8vw, 6vw) scale(1.12);} }
      @keyframes ndDrift2 { from { transform: translate(0,0) scale(1);} to { transform: translate(-6vw, 4vw) scale(1.08);} }
      @keyframes ndDrift3 { from { transform: translate(0,0) scale(1);} to { transform: translate(7vw, -5vw) scale(1.1);} }

      /* HEADER */
      .nd-mark {
        width: 28px; height: 28px; border-radius: 9px;
        background: linear-gradient(135deg, var(--peach), var(--peachDeep));
        display: grid; place-items: center; color: #2a1810;
        box-shadow: 0 6px 16px -6px rgba(255,152,112,.6), inset 0 1px 0 rgba(255,255,255,.25);
      }
      .nd-toplink {
        position: relative; padding: 8px 14px; font-size: 13.5px; font-weight: 500;
        color: var(--ink2); border-radius: 10px; transition: color .2s ease;
      }
      .nd-toplink:hover { color: var(--ink); }
      .nd-toplink.is-active { color: var(--ink); }
      .nd-toplink.is-active::after {
        content: ""; position: absolute; left: 14px; right: 14px; bottom: 2px;
        height: 2px; border-radius: 2px;
        background: linear-gradient(90deg, var(--peach), var(--gold));
      }
      .nd-pill-stat {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; padding: 6px 12px; border-radius: 999px;
        background: rgba(255,255,255,.04); border: 1px solid var(--line2);
        color: var(--ink2);
      }

      /* HERO */
      .nd-hero { padding: 6px 0 4px; overflow: visible; }
      .nd-kicker { font-family: 'Caveat', cursive; color: var(--peach); font-size: 24px; line-height: 1; margin-bottom: 8px; letter-spacing: .01em; }
      .nd-h1 { font-family: 'Fraunces', serif; font-style: italic; font-weight: 600; letter-spacing: -.025em; line-height: 1.1; font-size: clamp(48px, 11vw, 84px); padding: .05em .15em; margin: 0 -.15em; overflow: visible; }
      .nd-display { font-family: 'Fraunces', serif; font-style: italic; font-weight: 600; letter-spacing: -.035em; line-height: 1.1; font-size: clamp(56px, 14vw, 124px); padding: .05em .15em; margin: 0 -.15em; overflow: visible; }
      .nd-name { background: linear-gradient(180deg, var(--ink) 0%, #C9B9A6 100%); -webkit-background-clip: text; background-clip: text; color: transparent; padding: .08em .05em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      .nd-name-b { background: linear-gradient(180deg, var(--peach) 0%, var(--peachDeep) 100%); -webkit-background-clip: text; background-clip: text; color: transparent; padding: .08em .05em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      .nd-amp { display: inline-flex; vertical-align: middle; margin: 0 .12em; }
      .nd-heart { color: var(--peach); animation: ndBeat 2.4s ease-in-out infinite; transform-origin: center; filter: drop-shadow(0 6px 18px rgba(255,152,112,.5)); }
      @keyframes ndBeat { 0%,100% { transform: scale(1);} 14% { transform: scale(1.24);} 28% { transform: scale(.96);} 42% { transform: scale(1.16);} 56% { transform: scale(1);} }

      .nd-rule { height: 1px; background: linear-gradient(90deg, var(--line2), transparent); margin-top: 18px; }

      /* MONUMENT counter */
      .nd-monument { margin-top: 32px; display: flex; flex-direction: column; gap: 0; align-items: flex-start; overflow: visible; }
      .nd-monument-num {
        font-family: 'Fraunces', serif; font-style: italic; font-weight: 600;
        font-size: clamp(72px, 18vw, 168px); line-height: 1; letter-spacing: -.04em;
        background: linear-gradient(180deg, var(--gold) 0%, #B0822E 80%);
        -webkit-background-clip: text; background-clip: text; color: transparent;
        overflow: visible; padding-right: .15em; padding-bottom: 4px;
      }
      .nd-monument-label {
        font-family: 'Fraunces', serif; font-style: italic; font-weight: 600;
        font-size: clamp(36px, 9vw, 72px); line-height: 1; letter-spacing: -.02em;
        color: var(--ink); margin-top: -2px;
      }
      .nd-monument-sub { font-size: 13px; letter-spacing: .04em; color: var(--ink3); margin-top: 10px; }

      /* CARD */
      .nd-card {
        background: linear-gradient(180deg, rgba(46,35,32,.92), rgba(36,27,23,.85));
        border: 1px solid var(--line);
        border-radius: 22px;
        box-shadow:
          0 1px 0 rgba(255,255,255,.04) inset,
          0 24px 50px -28px rgba(0,0,0,.65),
          0 8px 18px -10px rgba(0,0,0,.45);
        transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
      }
      .nd-card.hover-lift { cursor: default; }
      .nd-card.hover-lift:hover {
        transform: translateY(-2px);
        border-color: var(--line2);
        box-shadow:
          0 1px 0 rgba(255,255,255,.06) inset,
          0 30px 60px -28px rgba(0,0,0,.75),
          0 12px 24px -10px rgba(0,0,0,.55);
      }
      .nd-card.glow { position: relative; }
      .nd-card.glow::before {
        content: ""; position: absolute; inset: -1px; border-radius: 23px; padding: 1px;
        background: linear-gradient(135deg, rgba(255,152,112,.45), transparent 35%, rgba(232,184,106,.35));
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
        pointer-events: none;
      }

      /* INPUTS */
      .nd-input, .nd-textarea, .nd-select {
        width: 100%; min-height: 46px; padding: 12px 14px;
        background: rgba(20,15,13,.6);
        border: 1px solid var(--line);
        border-radius: 13px; color: var(--ink);
        transition: all .2s ease;
      }
      .nd-input:focus, .nd-textarea:focus, .nd-select:focus {
        background: rgba(20,15,13,.85); border-color: var(--peach);
        box-shadow: 0 0 0 4px rgba(255,152,112,.16);
      }
      .nd-textarea { min-height: 96px; resize: vertical; line-height: 1.55; }
      .nd-select option { background: var(--bg2); color: var(--ink); }

      /* BUTTONS */
      .nd-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 11px 18px; border-radius: 999px; font-weight: 600; font-size: 14px; transition: all .2s ease; letter-spacing: .005em; }
      .nd-btn:active { transform: scale(.97); }
      .nd-btn.primary { color: #2a1810; background: linear-gradient(135deg, var(--peach), var(--peachDeep)); box-shadow: 0 14px 28px -12px rgba(255,152,112,.55), inset 0 1px 0 rgba(255,255,255,.25); }
      .nd-btn.primary:hover { filter: brightness(1.05); box-shadow: 0 18px 32px -12px rgba(255,152,112,.6); }
      .nd-btn.gold { color: #2a1810; background: linear-gradient(135deg, var(--gold), #B0822E); box-shadow: 0 14px 28px -12px rgba(232,184,106,.55), inset 0 1px 0 rgba(255,255,255,.25); }
      .nd-btn.ghost { color: var(--ink); background: rgba(255,255,255,.04); border: 1px solid var(--line2); }
      .nd-btn.ghost:hover { background: rgba(255,255,255,.07); border-color: var(--peach); }
      .nd-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 11px; color: var(--ink3); transition: all .2s ease; }
      .nd-icon-btn:hover { color: var(--peach); background: rgba(255,152,112,.1); }

      /* CHIPS */
      .nd-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
      .nd-chip.peach { background: rgba(255,152,112,.16); color: #FFB89A; border: 1px solid rgba(255,152,112,.25); }
      .nd-chip.rose { background: rgba(224,128,128,.16); color: #F2A6A6; border: 1px solid rgba(224,128,128,.25); }
      .nd-chip.gold { background: rgba(232,184,106,.16); color: #F0CB87; border: 1px solid rgba(232,184,106,.25); }
      .nd-chip.sage { background: rgba(157,179,137,.18); color: #BFD2AC; border: 1px solid rgba(157,179,137,.28); }
      .nd-chip.muted { background: rgba(255,255,255,.04); color: var(--ink2); border: 1px solid var(--line2); }
      .nd-chip.danger { background: rgba(224,80,80,.18); color: #F0A4A4; border: 1px solid rgba(224,80,80,.3); }

      /* SECTION HEADER (non-home) */
      .nd-up { animation: ndUp .55s cubic-bezier(.2,.7,.2,1) both; }
      .nd-pop { animation: ndPop .35s ease both; }
      @keyframes ndUp { from { opacity: 0; transform: translateY(14px);} to { opacity: 1; transform: none;} }
      @keyframes ndPop { 0% { transform: scale(.96); opacity: 0;} 100% { transform: scale(1); opacity: 1;} }

      /* SUB SECTION TITLE inside pages */
      .nd-sub { display: flex; align-items: baseline; gap: 12px; margin-bottom: 18px; }
      .nd-sub .nd-eye { font-family: 'Caveat', cursive; color: var(--peach); font-size: 22px; line-height: 1; }
      .nd-sub h2 { font-family: 'Fraunces', serif; font-style: italic; font-weight: 600; font-size: clamp(26px, 5vw, 34px); letter-spacing: -.02em; }

      /* AUTORE SEGMENT */
      .nd-segment { display: inline-flex; padding: 4px; gap: 2px; border-radius: 999px; background: rgba(20,15,13,.6); border: 1px solid var(--line); }
      .nd-segment-btn { padding: 7px 14px; min-height: 36px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--ink3); transition: all .2s ease; }
      .nd-segment-btn:hover { color: var(--ink2); }
      .nd-segment-btn.is-active { color: #2a1810; }

      /* CHECK */
      .nd-check { width: 22px; height: 22px; border-radius: 7px; border: 1.5px solid var(--line2); display: grid; place-items: center; background: rgba(20,15,13,.6); transition: all .18s ease; flex-shrink: 0; }
      .nd-check:hover { border-color: var(--peach); }
      .nd-check.is-on { background: linear-gradient(135deg, var(--sage), #6F8B5C); border-color: transparent; box-shadow: 0 6px 14px -6px rgba(157,179,137,.55); }

      /* BOTTOM NAV */
      .nd-bottomnav { position: fixed; left: 0; right: 0; bottom: max(14px, env(safe-area-inset-bottom)); z-index: 30; padding: 0 16px; }
      .nd-bottomnav-inner {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px; gap: 2px;
        background: rgba(20,15,13,.78);
        border: 1px solid var(--line2);
        border-radius: 22px;
        backdrop-filter: blur(20px) saturate(140%);
        -webkit-backdrop-filter: blur(20px) saturate(140%);
        box-shadow: 0 24px 38px -16px rgba(0,0,0,.7), 0 6px 14px -8px rgba(0,0,0,.5);
      }
      .nd-tab {
        flex: 1; min-height: 52px; min-width: 44px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
        border-radius: 16px; color: var(--ink3); font-size: 10.5px; font-weight: 600;
        transition: all .22s ease;
      }
      .nd-tab:hover { color: var(--ink2); }
      .nd-tab.is-active {
        color: #2a1810;
        background: linear-gradient(135deg, var(--peach), var(--peachDeep));
        box-shadow: 0 14px 24px -10px rgba(255,152,112,.55);
      }
      .nd-tab:active { transform: scale(.96); }

      /* CATEGORY PILL (cucina) */
      .nd-cat-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); background: rgba(255,255,255,.04); border: 1px solid var(--line2); }

      /* PROGETTO CASCADE */
      .nd-cascade { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.2,.7,.2,1); }
      .nd-cascade.is-open { grid-template-rows: 1fr; }
      .nd-cascade > div { overflow: hidden; }

      /* PROGRESS BAR */
      .nd-progress { height: 4px; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,.06); }
      .nd-progress > span { display: block; height: 100%; background: linear-gradient(90deg, var(--peach), var(--gold)); transition: width .5s ease; }
    `}</style>
  );
}
function Backdrop() {
  return (
    <div className="nd-backdrop" aria-hidden="true">
      <div className="glow g1" />
      <div className="glow g2" />
      <div className="glow g3" />
      <div className="grain" />
      <div className="vignette" />
    </div>
  );
}

/* ---------- mattoncini ---------- */
function SubTitle({ kicker, title, children }) {
  return (
    <div className="nd-sub flex-wrap">
      {kicker && <span className="nd-eye">{kicker}</span>}
      <h2>{title}</h2>
      <div className="ml-auto">{children}</div>
    </div>
  );
}
function Input(props) {
  const { className = "", ...rest } = props;
  return <input className={`nd-input ${className}`} {...rest} />;
}
function Textarea(props) {
  const { className = "", ...rest } = props;
  return <textarea className={`nd-textarea ${className}`} {...rest} />;
}
function NDSelect(props) {
  const { className = "", children, ...rest } = props;
  return <select className={`nd-select ${className}`} {...rest}>{children}</select>;
}
function Button({ variant = "primary", className = "", children, ...rest }) {
  return <button type="button" className={`nd-btn ${variant} ${className}`} {...rest}>{children}</button>;
}
function IconButton({ label = "", className = "", children, ...rest }) {
  return (
    <button type="button" aria-label={label} className={`nd-icon-btn ${className}`} {...rest}>
      {children}
    </button>
  );
}
function AutoreChip({ autore, autori }) {
  const a = autori.find((x) => x.key === autore) || autori[2];
  return <span className={`nd-chip ${a.tone}`}>{a.label}</span>;
}
function AutoreSelect({ value, onChange, autori }) {
  const grad = (tone) => tone === "peach" ? "linear-gradient(135deg,#FF9870,#E5683E)"
    : tone === "rose" ? "linear-gradient(135deg,#E08080,#B25A5A)"
      : "linear-gradient(135deg,#E8B86A,#B0822E)";
  return (
    <div className="nd-segment">
      {autori.map((a) => {
        const active = value === a.key;
        return (
          <button key={a.key} type="button" onClick={() => onChange(a.key)}
            className={`nd-segment-btn ${active ? "is-active" : ""}`}
            style={active ? { background: grad(a.tone), boxShadow: "0 8px 18px -8px rgba(255,152,112,.45)" } : {}}>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
function Empty({ text }) {
  return (
    <div className="rounded-2xl px-5 py-10 text-center text-sm border border-dashed"
      style={{ borderColor: "var(--line2)", background: "rgba(255,255,255,.02)", color: "var(--ink3)" }}>
      {text}
    </div>
  );
}

/* ============================================================ HOME */
function Home({ profiles, setProfiles, posts, setPosts, autori, giorni }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ titolo: "", testo: "", autore: "noi" });
  const up = (k, f, v) => setProfiles((p) => ({ ...p, [k]: { ...p[k], [f]: v } }));
  const addPost = () => {
    if (!draft.titolo.trim() && !draft.testo.trim()) return;
    setPosts((a) => [{ id: uid(), ...draft, data: new Date().toISOString() }, ...a]);
    setDraft({ titolo: "", testo: "", autore: "noi" });
  };

  return (
    <div>
      <SubTitle kicker="chi siamo" title="I nostri profili">
        <button type="button" onClick={() => setEditing((e) => !e)} className="nd-btn ghost"
          style={editing ? { color: "#2a1810", background: "linear-gradient(135deg,var(--peach),var(--peachDeep))", borderColor: "transparent" } : {}}>
          <PenLine size={14} /> {editing ? "Fatto" : "Modifica"}
        </button>
      </SubTitle>

      <div className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-2">
        {["a", "b"].map((k, i) => (
          <div key={k} className={`nd-card ${i === 1 ? "glow" : ""} hover-lift nd-up p-5`} style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center rounded-2xl shrink-0"
                style={{
                  width: 60, height: 60, fontSize: 30,
                  background: i ? "linear-gradient(135deg, rgba(255,152,112,.22), rgba(229,104,62,.18))" : "linear-gradient(135deg, rgba(232,184,106,.2), rgba(176,130,46,.16))",
                  border: "1px solid var(--line2)",
                }}>
                {profiles[k].emoji}
              </div>
              {!editing && (
                <div className="min-w-0">
                  <h3 className="nd-serif italic font-semibold text-[24px] leading-tight">{profiles[k].nome}</h3>
                  <p className="text-[10.5px] tracking-[0.22em] uppercase font-semibold text-[var(--ink3)] mt-0.5">{i ? "Lei" : "Lui"}</p>
                </div>
              )}
            </div>
            {editing ? (
              <div className="flex flex-col gap-2">
                <Input value={profiles[k].emoji} onChange={(e) => up(k, "emoji", e.target.value)} placeholder="Emoji" maxLength={2} />
                <Input value={profiles[k].nome} onChange={(e) => up(k, "nome", e.target.value)} placeholder="Nome" />
                <Textarea value={profiles[k].bio} onChange={(e) => up(k, "bio", e.target.value)} rows={3} />
              </div>
            ) : (
              <p className="text-[14.5px] leading-relaxed text-[var(--ink2)]">{profiles[k].bio}</p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="nd-card mt-4 p-4 flex items-center gap-3 flex-wrap">
          <span className="nd-hand text-[19px] text-[var(--gold)]">insieme dal</span>
          <Input type="date" value={profiles.since || ""} onChange={(e) => setProfiles((p) => ({ ...p, since: e.target.value }))} className="flex-1 min-w-[160px]" />
          {giorni != null && <span className="nd-chip gold">{giorni} giorni</span>}
        </div>
      )}

      <div className="mt-12">
        <SubTitle kicker="il nostro diario" title="Pensieri & momenti" />
        <div className="nd-card p-4 mb-5">
          <Input value={draft.titolo} onChange={(e) => setDraft({ ...draft, titolo: e.target.value })} placeholder="Titolo (es. La nostra prima cena…)" className="mb-2" />
          <Textarea value={draft.testo} onChange={(e) => setDraft({ ...draft, testo: e.target.value })} rows={3} placeholder="Cosa è successo oggi?" className="mb-3" />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <AutoreSelect value={draft.autore} onChange={(v) => setDraft({ ...draft, autore: v })} autori={autori} />
            <Button onClick={addPost}><Plus size={16} /> Pubblica</Button>
          </div>
        </div>

        {posts.length === 0 ? (
          <Empty text="Ancora nessun ricordo scritto. Iniziate voi due 💛" />
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((p, i) => (
              <article key={p.id} className="nd-card hover-lift nd-up p-5" style={{ animationDelay: `${Math.min(i, 6) * 0.05}s` }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <AutoreChip autore={p.autore} autori={autori} />
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] text-[var(--ink3)]">
                      {new Date(p.data).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <IconButton label="Elimina" onClick={() => setPosts((a) => a.filter((x) => x.id !== p.id))}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
                {p.titolo && <h3 className="nd-serif italic font-semibold text-[22px] leading-tight tracking-[-0.01em]">{p.titolo}</h3>}
                {p.testo && <p className="text-[14.5px] leading-relaxed text-[var(--ink2)] mt-1.5 whitespace-pre-wrap">{p.testo}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ CALENDARIO */
function Calendario({ eventi, setEventi, autori }) {
  const [d, setD] = useState({ titolo: "", data: "", ora: "", luogo: "", autore: "noi", promemoria: true });
  const add = () => {
    if (!d.titolo.trim() || !d.data) return;
    setEventi((a) => [...a, { id: uid(), ...d }]);
    setD({ titolo: "", data: "", ora: "", luogo: "", autore: "noi", promemoria: true });
  };
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const ord = [...eventi].sort((a, b) => (a.data + (a.ora || "")).localeCompare(b.data + (b.ora || "")));
  const prossimi = ord.filter((e) => new Date(e.data) >= oggi);
  const passati = ord.filter((e) => new Date(e.data) < oggi).reverse();

  const Riga = ({ e, i, dim }) => {
    const g = new Date(e.data);
    return (
      <div className="nd-card hover-lift nd-up p-4 flex gap-4 items-center"
        style={{ animationDelay: `${Math.min(i, 6) * 0.05}s`, opacity: dim ? 0.62 : 1 }}>
        <div className="rounded-xl px-3 py-2 text-center shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(255,152,112,.18), rgba(229,104,62,.12))",
            minWidth: 60, border: "1px solid rgba(255,152,112,.25)",
          }}>
          <div className="nd-serif italic font-bold text-[24px] leading-none text-[var(--peach)]">{g.getDate()}</div>
          <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--peach)] mt-0.5 opacity-80">
            {g.toLocaleDateString("it-IT", { month: "short" }).replace(".", "")}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-[15px]">{e.titolo}</h3>
            <AutoreChip autore={e.autore} autori={autori} />
            {e.promemoria && <Bell size={13} className="text-[var(--gold)]" />}
          </div>
          <div className="flex gap-3 text-[var(--ink3)] text-[12.5px] mt-1 flex-wrap">
            {e.ora && <span>🕒 {e.ora}</span>}
            {e.luogo && <span className="flex items-center gap-1"><MapPin size={12} /> {e.luogo}</span>}
          </div>
        </div>
        <IconButton label="Elimina" onClick={() => setEventi((a) => a.filter((x) => x.id !== e.id))}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    );
  };

  return (
    <div>
      <div className="nd-card p-4 mb-7">
        <Input value={d.titolo} onChange={(e) => setD({ ...d, titolo: e.target.value })} placeholder="Es. Cena di anniversario" className="mb-2" />
        <div className="grid gap-2 grid-cols-2 mb-2">
          <Input type="date" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} />
          <Input type="time" value={d.ora} onChange={(e) => setD({ ...d, ora: e.target.value })} />
        </div>
        <Input value={d.luogo} onChange={(e) => setD({ ...d, luogo: e.target.value })} placeholder="Luogo (opzionale)" className="mb-3" />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <AutoreSelect value={d.autore} onChange={(v) => setD({ ...d, autore: v })} autori={autori} />
            <button type="button" onClick={() => setD({ ...d, promemoria: !d.promemoria })}
              className="nd-btn ghost" style={{ minHeight: 36, padding: "6px 12px", fontSize: 12.5 }}>
              <Bell size={13} style={{ color: d.promemoria ? "var(--gold)" : "var(--ink3)" }} />
              <span style={{ color: d.promemoria ? "var(--ink)" : "var(--ink3)" }}>Promemoria</span>
            </button>
          </div>
          <Button onClick={add}><Plus size={16} /> Aggiungi</Button>
        </div>
      </div>

      {prossimi.length === 0 && passati.length === 0 && <Empty text="Nessun appuntamento in agenda." />}

      {prossimi.length > 0 && (
        <>
          <h4 className="nd-hand text-[21px] text-[var(--peach)] mb-3">in arrivo →</h4>
          <div className="flex flex-col gap-3 mb-9">{prossimi.map((e, i) => <Riga key={e.id} e={e} i={i} />)}</div>
        </>
      )}
      {passati.length > 0 && (
        <>
          <h4 className="nd-hand text-[21px] text-[var(--ink3)] mb-3">già passati</h4>
          <div className="flex flex-col gap-3">{passati.map((e, i) => <Riga key={e.id} e={e} i={i} dim />)}</div>
        </>
      )}
    </div>
  );
}

/* ============================================================ CUCINA */
const CAT_ORDER = ["Frutta e Verdura", "Carne e Pesce", "Latticini e Uova", "Pane e Pasta", "Dispensa", "Altro"];
const CAT_EMOJI = { "Frutta e Verdura": "🥦", "Carne e Pesce": "🥩", "Latticini e Uova": "🧀", "Pane e Pasta": "🍞", "Dispensa": "🫙", "Altro": "🛒" };

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const PASTI_SLOT = ["pranzo", "cena"];

function PianoSettimanale({ pianoPasti, setPianoPasti, profiles }) {
  const [persona, setPersona] = useState("a");
  const [editing, setEditing] = useState(null); // { giorno, slot }
  const [draft, setDraft] = useState("");

  const piano = pianoPasti[persona] || {};

  const apriEdit = (giorno, slot) => {
    setEditing({ giorno, slot });
    setDraft(piano[giorno]?.[slot] || "");
  };
  const salva = () => {
    if (!editing) return;
    setPianoPasti((prev) => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [editing.giorno]: {
          ...(prev[persona]?.[editing.giorno] || {}),
          [editing.slot]: draft.trim(),
        },
      },
    }));
    setEditing(null);
    setDraft("");
  };
  const cancella = (giorno, slot) => {
    setPianoPasti((prev) => {
      const aggiornato = { ...(prev[persona]?.[giorno] || {}) };
      delete aggiornato[slot];
      return { ...prev, [persona]: { ...prev[persona], [giorno]: aggiornato } };
    });
  };

  const nomeA = profiles?.a?.nome || "Lui";
  const nomeB = profiles?.b?.nome || "Lei";

  return (
    <div className="mt-12">
      <SubTitle kicker="la settimana" title="Piano pasti" />

      {/* Tab Lui / Lei */}
      <div className="nd-segment mb-6 w-fit">
        {[{ key: "a", label: nomeA, tone: "gold" }, { key: "b", label: nomeB, tone: "peach" }].map((p) => {
          const active = persona === p.key;
          return (
            <button key={p.key} type="button" onClick={() => setPersona(p.key)}
              className={`nd-segment-btn ${active ? "is-active" : ""}`}
              style={active ? {
                background: p.tone === "gold"
                  ? "linear-gradient(135deg,#E8B86A,#B0822E)"
                  : "linear-gradient(135deg,#FF9870,#E5683E)",
                boxShadow: "0 8px 18px -8px rgba(255,152,112,.45)"
              } : {}}>
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Griglia settimanale */}
      <div className="flex flex-col gap-3">
        {GIORNI.map((giorno) => (
          <div key={giorno} className="nd-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--line)]">
              <span className="nd-hand text-[20px] text-[var(--gold)]">{giorno}</span>
            </div>
            {PASTI_SLOT.map((slot, idx) => {
              const valore = piano[giorno]?.[slot];
              const isEditing = editing?.giorno === giorno && editing?.slot === slot;
              return (
                <div key={slot} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: idx ? "1px solid var(--line)" : "none" }}>
                  <span className="text-[11px] font-bold tracking-[0.18em] uppercase w-14 shrink-0"
                    style={{ color: slot === "pranzo" ? "var(--gold)" : "var(--peach)" }}>
                    {slot === "pranzo" ? "☀️ Pranzo" : "🌙 Cena"}
                  </span>
                  {isEditing ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") salva(); if (e.key === "Escape") setEditing(null); }}
                        placeholder={`Es. Pasta al pomodoro`}
                        className="nd-input flex-1 !min-h-[36px] !py-1.5 text-[14px]"
                      />
                      <button type="button" onClick={salva}
                        className="nd-icon-btn text-[var(--sage)]"><Check size={16} /></button>
                      <button type="button" onClick={() => setEditing(null)}
                        className="nd-icon-btn"><X size={15} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {valore ? (
                        <>
                          <span className="text-[14px] text-[var(--ink)] flex-1 truncate">{valore}</span>
                          <IconButton label="Modifica" onClick={() => apriEdit(giorno, slot)}>
                            <PenLine size={14} />
                          </IconButton>
                          <IconButton label="Cancella" onClick={() => cancella(giorno, slot)}>
                            <Trash2 size={14} />
                          </IconButton>
                        </>
                      ) : (
                        <button type="button" onClick={() => apriEdit(giorno, slot)}
                          className="text-[13px] text-[var(--ink3)] hover:text-[var(--peach)] flex items-center gap-1.5 transition-colors">
                          <Plus size={13} /> Aggiungi
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pasti({ pasti, setPasti, spesa, setSpesa, pianoPasti, setPianoPasti, profiles }) {
  const [piatto, setPiatto] = useState("");
  const [porzioni, setPorzioni] = useState(2);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState("");
  const [anteprima, setAnteprima] = useState(null);

  const genera = async () => {
    if (!piatto.trim()) return;
    setLoading(true); setErrore(""); setAnteprima(null);
    try { setAnteprima(await generaIngredienti(piatto.trim(), porzioni)); }
    catch (e) { setErrore(`Errore: ${e.message}`); }
    finally { setLoading(false); }
  };
  const conferma = () => {
    if (!anteprima) return;
    const nuovi = anteprima.ingredienti.map((ing) => ({
      id: uid(), nome: ing.nome, quantita: ing.quantita,
      categoria: CAT_ORDER.includes(ing.categoria) ? ing.categoria : "Altro",
      da: anteprima.piatto, preso: false,
    }));
    setSpesa((a) => [...a, ...nuovi]);
    setPasti((a) => [{ id: uid(), nome: anteprima.piatto, porzioni: anteprima.porzioni, n: nuovi.length }, ...a]);
    setAnteprima(null); setPiatto("");
  };
  const toggle = (id) => setSpesa((a) => a.map((x) => x.id === id ? { ...x, preso: !x.preso } : x));
  const rimuovi = (id) => setSpesa((a) => a.filter((x) => x.id !== id));
  const svuotaPresi = () => setSpesa((a) => a.filter((x) => !x.preso));
  const perCat = {}; spesa.forEach((i) => { (perCat[i.categoria] = perCat[i.categoria] || []).push(i); });
  const presi = spesa.filter((i) => i.preso).length;
  const progress = spesa.length === 0 ? 0 : Math.round((presi / spesa.length) * 100);

  return (
    <div>
      <div className="nd-card glow hover-lift p-5 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[var(--gold)]" />
          <span className="nd-serif italic font-semibold text-[18px]">Scrivi un piatto, alla spesa penso io</span>
        </div>
        <p className="nd-hand text-[19px] text-[var(--ink3)] mb-3">es. "risotto alle verdure" → riso, zucchine, pomodori…</p>
        <Input value={piatto} onChange={(e) => setPiatto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && genera()}
          placeholder="Risotto alle verdure, Lasagne, Carbonara…" className="mb-3" />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[13.5px]">
            <span className="text-[var(--ink3)]">Per</span>
            <NDSelect value={porzioni} onChange={(e) => setPorzioni(Number(e.target.value))}
              className="!min-h-[40px] !py-1.5 !w-auto">
              {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n} persone</option>)}
            </NDSelect>
          </div>
          <Button variant="gold" onClick={genera} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Penso…" : "Genera ingredienti"}
          </Button>
        </div>
        {errore && <p className="text-[var(--rose)] text-[13px] mt-3">{errore}</p>}
      </div>

      {anteprima && (
        <div className="nd-card nd-pop p-5 mb-7">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="nd-serif italic font-semibold text-[22px]">
              {anteprima.piatto} <span className="text-[var(--ink3)] text-[13px] font-normal not-italic">· {anteprima.porzioni} porz.</span>
            </h3>
            <IconButton label="Chiudi anteprima" onClick={() => setAnteprima(null)}>
              <X size={18} />
            </IconButton>
          </div>
          <ul className="flex flex-col gap-1.5 mb-4">
            {anteprima.ingredienti.map((ing, i) => (
              <li key={i} className="flex items-center justify-between text-[14px] py-2"
                style={{ borderBottom: "1px dashed var(--line)" }}>
                <span>{CAT_EMOJI[ing.categoria] || "🛒"} {ing.nome}</span>
                <span className="text-[var(--ink3)]">{ing.quantita}</span>
              </li>
            ))}
          </ul>
          <Button onClick={conferma} className="w-full">
            <ShoppingCart size={16} /> Aggiungi tutto alla spesa
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between mb-3 gap-3">
        <h4 className="nd-serif italic font-semibold text-[22px] flex items-center gap-2">
          <ShoppingCart size={18} className="text-[var(--peach)]" /> Lista della spesa
        </h4>
        {presi > 0 && (
          <button type="button" onClick={svuotaPresi} className="text-xs font-bold text-[var(--ink3)] hover:text-[var(--peach)]">
            Rimuovi presi ({presi})
          </button>
        )}
      </div>

      {spesa.length > 0 && (
        <div className="mb-4">
          <div className="nd-progress"><span style={{ width: `${progress}%` }} /></div>
          <p className="text-[10.5px] font-bold tracking-[0.22em] uppercase text-[var(--ink3)] mt-2">{presi} / {spesa.length} · {progress}%</p>
        </div>
      )}

      {spesa.length === 0 ? <Empty text="La lista è vuota. Genera un piatto qui sopra 👆" /> : (
        <div className="flex flex-col gap-5">
          {CAT_ORDER.filter((c) => perCat[c]).map((cat) => (
            <div key={cat}>
              <p className="nd-cat-pill mb-2">{CAT_EMOJI[cat]} {cat}</p>
              <div className="nd-card overflow-hidden">
                {perCat[cat].map((i, idx) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderTop: idx ? "1px solid var(--line)" : "none" }}>
                    <button type="button" onClick={() => toggle(i.id)} className={`nd-check ${i.preso ? "is-on" : ""}`} aria-label="Spunta">
                      {i.preso && <Check size={13} color="#1a1110" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px]"
                        style={{ textDecoration: i.preso ? "line-through" : "none", color: i.preso ? "var(--ink3)" : "var(--ink)" }}>
                        {i.nome} <span className="text-[var(--ink3)]">· {i.quantita}</span>
                      </div>
                      {i.da && <div className="text-[11.5px] text-[var(--ink3)] mt-0.5">per {i.da}</div>}
                    </div>
                    <IconButton label="Rimuovi" onClick={() => rimuovi(i.id)}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {pasti.length > 0 && (
        <div className="mt-10">
          <h4 className="nd-serif italic font-semibold text-[18px] mb-3">Piatti pianificati</h4>
          <div className="flex flex-col gap-2">
            {pasti.map((p) => (
              <div key={p.id} className="nd-card flex items-center justify-between px-4 py-2.5 text-[14px]">
                <span>🍽️ {p.nome} <span className="text-[var(--ink3)]">· {p.porzioni} porz · {p.n} ingr.</span></span>
                <IconButton label="Rimuovi" onClick={() => setPasti((a) => a.filter((x) => x.id !== p.id))}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ))}
          </div>
        </div>
      )}

      <PianoSettimanale pianoPasti={pianoPasti} setPianoPasti={setPianoPasti} profiles={profiles} />
    </div>
  );
}

/* ============================================================ PROGETTI */
function Progetti({ progetti, setProgetti, autori }) {
  const [form, setForm] = useState({ titolo: "", scadenza: "", emoji: "✨", autore: "noi" });
  const [openId, setOpenId] = useState(null);

  const aggiungi = () => {
    if (!form.titolo.trim()) return;
    const nuovo = {
      id: uid(), titolo: form.titolo.trim(), scadenza: form.scadenza || "",
      emoji: form.emoji || "✨", autore: form.autore, creato: new Date().toISOString(), tasks: [],
    };
    setProgetti((a) => [nuovo, ...a]);
    setForm({ titolo: "", scadenza: "", emoji: "✨", autore: "noi" });
    setOpenId(nuovo.id);
  };
  const rimuovi = (id) => setProgetti((a) => a.filter((p) => p.id !== id));
  const setTasks = (id, fn) => setProgetti((a) => a.map((p) => p.id === id ? { ...p, tasks: fn(p.tasks) } : p));

  // ordina: prima quelli incompleti, poi per scadenza più vicina
  const ord = useMemo(() => {
    const dist = (p) => p.scadenza ? new Date(p.scadenza).getTime() : Infinity;
    return [...progetti].sort((a, b) => {
      const aDone = a.tasks.length > 0 && a.tasks.every((t) => t.fatto);
      const bDone = b.tasks.length > 0 && b.tasks.every((t) => t.fatto);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return dist(a) - dist(b);
    });
  }, [progetti]);

  return (
    <div>
      <div className="nd-card p-4 mb-7">
        <div className="flex gap-2 mb-2">
          <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            placeholder="✨" maxLength={2}
            className="!w-[68px] text-center !text-[22px]" />
          <Input value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })}
            placeholder="Es. Viaggio in Giappone, Trasloco, Anniversario…"
            onKeyDown={(e) => e.key === "Enter" && aggiungi()} />
        </div>
        <div className="grid gap-2 grid-cols-1 min-[480px]:grid-cols-[1fr_auto] mb-3">
          <label className="flex items-center gap-2 nd-input cursor-text">
            <CalendarClock size={15} className="text-[var(--gold)] shrink-0" />
            <span className="text-[13px] text-[var(--ink3)] shrink-0">Scadenza</span>
            <input type="date" value={form.scadenza} onChange={(e) => setForm({ ...form, scadenza: e.target.value })}
              className="bg-transparent outline-none flex-1 text-[14px]" style={{ colorScheme: "dark" }} />
          </label>
          <AutoreSelect value={form.autore} onChange={(v) => setForm({ ...form, autore: v })} autori={autori} />
        </div>
        <Button onClick={aggiungi} className="w-full"><Plus size={16} /> Crea progetto</Button>
      </div>

      {ord.length === 0 ? (
        <Empty text="Ancora nessun progetto. Iniziate un viaggio, una serie da finire, una ristrutturazione…" />
      ) : (
        <div className="flex flex-col gap-3">
          {ord.map((p, i) => (
            <ProgettoCard key={p.id} p={p}
              open={openId === p.id}
              onToggleOpen={() => setOpenId((cur) => cur === p.id ? null : p.id)}
              onRemove={() => rimuovi(p.id)}
              onTasks={(fn) => setTasks(p.id, fn)}
              autori={autori}
              i={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function deadlineInfo(iso) {
  if (!iso) return null;
  const target = new Date(iso); target.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  let label, tone;
  if (diff === 0) { label = "oggi"; tone = "peach"; }
  else if (diff === 1) { label = "domani"; tone = "peach"; }
  else if (diff > 1 && diff <= 7) { label = `tra ${diff} giorni`; tone = "gold"; }
  else if (diff > 7) { label = `tra ${diff} giorni`; tone = "muted"; }
  else if (diff === -1) { label = "ieri"; tone = "danger"; }
  else { label = `${Math.abs(diff)} giorni fa`; tone = "danger"; }
  return { label, tone, diff, target };
}

function ProgettoCard({ p, open, onToggleOpen, onRemove, onTasks, autori, i }) {
  const [nuovoTask, setNuovoTask] = useState("");
  const total = p.tasks.length;
  const done = p.tasks.filter((t) => t.fatto).length;
  const completed = total > 0 && done === total;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const dl = deadlineInfo(p.scadenza);

  const aggiungiTask = () => {
    if (!nuovoTask.trim()) return;
    onTasks((a) => [...a, { id: uid(), testo: nuovoTask.trim(), fatto: false }]);
    setNuovoTask("");
  };
  const toggleTask = (id) => onTasks((a) => a.map((t) => t.id === id ? { ...t, fatto: !t.fatto } : t));
  const rimuoviTask = (id) => onTasks((a) => a.filter((t) => t.id !== id));

  return (
    <article className={`nd-card hover-lift nd-up ${open ? "glow" : ""}`} style={{ animationDelay: `${Math.min(i, 6) * 0.05}s` }}>
      <button type="button" onClick={onToggleOpen}
        className="w-full text-left p-4 flex items-center gap-3 min-h-[64px]"
        aria-expanded={open}>
        <div className="grid place-items-center rounded-2xl shrink-0"
          style={{
            width: 50, height: 50, fontSize: 24,
            background: completed ? "linear-gradient(135deg, rgba(157,179,137,.22), rgba(111,139,92,.18))"
              : "linear-gradient(135deg, rgba(255,152,112,.18), rgba(229,104,62,.12))",
            border: `1px solid ${completed ? "rgba(157,179,137,.3)" : "var(--line2)"}`,
          }}>
          {p.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="nd-serif italic font-semibold text-[19px] leading-tight tracking-[-0.01em]"
              style={{ textDecoration: completed ? "line-through" : "none", color: completed ? "var(--ink3)" : "var(--ink)" }}>
              {p.titolo}
            </h3>
            {completed && <span className="nd-chip sage">fatto</span>}
            {dl && !completed && <span className={`nd-chip ${dl.tone}`}>{dl.label}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="nd-progress flex-1 max-w-[180px]"><span style={{ width: `${progress}%` }} /></div>
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-[var(--ink3)]">{done}/{total}</span>
          </div>
        </div>

        <ChevronDown size={18} className="shrink-0 text-[var(--ink3)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      <div className={`nd-cascade ${open ? "is-open" : ""}`}>
        <div>
          <div className="px-4 pb-4 pt-1 border-t border-[var(--line)]">
            {dl && (
              <div className="flex items-center gap-2 mt-3 mb-3 text-[13px] text-[var(--ink3)]">
                <CalendarClock size={14} className="text-[var(--gold)]" />
                <span>scadenza il <b className="text-[var(--ink2)] not-italic">{formatDateIT(p.scadenza)}</b></span>
              </div>
            )}

            <div className="flex flex-col gap-2 mt-3">
              {p.tasks.length === 0 && <p className="text-[13px] text-[var(--ink3)] italic">Nessun compito ancora. Aggiungine uno qui sotto 👇</p>}
              {p.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(20,15,13,.45)", border: "1px solid var(--line)" }}>
                  <button type="button" onClick={() => toggleTask(t.id)}
                    className={`nd-check ${t.fatto ? "is-on" : ""}`} aria-label="Spunta">
                    {t.fatto && <Check size={13} color="#1a1110" strokeWidth={3} />}
                  </button>
                  <span className="flex-1 text-[14px]"
                    style={{ textDecoration: t.fatto ? "line-through" : "none", color: t.fatto ? "var(--ink3)" : "var(--ink)" }}>
                    {t.testo}
                  </span>
                  <IconButton label="Rimuovi" onClick={() => rimuoviTask(t.id)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-3">
              <Input value={nuovoTask} onChange={(e) => setNuovoTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && aggiungiTask()}
                placeholder="Aggiungi un compito…" />
              <Button onClick={aggiungiTask}><Plus size={16} /></Button>
            </div>

            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[var(--line)]">
              <div className="flex items-center gap-2">
                <AutoreChip autore={p.autore} autori={autori} />
                <span className="text-[11.5px] text-[var(--ink3)]">creato il {formatDateIT(p.creato)}</span>
              </div>
              <button type="button" onClick={onRemove}
                className="text-[12px] font-bold text-[var(--ink3)] hover:text-[var(--rose)] inline-flex items-center gap-1">
                <Trash2 size={13} /> Elimina progetto
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
