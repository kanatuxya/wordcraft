import React, { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// ПОЛНЫЙ ПОТОК: ввод текста → генерация карточек → изучение
// "Мозг" = подход Б (LLM на бэкенде).
//
// generateDeck() ниже сначала пробует твой бэкенд /api/generate-cards.
// Если бэкенда нет (превью/демо) — падает на mockDeck(), чтобы поток
// был виден. На проде просто удали блок с mock.
// ─────────────────────────────────────────────────────────────

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=Newsreader:ital@0;1&display=swap";

async function generateDeck(text, level) {
  try {
    const res = await fetch("https://wordcraft-server-production.up.railway.app/api/generate-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, level }),
    });
    if (!res.ok) throw new Error("backend not available");
    const data = await res.json();
    // сервер отдаёт { level, cards }; нормализуем на случай старого формата
    if (Array.isArray(data)) return { level: "—", cards: data };
    return { level: data.level ?? "—", cards: data.cards ?? [] };
  } catch {
    // ── ЗАГЛУШКА на время разработки фронта ──
    await new Promise((r) => setTimeout(r, 900));
    return mockDeck(text);
  }
}

function mockDeck(text) {
  // грубо вытаскиваем уникальные длинные слова — только для демо
  const words = Array.from(
    new Set(
      (text.toLowerCase().match(/[a-z]{5,}/g) || []).filter(
        (w) => !STOP.has(w)
      )
    )
  ).slice(0, 8);
  const fallback = ["resilient", "thorough", "endeavor", "vivid", "linger"];
  const cards = (words.length ? words : fallback).map((w, i) => ({
    word: w,
    ipa: "/…/",
    pos: "—",
    ru: "перевод (демо)",
    kk: "аударма (демо)",
    examples: [
      `This is an example with "${w}".`,
      `Here "${w}" is used in another way.`,
      `A third sentence containing "${w}".`,
    ],
    id: i,
  }));
  return { level: "демо", cards };
}

const STOP = new Set(
  "about there their would which these those think where being could should always".split(
    " "
  )
);

export default function App() {
  const [screen, setScreen] = useState("input"); // input | loading | cards
  const [deck, setDeck] = useState([]);
  const [level, setLevel] = useState("—");

  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONTS_HREF;
    document.head.appendChild(l);
  }, []);

  const handleGenerate = async (text, chosenLevel) => {
    setScreen("loading");
    const { level: detected, cards } = await generateDeck(text, chosenLevel);
    // если пользователь выбрал уровень вручную — показываем его выбор,
    // иначе показываем определённый моделью
    setLevel(chosenLevel === "auto" ? detected : chosenLevel);
    setDeck(cards.map((c, i) => ({ ...c, id: i })));
    setScreen("cards");
  };

  return (
    <div style={shell}>
      {screen === "input" && <InputScreen onGenerate={handleGenerate} />}
      {screen === "loading" && <LoadingScreen />}
      {screen === "cards" && (
        <Cards deck={deck} level={level} onBack={() => setScreen("input")} />
      )}
    </div>
  );
}

// ── ЭКРАН ВВОДА ТЕКСТА ──────────────────────────────────────

function InputScreen({ onGenerate }) {
  const [text, setText] = useState("");
  const [level, setLevel] = useState("auto");

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  };

  const wordCount = (text.match(/\S+/g) || []).length;

  return (
    <div style={{ width: "100%", maxWidth: 620, margin: "0 auto" }}>
      <h1 style={h1}>Wordcraft</h1>
      <p style={{ color: "#8a7a5e", fontSize: 17, marginTop: -8 }}>
        Вставьте текст или список слов на английском — мы соберём из них
        флэшкарты с переводом и озвучкой.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Вставьте сюда текст или слова (по одному в строке)…"
        style={textarea}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 10,
        }}
      >
        <label style={fileLabel}>
          📄 Загрузить .txt
          <input type="file" accept=".txt" onChange={onFile} hidden />
        </label>
        <span style={{ fontSize: 13, color: "#9a8a6c" }}>
          {wordCount} слов
        </span>
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 13, color: "#8a7a5e", marginBottom: 8, letterSpacing: "0.04em" }}>
          УРОВЕНЬ
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["auto", "A1", "A2", "B1", "B2", "C1"].map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              style={{
                ...levelChip,
                ...(level === lv ? levelChipActive : {}),
              }}
            >
              {lv === "auto" ? "Определить авто" : lv}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={wordCount < 1}
        onClick={() => onGenerate(text, level)}
        style={{ ...bigBtn, opacity: wordCount < 1 ? 0.4 : 1 }}
      >
        Создать карточки →
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ textAlign: "center", marginTop: "22vh" }}>
      <div style={spinner} />
      <p style={{ color: "#8a7a5e", fontSize: 17, marginTop: 20 }}>
        Анализируем текст и подбираем слова…
      </p>
    </div>
  );
}

