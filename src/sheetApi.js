// sheetApi.js — talks to the Google Apps Script endpoint (read + write)
// Drop this into your real project (Vite/Next). It will NOT work inside the
// Claude artifact preview because that sandbox blocks external network calls —
// test it in your deployed/local app.

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzdBETkPOJVacVeW6f72YgZrOgfJEtS7l3csEYRwVtXTa29G8y8WdmgKb8gS9zblaV__Q/exec";
const SECRET = "circlecards-Pearl-Street";

// Local-time ISO-like timestamp (NOT UTC) so day-grouping reflects the
// device's calendar day. Format: "YYYY-MM-DDTHH:mm:ss" in local time.
export function localTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds())
  );
}

/* ============================================================
   Local persistence + sync queue
   Every sale is saved to localStorage immediately (survives refresh/
   crash/battery). Each carries _localId and _synced. Failed writes stay
   _synced:false so they can be retried or reconciled at end of day.
   ============================================================ */

const LS_KEY = "circle_cart_sales_v1";

function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function lsWrite(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {
    /* storage full or unavailable — nothing else we can do */
  }
}

// Save a sale locally FIRST (always succeeds), then attempt the sheet write.
// Returns { ok, localId, error? }. ok=false means it's stored but unsynced.
export async function saveSaleLocalFirst(row) {
  const localId = "L" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  const stamped = { ...row, timestamp: row.timestamp || localTimestamp() };
  const record = { ...stamped, _localId: localId, _synced: false };

  const all = lsRead();
  all.unshift(record);
  lsWrite(all);

  const res = await saveRow(stamped);
  if (res.ok) {
    markSynced(localId);
    return { ok: true, localId };
  }
  return { ok: false, localId, error: res.error };
}

function markSynced(localId) {
  const all = lsRead();
  const i = all.findIndex((r) => r._localId === localId);
  if (i >= 0) { all[i]._synced = true; lsWrite(all); }
}

// Save a promo/STH pack row locally FIRST, then attempt the sheet write.
// Reuses the same local queue + retry machinery as sales.
// row shape: { kind:"promo", timestamp, disposition, pack_id, note }
export async function savePromoLocalFirst(row) {
  const localId = "L" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  const stamped = { kind: "promo", ...row, timestamp: row.timestamp || localTimestamp() };
  const record = { ...stamped, _localId: localId, _synced: false };

  const all = lsRead();
  all.unshift(record);
  lsWrite(all);

  const res = await savePromoRow(stamped);
  if (res.ok) {
    markSynced(localId);
    return { ok: true, localId };
  }
  return { ok: false, localId, error: res.error };
}

export function getUnsynced() {
  return lsRead().filter((r) => !r._synced);
}

export function getAllLocal() {
  return lsRead();
}

// Retry one unsynced record by localId. Returns { ok, error? }.
export async function retryOne(localId) {
  const all = lsRead();
  const rec = all.find((r) => r._localId === localId);
  if (!rec) return { ok: false, error: "not found" };
  const { _localId, _synced, ...row } = rec;
  const res = row.kind === "promo" ? await savePromoRow(row) : await saveRow(row);
  if (res.ok) { markSynced(localId); return { ok: true }; }
  return { ok: false, error: res.error };
}

// Retry all unsynced. Returns { ok, remaining } — remaining = count still failed.
export async function retryAllUnsynced() {
  const pending = getUnsynced();
  let stillFailed = 0;
  for (const rec of pending) {
    const r = await retryOne(rec._localId);
    if (!r.ok) stillFailed++;
  }
  return { ok: stillFailed === 0, remaining: stillFailed };
}

/* ============================================================ */

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
      timestamp: row.timestamp || localTimestamp(),
      source: row.source || "",
      name: row.name || "",
      email: row.email || "",
      payment_type: row.payment_type || "",
      amount: row.amount != null ? row.amount : "",
      card_ids: row.card_ids || "",
      note: row.note || "",
      house_account: !!row.house_account,
      base_amount: row.base_amount != null ? row.base_amount : "",
      sales_tax: row.sales_tax != null ? row.sales_tax : "",
      followers: row.followers || "",
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
 * Append one promo/STH pack row to the "promos" tab.
 * Sends kind:"promo" so the Apps Script routes to the right tab.
 * row shape: { timestamp, disposition, pack_id, note }
 */
export async function savePromoRow(row) {
  const payload = {
    secret: SECRET,
    kind: "promo",
    row: {
      timestamp: row.timestamp || localTimestamp(),
      disposition: row.disposition || "promo",
      pack_id: row.pack_id || "",
      note: row.note || "",
    },
  };
  try {
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

// Read the promos tab. Returns { ok, rows } where rows are
// { timestamp, disposition, pack_id, note }.
export async function fetchPromos() {
  try {
    const url = ENDPOINT + "?secret=" + encodeURIComponent(SECRET) + "&tab=promos";
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "read failed" };
    return { ok: true, rows: data.rows || [] };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Group promo rows by day, newest first, with per-day counts by disposition.
export function groupPromosByDay(rows) {
  const groups = {};
  for (const r of rows) {
    const key = dayKey(r.timestamp);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  const keys = Object.keys(groups).sort().reverse();
  return keys.map((key) => {
    const dayRows = groups[key].slice().sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    const promo = dayRows.filter((r) => String(r.disposition).toLowerCase() !== "sth").length;
    const sth = dayRows.filter((r) => String(r.disposition).toLowerCase() === "sth").length;
    let dateLabel = "Unknown date";
    if (key !== "unknown") {
      const d = new Date(key + "T12:00:00");
      dateLabel = d.toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric",
      });
    }
    return { dateKey: key, dateLabel, totals: { total: dayRows.length, promo, sth }, rows: dayRows };
  });
}

// Extract a local YYYY-MM-DD day key from a timestamp string.
// New rows are stored as local time with no "Z" — use the date part directly.
// Old rows (from before this fix) are UTC with a "Z" — convert to local first.
function dayKey(ts) {
  if (!ts) return "unknown";
  const s = String(ts);
  // local format like "2026-06-20T18:30:00" (no timezone marker)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[Zz]|[+\-]\d{2}:?\d{2}$/.test(s)) {
    return s.slice(0, 10);
  }
  // otherwise parse (UTC/ISO) and convert to local date
  const d = new Date(s);
  if (isNaN(d)) return "unknown";
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/**
 * Group rows by calendar day (newest day first) and compute per-day totals.
 * Returns: [{ dateLabel, dateKey, totals, rows: [...] }, ...]
 */
export function groupByDay(rows) {
  const groups = {};
  for (const r of rows) {
    const key = dayKey(r.timestamp);
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