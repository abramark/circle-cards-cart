import { useState, useRef, useEffect } from "react";
import { saveRow, fetchRows, groupByDay } from "./sheetApi";

/* ============================================================
   circle.love — "Choose Any Card" cart app  (front-end prototype v2)
   Zones:
   - CUSTOMER: single-card flow, pack info        (ungated)
   - OPERATOR work: code entry, confirm, note, pack sale (ungated, tx-scoped)
   - REVIEW: today's transactions                 (PIN-gated: shows all data)
   Mock/local data. No Sheets, no Square, regex-only email validation.
   ============================================================ */

const C = {
  paper: "#FBF8F3", ink: "#363636", purple: "#5949A2", purpleDeep: "#4A3C8C",
  purpleSoft: "#EDE9F6", kraft: "#D9BC8F", kraftDeep: "#C2A26E", yellow: "#F2DF5A",
  faint: "#8A8496", line: "#E9E3D7", green: "#3E8E6E", danger: "#B23B3B",
};
const fD = "'Baloo 2','Quicksand',sans-serif";
const fB = "'Ubuntu','Trebuchet MS',sans-serif";
const fN = "'Courier Prime','Courier New',monospace";
const PIN = "1234";
const DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "icloud.com"];
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function Chevrons({ size = 18 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.18 }}>
      <span style={{ color: C.purple, fontSize: size }}>&#9829;</span>
      <span style={{ color: C.purple, opacity: 0.5, fontSize: size * 0.9 }}>&#10095;</span>
      <span style={{ color: C.purple, opacity: 0.28, fontSize: size * 0.9 }}>&#10095;</span>
    </span>
  );
}
function Btn({ children, onClick, variant = "solid", style = {}, disabled, ...rest }) {
  const base = { fontFamily: fD, fontWeight: 600, fontSize: 20, borderRadius: 16, padding: "17px 22px", width: "100%", cursor: disabled ? "default" : "pointer", border: "2px solid transparent", transition: "transform 110ms ease", opacity: disabled ? 0.45 : 1 };
  const v = {
    solid: { background: C.purple, color: "#fff" }, outline: { background: "#fff", color: C.ink, border: `2px solid ${C.line}` },
    ghost: { background: "transparent", color: C.faint, fontWeight: 500, fontSize: 16 }, yellow: { background: C.yellow, color: C.ink }, green: { background: C.green, color: "#fff" },
  };
  return <button onClick={disabled ? undefined : onClick} className="ca-btn" style={{ ...base, ...v[variant], ...style }} disabled={disabled} {...rest}>{children}</button>;
}
function Title({ children, size = 30 }) { return <h1 style={{ fontFamily: fD, fontWeight: 700, fontSize: size, lineHeight: 1.18, color: C.ink, textAlign: "center", margin: "0 0 14px" }}>{children}</h1>; }
function Sub({ children }) { return <p style={{ fontFamily: fB, fontSize: 16, lineHeight: 1.5, color: C.ink, opacity: 0.82, textAlign: "center", margin: "0 auto 26px", maxWidth: 420 }}>{children}</p>; }
function Eyebrow({ children }) { return <div style={{ fontFamily: fB, fontWeight: 700, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.faint, textAlign: "center", marginBottom: 10 }}>{children}</div>; }
function Screen({ children, k }) { return <div key={k} className="ca-screen" style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "0 22px" }}>{children}</div>; }
function Back({ onClick }) { return <button onClick={onClick} className="ca-btn" style={{ fontFamily: fB, fontSize: 15, color: C.faint, background: "transparent", border: "none", cursor: "pointer", padding: "10px 4px", marginTop: 6 }}>&#8592; Back</button>; }

function EmailField({ value, onChange, label = "Email" }) {
  const [focused, setFocused] = useState(false);
  const atIdx = value.indexOf("@");
  let suggestions = [];
  if (atIdx >= 0) {
    const local = value.slice(0, atIdx);
    const typedDomain = value.slice(atIdx + 1).toLowerCase();
    if (local.length > 0) {
      suggestions = DOMAINS.filter((d) => d.startsWith(typedDomain) && d !== typedDomain).map((d) => `${local}@${d}`);
    }
  }
  const show = focused && suggestions.length > 0;
  return (
    <label style={{ display: "block", marginBottom: 16, position: "relative" }}>
      <span style={{ fontFamily: fB, fontWeight: 500, fontSize: 14, color: C.faint, display: "block", marginBottom: 6 }}>{label}</span>
      <input type="email" inputMode="email" value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} placeholder="you@example.com"
        style={{ fontFamily: fB, fontSize: 20, color: C.ink, width: "100%", boxSizing: "border-box", border: `2px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", outline: "none", background: "#fff" }} />
      {show && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}>
          {suggestions.map((s) => {
            const at = s.indexOf("@");
            return (
              <button key={s} className="ca-btn" onMouseDown={(e) => { e.preventDefault(); onChange(s); setFocused(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`, padding: "12px 16px", cursor: "pointer", fontFamily: fB, fontSize: 17 }}>
                <span style={{ color: C.ink }}>{s.slice(0, at + 1)}</span><span style={{ color: C.purple, fontWeight: 600 }}>{s.slice(at + 1)}</span>
              </button>
            );
          })}
        </div>
      )}
    </label>
  );
}
function TextField({ label, ...rest }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ fontFamily: fB, fontWeight: 500, fontSize: 14, color: C.faint, display: "block", marginBottom: 6 }}>{label}</span>
      <input {...rest} style={{ fontFamily: fB, fontSize: 20, color: C.ink, width: "100%", boxSizing: "border-box", border: `2px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", outline: "none", background: "#fff" }} />
    </label>
  );
}
function FadePrompts() {
  const lines = [
    "give it when it takes a little courage",
    "let it be a little awkward and do it anyway",
    "give it before you overthink it",
    "give it for no reason except kindness",
    "give it before the moment passes",
  ];
  const [i, setI] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(() => {
    let fadeTimer;
    const cycle = setInterval(() => {
      setVis(false);
      fadeTimer = setTimeout(() => { setI((p) => (p + 1) % lines.length); setVis(true); }, 600);
    }, 3600);
    return () => { clearInterval(cycle); clearTimeout(fadeTimer); };
  }, []);
  return (
    <div style={{ marginTop: 100, minHeight: 96, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
      <span style={{ fontFamily: fB, fontStyle: "italic", fontSize: 30, lineHeight: 1.3, color: C.faint, textAlign: "center", maxWidth: 440, opacity: vis ? 1 : 0, transition: "opacity 600ms ease" }}>
        {lines[i]}
      </span>
    </div>
  );
}

function PackButton({ onTap, onLongPress }) {
  const hold = useRef(null);
  const longFired = useRef(false);
  const start = () => { longFired.current = false; hold.current = setTimeout(() => { longFired.current = true; onLongPress(); }, 750); };
  const end = () => { if (hold.current) clearTimeout(hold.current); };
  return (
    <button className="ca-btn"
      onMouseDown={start} onMouseUp={end} onMouseLeave={end}
      onTouchStart={start} onTouchEnd={end}
      onClick={() => { if (!longFired.current) onTap(); }}
      style={{ fontFamily: fD, fontWeight: 600, fontSize: 20, borderRadius: 16, padding: "17px 22px", width: "100%", cursor: "pointer", background: "#fff", color: C.ink, border: `2px solid ${C.line}` }}>
      A pack of 10 &mdash; $12
      <div style={{ fontWeight: 500, fontSize: 14, color: C.faint, marginTop: 3, fontFamily: fB }}>or save 25% on 3 or more</div>
    </button>
  );
}

function Header({ onSecret }) {
  const start = () => { hold.current = setTimeout(onSecret, 750); };
  const cancel = () => hold.current && clearTimeout(hold.current);
  return (
    <header onMouseDown={start} onMouseUp={cancel} onMouseLeave={cancel} onTouchStart={start} onTouchEnd={cancel}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "18px 0 4px", userSelect: "none" }} title="(long-press for operator review)">
      <Chevrons size={17} />
      <span style={{ fontFamily: fD, fontWeight: 700, fontSize: 19, color: C.ink }}>circle<span style={{ color: C.purple }}>.love</span></span>
    </header>
  );
}

const fmtCode = (v) => { const d = v.replace(/[^0-9]/g, "").slice(0, 12); return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim(); };
const codeDigits = (v) => v.replace(/[^0-9]/g, "");
const fmtId = (v) => { const d = v.replace(/[^0-9]/g, "").slice(0, 11); return d.length <= 3 ? d : d.slice(0, 3) + "-" + d.slice(3); };
const idDigits = (v) => v.replace(/[^0-9]/g, "");

export default function CartApp() {
  const [screen, setScreen] = useState("custHome");
  const blankTx = { source: "single", amount: null, paymentType: null, name: "", email: "", code: "", note: "", houseAccount: false };
  const [tx, setTx] = useState(blankTx);
  const [custom, setCustom] = useState("");
  const [overrideHeld, setOverrideHeld] = useState(false);
  const [opReveal, setOpReveal] = useState(false);
  const holdRef = useRef(null);
  const hbHoldRef = useRef(null);
  const blankPack = { source: "pack", name: "", email: "", paymentType: null, amount: "", note: "" };
  const [pack, setPack] = useState(blankPack);
  const [packIds, setPackIds] = useState([]);
  const [idField, setIdField] = useState("");
  const [dupFlash, setDupFlash] = useState(false);
  const [rows, setRows] = useState(seed);
  const [lastId, setLastId] = useState(null);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinTarget, setPinTarget] = useState("review");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "ok" | "fail"
  const [reviewData, setReviewData] = useState(null); // null=not loaded, []=loaded
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  async function loadReview() {
    setReviewLoading(true); setReviewError(null);
    const res = await fetchRows();
    setReviewLoading(false);
    if (res.ok) setReviewData(groupByDay(res.rows));
    else setReviewError(res.error || "couldn't load");
  }

  // push a row to the sheet; show loud failure if it doesn't save
  async function pushToSheet(sheetRow) {
    setSaveStatus("saving");
    const res = await saveRow(sheetRow);
    setSaveStatus(res.ok ? "ok" : "fail");
    if (res.ok) setTimeout(() => setSaveStatus(null), 1800);
    return res;
  }

  const resetSingle = () => { setTx(blankTx); setCustom(""); setOverrideHeld(false); setOpReveal(false); };
  const resetPack = () => { setPack(blankPack); setPackIds([]); setIdField(""); };

  function commitSingle(extra = {}) {
    const merged = { ...tx, ...extra };
    const id = rid();
    setRows((r) => [{ ...merged, ts: now(), id }, ...r]);
    setLastId(id);
    pushToSheet({
      source: "single",
      name: merged.houseAccount ? "" : merged.name,
      email: merged.houseAccount ? "" : merged.email,
      payment_type: merged.paymentType,
      amount: merged.amount,
      card_ids: merged.code ? merged.code.replace(/\s/g, "") : "",
      note: merged.note,
      house_account: merged.houseAccount,
    });
  }
  function commitPack() {
    const ids = [...packIds];
    const trailing = idField.trim();
    if (idDigits(trailing).length >= 4 && !ids.includes(fmtId(trailing))) ids.push(fmtId(trailing));
    const id = rid();
    const amt = pack.amount === "" ? 0 : Number(pack.amount);
    setRows((r) => [{ ...pack, source: "pack", packIds: ids.join(", "), amount: amt, ts: now(), id }, ...r]);
    setLastId(id);
    pushToSheet({
      source: "pack",
      name: pack.name,
      email: pack.email,
      payment_type: pack.paymentType,
      amount: amt,
      card_ids: ids.join(", "),
      note: pack.note,
      house_account: false,
    });
  }
  function addPackId() {
    const f = fmtId(idField);
    if (idDigits(f).length < 4) return;
    if (packIds.includes(f)) { setDupFlash(true); setTimeout(() => setDupFlash(false), 1200); return; }
    setPackIds((p) => [...p, f]); setIdField("");
  }

  const emailValid = EMAIL_RE.test(tx.email.trim());
  const nameValid = tx.name.trim().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex", flexDirection: "column", fontFamily: fB }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Ubuntu:wght@400;500;700&family=Courier+Prime:wght@400;700&display=swap');
        .ca-btn:active{transform:scale(0.98);} .ca-btn:focus-visible{outline:3px solid ${C.purpleDeep};outline-offset:2px;}
        .ca-screen{animation:caR 280ms ease both;} @keyframes caR{from{opacity:0;transform:translateY(9px);}to{opacity:1;transform:none;}}
        @media (prefers-reduced-motion:reduce){.ca-screen{animation:none;}}
        input::placeholder{color:${C.faint};opacity:0.7;}
      `}</style>

      <Header onSecret={() => { setPinTarget("review"); setPinEntry(""); setPinError(false); setScreen("pinGate"); }} />

      {saveStatus === "fail" && (
        <div style={{ background: C.danger, color: "#fff", fontFamily: fB, fontSize: 14, textAlign: "center", padding: "10px 16px" }}>
          ⚠ Didn't save to the sheet — write this sale on paper.
        </div>
      )}
      {saveStatus === "saving" && (
        <div style={{ background: C.purpleSoft, color: C.purpleDeep, fontFamily: fB, fontSize: 13, textAlign: "center", padding: "6px 16px" }}>
          saving…
        </div>
      )}
      {saveStatus === "ok" && (
        <div style={{ background: "#E6F4EC", color: C.green, fontFamily: fB, fontSize: 13, textAlign: "center", padding: "6px 16px" }}>
          ✓ saved
        </div>
      )}

      <main style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 0 36px" }}>

        {screen === "custHome" && (
          <Screen k="h">
            <div style={{ paddingTop: 44 }}>
              <Eyebrow>Pearl Street &middot; Boulder</Eyebrow>
              <Title size={34}>What are you taking home?</Title>
              <Sub>Every card is made to pass on. Some go around the corner. Some go around the world.</Sub>
              <div style={{ height: 24 }} />
              <div style={{ display: "grid", gap: 14 }}>
                <Btn onClick={() => { resetSingle(); setScreen("amount"); }}>
                  A single card
                  <div style={{ fontWeight: 500, fontSize: 15, opacity: 0.9, marginTop: 3, fontFamily: fB }}>give what feels right</div>
                </Btn>
                <PackButton
                  onTap={() => setScreen("packInfo")}
                  onLongPress={() => { resetPack(); setScreen("packEntry"); }}
                />
              </div>
              <p style={{ textAlign: "center", fontFamily: fN, fontSize: 14, color: C.faint, margin: "26px 0 0" }}>circle.love is always free to use</p>
              <div style={{ textAlign: "center", marginTop: 120, display: "flex", flexDirection: "column", gap: 12 }}>
                <button onClick={() => { setPinTarget("packEntry"); setPinEntry(""); setPinError(false); setScreen("pinGate"); }} style={opLink()}>Operator: log a pack sale</button>
                {lastId && <button onClick={() => setScreen("lastNote")} style={opLink()}>Add note to last sale</button>}
              </div>
            </div>
          </Screen>
        )}

        {screen === "amount" && (
          <Screen k="amt">
            <div style={{ paddingTop: 32 }}>
              <Eyebrow>A single card</Eyebrow>
              <Title>This card is yours.</Title>
              <Sub>circle.love is kept alive by people who give what feels right. Whatever you choose &mdash; <strong style={{ color: C.ink }}>including nothing today</strong> &mdash; this card is going with you.</Sub>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                {[3, 5, 10].map((v) => (
                  <Btn key={v} variant="outline" style={{ fontSize: 26, padding: "18px 0", borderColor: tx.amount === v && !custom ? C.purple : C.line, background: tx.amount === v && !custom ? C.purpleSoft : "#fff" }}
                    onClick={() => { setCustom(""); setTx((t) => ({ ...t, amount: v, paymentType: null })); }}>${v}</Btn>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `2px solid ${custom ? C.purple : C.line}`, borderRadius: 14, padding: "4px 16px", marginBottom: 18 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: custom ? C.ink : C.faint, marginRight: 6, fontFamily: fD }}>$</span>
                <input inputMode="decimal" value={custom} onChange={(e) => { setCustom(e.target.value.replace(/[^0-9.]/g, "")); setTx((t) => ({ ...t, amount: null, paymentType: null })); }} placeholder="a different amount"
                  style={{ fontFamily: fD, fontSize: 22, fontWeight: 600, color: C.ink, border: "none", outline: "none", width: "100%", background: "transparent", padding: "12px 0" }} />
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <Btn variant="yellow" style={{ fontSize: 24, border: `2px solid ${tx.paymentType === "pledge" ? C.kraftDeep : "transparent"}` }}
                  onClick={() => { setCustom(""); setTx((t) => ({ ...t, amount: 0, paymentType: "pledge" })); }}>
                  Nothing today
                  <div style={{ fontWeight: 500, fontSize: 14, marginTop: 2, fontFamily: fB }}>just a promise to pass it on</div>
                </Btn>
              </div>
              <div style={{ height: 40 }} />
              {(() => {
                const canContinue = tx.paymentType === "pledge" || tx.amount > 0 || (custom && parseFloat(custom) > 0);
                return (
                  <Btn style={{ fontSize: 24 }} disabled={!canContinue}
                    onClick={() => {
                      if (tx.paymentType === "pledge") { setScreen("nameEmail"); return; }
                      const v = custom ? parseFloat(custom) : tx.amount;
                      if (v > 0) { setTx((t) => ({ ...t, amount: v })); setScreen("nameEmail"); }
                    }}>
                    Continue{(() => { const v = custom ? parseFloat(custom) : tx.amount; return tx.paymentType !== "pledge" && v > 0 ? ` \u2014 $${custom || tx.amount}` : ""; })()}
                    {canContinue && <div style={{ fontWeight: 500, fontSize: 14, marginTop: 2, fontFamily: fB, opacity: 0.9 }}>almost done :)</div>}
                  </Btn>
                );
              })()}
              <Back onClick={() => { resetSingle(); setScreen("custHome"); }} />
            </div>
          </Screen>
        )}

        {screen === "nameEmail" && (
          <Screen k="ne">
            <div style={{ paddingTop: 32 }}>
              <Title size={34}>One last thing</Title>
              <Sub>We'll tag this card to you so you can follow where it travels.</Sub>
              <TextField label="Your name" value={tx.name} onChange={(e) => setTx((t) => ({ ...t, name: e.target.value }))} placeholder="Full name" autoFocus />
              <EmailField value={tx.email} onChange={(v) => setTx((t) => ({ ...t, email: v }))} />
              <Btn disabled={!(nameValid && emailValid)} onClick={() => { setOpReveal(false); setScreen("handBack"); }} style={{ marginTop: 2 }}>Done</Btn>
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button
                  onMouseDown={() => { holdRef.current = setTimeout(() => setOverrideHeld(true), 900); }}
                  onMouseUp={() => clearTimeout(holdRef.current)} onMouseLeave={() => clearTimeout(holdRef.current)}
                  onTouchStart={() => { holdRef.current = setTimeout(() => setOverrideHeld(true), 900); }} onTouchEnd={() => clearTimeout(holdRef.current)}
                  onClick={() => { if (overrideHeld) { setTx((t) => ({ ...t, houseAccount: !t.email.trim() })); setOpReveal(false); setScreen("handBack"); } }}
                  style={{ fontFamily: fB, fontSize: overrideHeld ? 13 : 18, color: overrideHeld ? C.purple : C.line, background: "transparent", border: "none", cursor: "pointer", padding: 8, lineHeight: 1 }}>
                  {overrideHeld ? "override: continue without validation \u2192" : "\u00b7"}
                </button>
              </div>
              <Back onClick={() => setScreen("amount")} />
            </div>
          </Screen>
        )}

        {screen === "handBack" && (
          <Screen k="hb">
            <div style={{ paddingTop: 36 }}>
              {!opReveal ? (
                /* ---- customer-facing: message + fading prompts; long-press to reveal operator block ---- */
                <div
                  onMouseDown={() => { hbHoldRef.current = setTimeout(() => setOpReveal(true), 700); }}
                  onMouseUp={() => clearTimeout(hbHoldRef.current)} onMouseLeave={() => clearTimeout(hbHoldRef.current)}
                  onTouchStart={() => { hbHoldRef.current = setTimeout(() => setOpReveal(true), 700); }} onTouchEnd={() => clearTimeout(hbHoldRef.current)}
                  style={{ userSelect: "none", cursor: "default" }}>
                  <div style={{ background: C.purpleSoft, borderRadius: 18, padding: "30px 22px", textAlign: "center" }}>
                    <div style={{ fontFamily: fD, fontWeight: 700, fontSize: 30, color: C.ink, marginBottom: 8 }}>All set{tx.name ? `, ${tx.name.trim().split(" ")[0]}` : ""}!</div>
                    <div style={{ fontFamily: fD, fontWeight: 700, fontSize: 38, color: C.purpleDeep, lineHeight: 1.1 }}>Please hand the<br />iPad back</div>
                  </div>
                  <FadePrompts />
                </div>
              ) : (
                /* ---- operator block (replaces the customer message) ---- */
                <div>
                  <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 14, padding: "16px 16px 18px" }}>
                    {tx.paymentType === "pledge" ? (
                      <div style={{ textAlign: "center", marginBottom: 4 }}>
                        <span style={{ fontFamily: fB, fontSize: 13, color: "#fff", background: C.kraftDeep, borderRadius: 8, padding: "5px 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pledge</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ textAlign: "center", marginBottom: 12 }}>
                          <span style={{ fontFamily: fB, fontSize: 12, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Support</span>
                          <div style={{ fontFamily: fD, fontWeight: 700, fontSize: 30, color: C.ink, lineHeight: 1.1 }}>${tx.amount}</div>
                        </div>
                        <span style={{ fontFamily: fB, fontWeight: 500, fontSize: 13, color: C.faint, display: "block", marginBottom: 7, textAlign: "center" }}>How did they pay?</span>
                        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                          {["cash", "card", "venmo"].map((pt) => (
                            <button key={pt} onClick={() => setTx((t) => ({ ...t, paymentType: pt }))} className="ca-btn"
                              style={{ flex: 1, fontFamily: fB, fontSize: 15, padding: "12px 0", borderRadius: 10, cursor: "pointer", textTransform: "capitalize",
                                border: `2px solid ${tx.paymentType === pt ? C.purple : C.line}`, background: tx.paymentType === pt ? C.purpleSoft : "#fff", color: C.ink }}>{pt}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ height: 20 }} />
                  <label style={{ display: "block" }}>
                    <span style={{ fontFamily: fB, fontWeight: 500, fontSize: 14, color: C.faint, display: "block", marginBottom: 6 }}>Card code (operator)</span>
                    <input value={tx.code} onChange={(e) => setTx((t) => ({ ...t, code: fmtCode(e.target.value) }))} inputMode="numeric" placeholder="000 000 000 000"
                      style={{ fontFamily: fN, fontSize: 24, letterSpacing: "0.04em", color: C.ink, width: "100%", boxSizing: "border-box", border: `2px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", outline: "none", textAlign: "center" }} />
                  </label>
                  <p style={{ fontFamily: fB, fontSize: 13, color: C.faint, textAlign: "center", margin: "8px 0 16px" }}>Enter all 12 digits, or leave blank to add later</p>
                  <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, padding: 4, marginBottom: 14 }}>
                    <textarea value={tx.note} onChange={(e) => setTx((t) => ({ ...t, note: e.target.value }))} rows={2} placeholder="Note (optional) — saves with the sale"
                      style={{ fontFamily: fB, fontSize: 15, color: C.ink, width: "100%", boxSizing: "border-box", border: "none", outline: "none", resize: "none", padding: 10, background: "transparent" }} />
                  </div>
                  <Btn
                    disabled={!((codeDigits(tx.code).length === 0 || codeDigits(tx.code).length === 12) && (tx.paymentType === "pledge" || ["cash", "card", "venmo"].includes(tx.paymentType)))}
                    onClick={() => { commitSingle(); setScreen("confirm"); }}>Done</Btn>
                  <Btn variant="ghost" onClick={() => { resetSingle(); setScreen("custHome"); }} style={{ marginTop: 4 }}>Cancel</Btn>
                </div>
              )}
            </div>
          </Screen>
        )}

        {screen === "confirm" && (
          <Screen k="cf">
            <div style={{ paddingTop: 60, textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Chevrons size={30} /></div>
              <Title size={32}>All done</Title>
              <Sub>That's it. That's the whole thing.</Sub>
              <div style={{ display: "grid", gap: 12, maxWidth: 340, margin: "8px auto 0" }}>
                <Btn variant="green" onClick={() => { resetSingle(); setScreen("custHome"); }}>Back to home</Btn>
                <Btn variant="outline" onClick={() => setScreen("noteNow")}>Add a note</Btn>
              </div>
            </div>
          </Screen>
        )}

        {screen === "noteNow" && (
          <Screen k="nn">
            <div style={{ paddingTop: 36 }}>
              <Title size={28}>Add a note</Title>
              <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, padding: 4, margin: "16px 0" }}>
                <textarea autoFocus value={tx.note} onChange={(e) => setTx((t) => ({ ...t, note: e.target.value }))} rows={3} placeholder="e.g. tourist from Ireland &middot; wants to volunteer"
                  style={{ fontFamily: fB, fontSize: 16, color: C.ink, width: "100%", boxSizing: "border-box", border: "none", outline: "none", resize: "none", padding: 12, background: "transparent" }} />
              </div>
              <Btn variant="green" onClick={() => { setRows((all) => all.map((r) => r.id === lastId ? { ...r, note: tx.note } : r)); resetSingle(); setScreen("custHome"); }}>Save &amp; back to home</Btn>
            </div>
          </Screen>
        )}

        {screen === "lastNote" && (
          <Screen k="ln">
            <div style={{ paddingTop: 36 }}>
              <Eyebrow>Last sale</Eyebrow>
              <Title size={26}>Add a note</Title>
              <LastNoteEditor row={rows.find((r) => r.id === lastId)} onSave={(note) => { setRows((all) => all.map((r) => r.id === lastId ? { ...r, note } : r)); setScreen("custHome"); }} onCancel={() => setScreen("custHome")} />
            </div>
          </Screen>
        )}

        {screen === "packInfo" && (
          <Screen k="pi">
            <div style={{ paddingTop: 32 }}>
              <Eyebrow>Packs of 10</Eyebrow>
              <Title>Cards by the handful.</Title>
              <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 16, padding: 20, margin: "8px 0 18px" }}>
                {[["1 pack &middot; 10 cards", "$12"], ["2 packs &middot; 20 cards", "$24"], ["3+ packs &middot; save 25%", "$9 / pack"]].map(([l, r], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${C.line}` : "none" }}>
                    <span style={{ fontFamily: fB, fontSize: 16, color: C.ink }} dangerouslySetInnerHTML={{ __html: l }} />
                    <span style={{ fontFamily: fD, fontWeight: 700, fontSize: 22, color: C.ink }}>{r}</span>
                  </div>
                ))}
              </div>
              <Sub>Packs are sold right here &mdash; flag down whoever's at the cart and we'll set you up.</Sub>
              <Back onClick={() => setScreen("custHome")} />
            </div>
          </Screen>
        )}

        {screen === "packEntry" && (
          <Screen k="pe">
            <div style={{ paddingTop: 32 }}>
              <Eyebrow>Operator &middot; log a pack sale</Eyebrow>
              <Title size={26}>Pack sale</Title>
              <TextField label="Customer name" value={pack.name} onChange={(e) => setPack((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" autoFocus />
              <EmailField value={pack.email} onChange={(v) => setPack((p) => ({ ...p, email: v }))} />
              <span style={{ fontFamily: fB, fontWeight: 500, fontSize: 14, color: C.faint, display: "block", marginBottom: 6 }}>Pack IDs</span>
              <div style={{ display: "flex", gap: 8, marginBottom: packIds.length ? 10 : 4 }}>
                <input value={idField} onChange={(e) => setIdField(fmtId(e.target.value))} inputMode="numeric" placeholder="222-86"
                  onKeyDown={(e) => { if (e.key === "Enter") addPackId(); }}
                  style={{ flex: 1, fontFamily: fN, fontSize: 20, color: C.ink, boxSizing: "border-box", border: `2px solid ${dupFlash ? C.danger : C.line}`, borderRadius: 12, padding: "13px 16px", outline: "none", background: "#fff" }} />
                <button onClick={addPackId} disabled={idDigits(idField).length < 4} className="ca-btn"
                  style={{ width: 56, fontFamily: fD, fontWeight: 700, fontSize: 26, borderRadius: 12, border: "none", cursor: idDigits(idField).length < 4 ? "default" : "pointer", background: idDigits(idField).length < 4 ? C.line : C.purple, color: "#fff" }}>+</button>
              </div>
              {dupFlash && <p style={{ fontFamily: fB, fontSize: 13, color: C.danger, margin: "0 0 8px" }}>That ID is already added.</p>}
              {packIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {packIds.map((id) => (
                    <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.purpleSoft, color: C.ink, borderRadius: 10, padding: "8px 10px 8px 12px", fontFamily: fN, fontSize: 16 }}>
                      {id}
                      <button onClick={() => setPackIds((p) => p.filter((x) => x !== id))} className="ca-btn" style={{ background: "transparent", border: "none", cursor: "pointer", color: C.faint, fontSize: 18, lineHeight: 1, padding: 0 }}>&times;</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {["cash", "card", "venmo"].map((pt) => (
                  <button key={pt} onClick={() => setPack((p) => ({ ...p, paymentType: pt }))} className="ca-btn"
                    style={{ flex: 1, fontFamily: fB, fontSize: 15, padding: "12px 0", borderRadius: 10, cursor: "pointer", textTransform: "capitalize", border: `2px solid ${pack.paymentType === pt ? C.purple : C.line}`, background: pack.paymentType === pt ? C.purpleSoft : "#fff", color: C.ink }}>{pt}</button>
                ))}
              </div>
              <TextField label="Amount ($)" inputMode="decimal" value={pack.amount} onChange={(e) => setPack((p) => ({ ...p, amount: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="12" />
              <TextField label="Note (optional)" value={pack.note} onChange={(e) => setPack((p) => ({ ...p, note: e.target.value }))} placeholder="optional" />
              <Btn variant="green" disabled={!(pack.name.trim() || packIds.length || idDigits(idField).length >= 4)} onClick={() => { commitPack(); resetPack(); setScreen("custHome"); }}>Save sale</Btn>
              <Back onClick={() => { resetPack(); setScreen("custHome"); }} />
            </div>
          </Screen>
        )}

        {screen === "pinGate" && (
          <Screen k="pg">
            <div style={{ paddingTop: 44 }}>
              <Eyebrow>Operator</Eyebrow>
              <Title size={26}>Enter PIN</Title>
              <div style={{ textAlign: "center", margin: "8px 0 16px", fontFamily: fN, fontSize: 32, letterSpacing: "0.4em", minHeight: 38 }}>{pinEntry.replace(/./g, "\u2022")}</div>
              {pinError && <p style={{ textAlign: "center", color: C.danger, fontFamily: fB, fontSize: 14, margin: "0 0 12px" }}>Wrong PIN &mdash; try again</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, maxWidth: 300, margin: "0 auto" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <button key={n} className="ca-btn" onClick={() => tapPin(n)} style={padBtn()}>{n}</button>)}
                <button className="ca-btn" onClick={() => setPinEntry("")} style={{ ...padBtn(), fontSize: 15, color: C.faint }}>clear</button>
                <button className="ca-btn" onClick={() => tapPin(0)} style={padBtn()}>0</button>
                <button className="ca-btn" onClick={() => setScreen("custHome")} style={{ ...padBtn(), fontSize: 15, color: C.faint }}>exit</button>
              </div>
            </div>
          </Screen>
        )}

        {screen === "review" && (
          <Screen k="rv">
            <div style={{ paddingTop: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Eyebrow>Operator &middot; transactions</Eyebrow>
                <button onClick={loadReview} style={{ fontFamily: fB, fontSize: 13, color: C.purple, background: "transparent", border: "none", cursor: "pointer" }}>↻ refresh</button>
              </div>

              {reviewLoading && <p style={{ textAlign: "center", fontFamily: fB, color: C.faint, padding: "30px 0" }}>loading…</p>}
              {reviewError && (
                <div style={{ background: "#FBECEC", border: `2px solid ${C.danger}`, borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 12 }}>
                  <p style={{ fontFamily: fB, fontSize: 14, color: C.danger, margin: "0 0 8px" }}>Couldn't load: {reviewError}</p>
                  <button onClick={loadReview} style={{ fontFamily: fB, fontSize: 14, color: "#fff", background: C.danger, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Try again</button>
                </div>
              )}
              {!reviewLoading && !reviewError && reviewData && reviewData.length === 0 && (
                <p style={{ textAlign: "center", fontFamily: fB, color: C.faint, padding: "30px 0" }}>No transactions yet today.</p>
              )}

              {!reviewLoading && !reviewError && reviewData && reviewData.length > 0 && (
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  {reviewData.map((day) => (
                    <div key={day.dateKey} style={{ marginBottom: 22 }}>
                      <div style={{ fontFamily: fD, fontWeight: 700, fontSize: 17, color: C.ink, margin: "0 0 8px" }}>{day.dateLabel}</div>
                      <DayTotals t={day.totals} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                        {day.rows.map((r, idx) => <SheetRow key={day.dateKey + "-" + idx} r={r} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16 }}><Btn variant="outline" onClick={() => setScreen("custHome")}>Back to customer mode</Btn></div>
            </div>
          </Screen>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: "0 0 16px", fontFamily: fN, fontSize: 12, color: C.faint }}>circle.love &middot; cart prototype &middot; mock data</footer>
    </div>
  );

  function tapPin(n) {
    const next = (pinEntry + n).slice(0, 4);
    setPinEntry(next); setPinError(false);
    if (next.length === 4) {
      if (next === PIN) setTimeout(() => { if (pinTarget === "packEntry") { setScreen("packEntry"); } else { loadReview(); setScreen("review"); } setPinEntry(""); }, 120);
      else setTimeout(() => { setPinError(true); setPinEntry(""); }, 120);
    }
  }
}

function DayTotals({ t }) {
  const cell = (b, s) => (<div style={{ textAlign: "center", flex: 1 }}><div style={{ fontFamily: fD, fontWeight: 700, fontSize: 20, color: C.ink }}>{b}</div><div style={{ fontFamily: fB, fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s}</div></div>);
  return (
    <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 14, padding: "12px 12px" }}>
      <div style={{ display: "flex", marginBottom: 8 }}>{cell(`$${t.collected}`, "collected")}{cell(t.singles, "singles")}{cell(t.pledges, "pledges")}{cell(t.packs, "packs")}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, borderTop: `1px solid ${C.line}`, paddingTop: 8, fontFamily: fB, fontSize: 12, color: C.faint }}><span>singles ${t.singlesRev}</span><span>&middot;</span><span>packs ${t.packsRev}</span></div>
    </div>
  );
}

function SheetRow({ r }) {
  const isHouse = String(r.house_account).toUpperCase() === "TRUE";
  const tag = r.source === "pack" ? "pack" : (r.payment_type === "pledge" ? "pledge" : "single");
  const tagColor = tag === "pack" ? C.purple : tag === "pledge" ? C.kraftDeep : C.green;
  const t = new Date(r.timestamp);
  const time = isNaN(t) ? "" : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontFamily: fD, fontWeight: 600, fontSize: 15, color: C.ink }}>{isHouse ? "House account" : (r.name || "\u2014")}</span>
          <span style={{ fontFamily: fB, fontSize: 10, color: "#fff", background: tagColor, borderRadius: 6, padding: "2px 7px", marginLeft: 8, textTransform: "uppercase" }}>{tag}</span>
        </div>
        <span style={{ fontFamily: fD, fontWeight: 700, fontSize: 17, color: C.ink }}>{r.payment_type === "pledge" ? "\u2014" : `$${r.amount}`}</span>
      </div>
      <div style={{ fontFamily: fB, fontSize: 12, color: C.faint, marginTop: 3 }}>{time} &middot; {r.payment_type || "\u2014"}{r.card_ids ? ` \u00b7 ${r.card_ids}` : ""}</div>
      {r.note && <div style={{ fontFamily: fB, fontSize: 13, color: C.ink, marginTop: 4 }}>📝 {r.note}</div>}
    </div>
  );
}

function LastNoteEditor({ row, onSave, onCancel }) {
  const [draft, setDraft] = useState(row?.note || "");
  if (!row) return null;
  return (
    <div>
      <div style={{ fontFamily: fB, fontSize: 13, color: C.faint, textAlign: "center", marginBottom: 14 }}>{row.houseAccount ? "House account" : (row.name || "\u2014")} &middot; {row.ts}</div>
      <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="add a note"
          style={{ fontFamily: fB, fontSize: 16, color: C.ink, width: "100%", boxSizing: "border-box", border: "none", outline: "none", resize: "none", padding: 12, background: "transparent" }} />
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <Btn variant="green" onClick={() => onSave(draft)}>Save note</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

function Totals({ rows }) {
  const singles = rows.filter((r) => r.source === "single");
  const packs = rows.filter((r) => r.source === "pack");
  const pledges = singles.filter((r) => r.paymentType === "pledge");
  const collected = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const sRev = singles.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const pRev = packs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const cell = (b, s) => (<div style={{ textAlign: "center", flex: 1 }}><div style={{ fontFamily: fD, fontWeight: 700, fontSize: 23, color: C.ink }}>{b}</div><div style={{ fontFamily: fB, fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s}</div></div>);
  return (
    <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 16, padding: "16px 14px" }}>
      <div style={{ display: "flex", marginBottom: 12 }}>{cell(`$${collected}`, "collected")}{cell(singles.length, "singles")}{cell(pledges.length, "pledges")}{cell(packs.length, "packs")}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 18, borderTop: `1px solid ${C.line}`, paddingTop: 10, fontFamily: fB, fontSize: 13, color: C.faint }}><span>singles ${sRev}</span><span>&middot;</span><span>packs ${pRev}</span></div>
    </div>
  );
}

function RowCard({ r, onNote }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.note || "");
  const tag = r.source === "pack" ? "pack" : (r.paymentType === "pledge" ? "pledge" : "single");
  const tagColor = tag === "pack" ? C.purple : tag === "pledge" ? C.kraftDeep : C.green;
  return (
    <div style={{ background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontFamily: fD, fontWeight: 600, fontSize: 16, color: C.ink }}>{r.houseAccount ? "House account" : (r.name || "\u2014")}</span>
          <span style={{ fontFamily: fB, fontSize: 11, color: "#fff", background: tagColor, borderRadius: 6, padding: "2px 7px", marginLeft: 8, textTransform: "uppercase" }}>{tag}</span>
        </div>
        <span style={{ fontFamily: fD, fontWeight: 700, fontSize: 18, color: C.ink }}>{r.paymentType === "pledge" ? "\u2014" : `$${r.amount}`}</span>
      </div>
      <div style={{ fontFamily: fB, fontSize: 12, color: C.faint, marginTop: 3 }}>{r.ts} &middot; {r.paymentType || "\u2014"}{r.packIds ? ` \u00b7 ${r.packIds}` : r.code ? ` \u00b7 ${r.code}` : ""}</div>
      {editing ? (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="add a note" style={{ flex: 1, fontFamily: fB, fontSize: 14, border: `2px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", outline: "none" }} />
          <button onClick={() => { onNote(draft); setEditing(false); }} className="ca-btn" style={{ fontFamily: fB, fontSize: 13, color: "#fff", background: C.green, border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>save</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="ca-btn" style={{ marginTop: 8, fontFamily: fB, fontSize: 13, color: r.note ? C.ink : C.faint, background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontStyle: r.note ? "normal" : "italic" }}>{r.note ? `\ud83d\udcdd ${r.note}` : "+ add note"}</button>
      )}
    </div>
  );
}

function opLink() { return { fontFamily: fB, fontSize: 13, color: C.faint, background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }; }
function padBtn() { return { fontFamily: fD, fontWeight: 600, fontSize: 24, background: "#fff", border: `2px solid ${C.line}`, borderRadius: 14, padding: "15px 0", cursor: "pointer", color: C.ink }; }
function displayAmt(a) { return a === 0 ? "0" : a; }
function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function rid() { return Math.random().toString(36).slice(2, 9); }
function seed() {
  return [
    { id: "s1", ts: "1:12 PM", source: "single", name: "Maya", email: "maya@gmail.com", amount: 5, paymentType: "cash", code: "214 000 000 143", note: "" },
    { id: "s2", ts: "1:31 PM", source: "single", name: "", houseAccount: true, email: "", amount: 0, paymentType: "pledge", code: "", note: "young guy, promised to use it" },
    { id: "p1", ts: "1:48 PM", source: "pack", name: "Dan R", email: "dan@yahoo.com", packIds: "222-86, 231-04", amount: 24, paymentType: "venmo", note: "teacher, 2 packs" },
    { id: "s3", ts: "2:05 PM", source: "single", name: "Priya", email: "priya@icloud.com", amount: 10, paymentType: "card", code: "206 000 000 227", note: "" },
  ];
}
