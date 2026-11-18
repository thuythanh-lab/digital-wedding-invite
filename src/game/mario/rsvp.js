/**
 * RSVP + guest personalisation.
 *
 * Personal invitation link (made on the local admin page, admin/):
 *   https://<site>/?khach=Anh%20Tu%E1%BA%A5n&id=<random guest id>
 * Generic invitation link: https://<site>/  (no name, no id) — the guest is
 * greeted as "Bạn" and types their name in the RSVP box; this browser gets its
 * own submission id so generic answers never share one id.
 * (Also accepted for the name: ?guest= ?to= ?name=.)
 *
 * Backend: POST JSON (sent as text/plain to avoid a CORS pre-flight, which
 * Google Apps Script web apps do not support) to VITE_RSVP_ENDPOINT
 * (set in .env). Success is shown ONLY when the endpoint replies
 * HTTP 2xx with JSON that explicitly says so: { "ok": true } (or
 * { "result": "success" } / { "status": "success" }). Opaque or HTML replies
 * are never treated as saved. See docs/apps-script/Code.gs for a matching
 * Apps Script.
 *
 * On this computer (localhost) answers go to the dev backend /api/rsvp →
 * rsvp-data/rsvps.json, so testing never touches the real Google Sheet —
 * unless the page is opened with ?rsvpLive=1.
 */

const STORAGE_KEY = 'mt.rsvp.v2'; // { [guestKey]: record } — one answer per invitation
const LOCAL_ID_KEY = 'mt.rsvp.localId';
const MAX_NAME = 40;

function cleanName(s) {
  return (s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

function randomId(prefix = '') {
  const a = new Uint8Array(9);
  (globalThis.crypto || window.msCrypto).getRandomValues(a);
  return prefix + Array.from(a, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

/** Browser-local id for answers sent from the generic link. */
function localSubmissionId() {
  try {
    let id = localStorage.getItem(LOCAL_ID_KEY);
    if (!id) { id = randomId('web-'); localStorage.setItem(LOCAL_ID_KEY, id); }
    return id;
  } catch {
    return randomId('web-');
  }
}

export function readGuest() {
  const q = new URLSearchParams(window.location.search);
  const name = cleanName(q.get('khach') || q.get('guest') || q.get('to') || q.get('name'));
  const id = (q.get('id') || '').replace(/[^\w-]/g, '').slice(0, 64);
  return { name, id };
}

function isLocalHost() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

function endpoint() {
  const q = new URLSearchParams(window.location.search);
  // Local testing (dev server or `vite preview` on this machine) never writes to
  // the real sheet unless explicitly asked with ?rsvpLive=1.
  if ((import.meta.env.DEV || isLocalHost()) && q.get('rsvpLive') !== '1') {
    return q.get('rsvpTest') === 'fail' ? '/api/rsvp?fail=1' : '/api/rsvp';
  }
  return import.meta.env.VITE_RSVP_ENDPOINT || '';
}

export class RsvpError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/** Key under which this invitation's answer is remembered in this browser. */
function guestKey(guest) {
  return guest?.id ? `id:${guest.id}` : 'generic';
}

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; }
}

const confirmed = (data) => !!data && (data.ok === true || data.result === 'success' || data.status === 'success');

/** Resolves only when the backend confirms the RSVP was stored. */
export async function submitRsvp({ name, id, attending }) {
  const url = endpoint();
  if (!url) throw new RsvpError('not-configured', 'RSVP endpoint is not configured');
  const guestId = id || localSubmissionId();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : 0;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        guestId,
        name: cleanName(name),
        attending: !!attending,
        rsvp: attending ? 'Attending' : 'Declined',
        answer: attending ? 'yes' : 'no',
        linkType: id ? 'personal' : 'generic',
        submittedAt: new Date().toISOString(),
      }),
      signal: ctrl?.signal,
    });
  } catch (e) {
    throw new RsvpError(e?.name === 'AbortError' ? 'timeout' : 'network', e?.message);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new RsvpError('http', `HTTP ${res.status}`);
  // Accepted replies: JSON {"ok":true} (reference script, dev backend) or the
  // plain text "ok" that the deployed Apps Script returns (observed 18.11.2026).
  // Anything else — an HTML error page, an empty or opaque reply — is NOT success.
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!confirmed(data) && text.trim().toLowerCase() !== 'ok') throw new RsvpError('rejected', data?.error || 'not confirmed');
  const record = { attending: !!attending, name: cleanName(name), guestId, at: Date.now() };
  try {
    const store = readStore();
    store[guestKey({ id })] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* private mode */ }
  return record;
}

/** The answer this browser last sent for THIS invitation (confirmed by the backend). */
export function savedRsvp(guest) {
  const r = readStore()[guestKey(guest)];
  if (!r || typeof r.attending !== 'boolean') return null;
  // a personal link only ever shows its own guest's answer
  if (guest?.id && r.guestId !== guest.id) return null;
  return r;
}