// ── КАРТОЧКИ (логика из прошлого прототипа) ─────────────────

function Cards({ deck, level, onBack }) {
  const [queue, setQueue] = useState(deck);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [done, setDone] = useState(false);

  const total = deck.length;
  const card = queue[pos];

  const speak = useCallback((t) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "en-US";
    u.rate = 0.9;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }, []);

  const advance = useCallback(
    (known) => {
      setFlipped(false);
      if (known) setKnownCount((c) => c + 1);
      setTimeout(() => {
        setQueue((q) => {
          const cur = q[pos];
          if (!known) {
            const n = [...q];
            n.splice(pos, 1);
            n.splice(Math.min(pos + 3, n.length), 0, cur);
            return n;
          }
          return q;
        });
        setPos((p) => {
          const np = known ? p + 1 : p;
          if (np >= queue.length) setDone(true);
          return np;
        });
      }, 180);
    },
    [pos, queue.length]
  );

  const progress = total ? Math.round((knownCount / total) * 100) : 0;

  if (done)
    return (
      <div style={{ textAlign: "center", marginTop: "16vh", maxWidth: 420, margin: "16vh auto 0" }}>
        <div style={{ fontSize: 56 }}>🎉</div>
        <h2 style={{ ...h1, fontSize: 28 }}>Колода пройдена</h2>
        <p style={{ color: "#8a7a5e", fontSize: 17 }}>
          {total} карточек пройдено. На проде они вернутся к повтору по расписанию SRS.
        </p>
        <button onClick={onBack} style={{ ...actionBtn, ...knowBtn, marginTop: 16, maxWidth: 260 }}>
          Новый текст
        </button>
      </div>
    );

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} style={backBtn}>← назад</button>
        <span style={levelBadge}>Уровень: {level}</span>
        <span style={{ fontSize: 13, color: "#8a7a5e", fontVariantNumeric: "tabular-nums" }}>
          {Math.min(knownCount + 1, total)} / {total}
        </span>
      </div>
      <div style={{ height: 6, background: "#e2d3b3", borderRadius: 99, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#c2410c,#ea580c)", transition: "width .4s ease" }} />
      </div>

      <div style={{ perspective: 1600, cursor: "pointer" }} onClick={() => setFlipped((f) => !f)}>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 4",
            maxHeight: "58vh",
            transformStyle: "preserve-3d",
            transition: "transform .55s cubic-bezier(.2,.8,.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <CardFace front>
            <span style={tag}>{card.pos}</span>
            <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <div style={wordStyle}>{card.word}</div>
                <div style={{ marginTop: 12, fontSize: 18, color: "#9a8a6c", fontStyle: "italic" }}>{card.ipa}</div>
                <button onClick={(e) => { e.stopPropagation(); speak(card.word); }} style={speakBtnFront}>
                  <Speaker /> Произношение
                </button>
              </div>
            </div>
            <div style={hint}>нажмите, чтобы перевернуть</div>
          </CardFace>

          <CardFace>
            <span style={tag}>перевод</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
              <Trans lang="RU" text={card.ru} />
              <div style={{ height: 1, background: "#e7d8b8" }} />
              <Trans lang="KK" text={card.kk} />
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
                {card.examples.map((ex, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 13, color: "#e8975a", flexShrink: 0 }}>{i + 1}</span>
                    <p style={{ margin: 0, fontStyle: "italic", color: "#d8c9a8", fontSize: "clamp(14px,3.4vw,16px)", lineHeight: 1.45 }}>{ex}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={hint}>нажмите, чтобы перевернуть</div>
          </CardFace>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button onClick={() => advance(false)} style={{ ...actionBtn, ...repeatBtn }}>↻ Повторить</button>
        <button onClick={() => advance(true)} style={{ ...actionBtn, ...knowBtn }}>✓ Знаю</button>
      </div>
    </div>
  );
}

// ── мелкие компоненты ───────────────────────────────────────
function CardFace({ children, front }) {
  return (
    <div style={{
      position: "absolute", inset: 0, backfaceVisibility: "hidden",
      transform: front ? "rotateY(0deg)" : "rotateY(180deg)",
      background: front ? "linear-gradient(160deg,#fffdf8,#fbf3e2)" : "linear-gradient(160deg,#2a2118,#3a2e1f)",
      color: front ? "#2a2118" : "#f3ead7", borderRadius: 24, padding: "clamp(20px,5vw,32px)",
      boxSizing: "border-box", display: "flex", flexDirection: "column",
      boxShadow: "0 1px 0 rgba(255,255,255,.6) inset, 0 20px 40px -16px rgba(60,40,15,.4)",
      border: front ? "1px solid #efe2c6" : "1px solid #4a3c28",
    }}>{children}</div>
  );
}
function Trans({ lang, text }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
      <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 13, letterSpacing: ".1em", color: "#e8975a", minWidth: 28 }}>{lang}</span>
      <span style={{ fontSize: "clamp(20px,5vw,26px)", lineHeight: 1.25 }}>{text}</span>
    </div>
  );
}
function Speaker() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

