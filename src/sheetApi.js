// sheetApi.js — talks to the Google Apps Script endpoint (read + write)
// Drop this into your real project (Vite/Next). It will NOT work inside the
// Claude artifact preview because that sandbox blocks external network calls —
// test it in your deployed/local app.

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzdBETkPOJVacVeW6f72YgZrOgfJEtS7l3csEYRwVtXTa29G8y8WdmgKb8gS9zblaV__Q/exec";
const SECRET = "circlecards-Pearl-Street";

/**
 * Append one sale row to the sheet.
 * Returns { ok: true } on success, or { ok: false, error } on failure.
 * NEVER throws — caller checks .ok so a failed save can be shown loudly.
 *
 * row shape:
 *   { source, name, email, payment_type, amount, card_ids, note, house_account }
 *   timestamp is added here if not provided.
 */
export async function saveRow(row) {
  const payload = {
    secret: SECRET,
    row: {
      timestamp: row.timestamp || new Date().toISOString(),
      source: row.source || "",
      name: row.name || "",
      email: row.email || "",
      payment_type: row.payment_type || "",
      amount: row.amount != null ? row.amount : "",
      card_ids: row.card_ids || "",
      note: row.note || "",
      house_account: !!row.house_account,
    },
  };
  try {
    // Apps Script web apps require a "simple" request to avoid a CORS preflight,
    // so we use text/plain and let the script JSON.parse the body.
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
    const data = await res.json();
    return data.ok ? { ok: true } : { ok: false, error: data.error || "save failed" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Read all rows from the sheet.
 * Returns { ok: true, rows: [...] } or { ok: false, error }.
 */
export async function fetchRows() {
  try {
    const url = ENDPOINT + "?secret=" + encodeURIComponent(SECRET);
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "read failed" };
    return { ok: true, rows: data.rows || [] };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Group rows by calendar day (newest day first) and compute per-day totals.
 * Returns: [{ dateLabel, dateKey, totals, rows: [...] }, ...]
 */
export function groupByDay(rows) {
  const groups = {};
  for (const r of rows) {
    const d = new Date(r.timestamp);
    const key = isNaN(d) ? "unknown" : d.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  const keys = Object.keys(groups).sort().reverse(); // newest day first
  return keys.map((key) => {
    const dayRows = groups[key].slice().sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    const singles = dayRows.filter((r) => r.source === "single");
    const packs = dayRows.filter((r) => r.source === "pack");
    const pledges = singles.filter((r) => r.payment_type === "pledge");
    const num = (r) => Number(r.amount) || 0;
    const totals = {
      collected: dayRows.reduce((s, r) => s + num(r), 0),
      singles: singles.length,
      pledges: pledges.length,
      packs: packs.length,
      singlesRev: singles.reduce((s, r) => s + num(r), 0),
      packsRev: packs.reduce((s, r) => s + num(r), 0),
    };
    let dateLabel = "Unknown date";
    if (key !== "unknown") {
      const d = new Date(key + "T12:00:00");
      dateLabel = d.toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric",
      });
    }
    return { dateKey: key, dateLabel, totals, rows: dayRows };
  });
}