// ── стили ───────────────────────────────────────────────────
const shell = {
  minHeight: "100vh",
  background: "radial-gradient(120% 120% at 50% 0%, #fbf6ec 0%, #f3ead7 45%, #ecdfc4 100%)",
  fontFamily: "'Newsreader', Georgia, serif", color: "#2a2118",
  padding: "clamp(20px,5vw,56px)", boxSizing: "border-box",
};
const h1 = { fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "clamp(28px,7vw,40px)", letterSpacing: "-.02em", margin: "0 0 8px" };
const textarea = {
  width: "100%", minHeight: 200, marginTop: 20, padding: 18, boxSizing: "border-box",
  borderRadius: 18, border: "1px solid #e0cda3", background: "#fffdf8",
  fontFamily: "'Newsreader',serif", fontSize: 16, lineHeight: 1.5, color: "#2a2118", resize: "vertical",
};
const fileLabel = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 99, border: "1px solid #e0cda3", background: "#fffdf8", cursor: "pointer", fontSize: 15, color: "#7a5a2a" };
const levelChip = { padding: "9px 16px", borderRadius: 99, border: "1px solid #e0cda3", background: "#fffdf8", cursor: "pointer", fontFamily: "'Newsreader',serif", fontSize: 15, color: "#7a5a2a" };
const levelChipActive = { background: "linear-gradient(180deg,#ea580c,#c2410c)", color: "#fff", border: "1px solid #c2410c" };
const bigBtn = { width: "100%", marginTop: 28, padding: 18, borderRadius: 16, border: "none", background: "linear-gradient(180deg,#ea580c,#c2410c)", color: "#fff", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 18, cursor: "pointer" };
const spinner = { width: 46, height: 46, margin: "0 auto", border: "4px solid #e2d3b3", borderTopColor: "#c2410c", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
const backBtn = { background: "none", border: "none", color: "#8a7a5e", fontFamily: "'Newsreader',serif", fontSize: 15, cursor: "pointer", padding: 0 };
const levelBadge = { fontSize: 12, fontWeight: 600, letterSpacing: ".04em", color: "#c2410c", background: "#f6e6cf", border: "1px solid #e8cfa6", borderRadius: 99, padding: "4px 12px", fontFamily: "'Fraunces',serif" };
const tag = { alignSelf: "flex-start", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontFamily: "'Fraunces',serif", fontWeight: 600, opacity: .6 };
const hint = { textAlign: "center", fontSize: 12, letterSpacing: ".08em", color: "#b6a684", textTransform: "uppercase" };
const wordStyle = { fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(40px,12vw,64px)", lineHeight: 1.05, letterSpacing: "-.02em" };
const speakBtnFront = { marginTop: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", border: "1px solid #e0cda3", borderRadius: 99, background: "#fffdf8", color: "#7a5a2a", fontFamily: "'Newsreader',serif", fontSize: 16, cursor: "pointer", boxShadow: "0 4px 12px -6px rgba(120,90,40,.4)" };
const actionBtn = { flex: 1, padding: 16, borderRadius: 16, border: "none", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17, cursor: "pointer" };
const repeatBtn = { background: "#f0e3c8", color: "#7a5a2a", border: "1px solid #e0cda3" };
const knowBtn = { background: "linear-gradient(180deg,#ea580c,#c2410c)", color: "#fff" };

// keyframes для спиннера
if (typeof document !== "undefined" && !document.getElementById("wc-kf")) {
  const s = document.createElement("style");
  s.id = "wc-kf";
  s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
  document.head.appendChild(s);
}