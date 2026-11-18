import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-ext-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/latin-ext-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import './admin.css';

/*
 * Local admin for personalised invitation links.
 *  - Personal link:  <site>?khach=<name>&id=<guest id>   (read by src/game/mario/rsvp.js)
 *  - Generic link:   <site>                               (greeting "BẠN SẴN SÀNG CHƯA?")
 * Guest ids: 10 characters from a 32-letter alphabet, drawn with the Web Crypto
 * API (≈ 50 bits) — random, not derived from the name, created once and kept.
 * They identify an invitation's answer; they are not a password.
 * Storage: this browser's localStorage only (export CSV to back it up).
 */

const LS_BASE = 'mt.admin.baseUrl';
const LS_GUESTS = 'mt.admin.guests.v1';
const MAX_NAME = 40; // same limit as the invitation (rsvp.js)
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/o/1/l look-alikes

const $ = (id) => document.getElementById(id);
const els = {
  base: $('base-url'), baseSave: $('base-save'), baseMsg: $('base-msg'),
  form: $('guest-form'), name: $('guest-name'), guestMsg: $('guest-msg'),
  result: $('result'), resultName: $('result-name'), resultUrl: $('result-url'),
  resultCopy: $('result-copy'), resultPreview: $('result-preview'), resultToast: $('result-toast'),
  genericUrl: $('generic-url'), genericCopy: $('generic-copy'), genericPreview: $('generic-preview'), genericToast: $('generic-toast'),
  search: $('search'), exportBtn: $('export'), rows: $('rows'), empty: $('empty'), count: $('count'),
};

// ------------------------------------------------------------------ storage
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full/private */ } };
let guests = load(LS_GUESTS, []); // [{ id, name, createdAt }]
// The published invitation (GitHub Pages). A different address can still be saved.
const DEFAULT_BASE = 'https://thuythanh-lab.github.io/digital-wedding-invite/';
let base = load(LS_BASE, '') || DEFAULT_BASE;
let lastId = null;

// ------------------------------------------------------------------ helpers
const cleanName = (s) => (s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
const sameName = (a, b) => a.normalize('NFC').toLocaleLowerCase('vi') === b.normalize('NFC').toLocaleLowerCase('vi');

function newId() {
  const taken = new Set(guests.map((g) => g.id));
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const id = Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
    if (!taken.has(id)) return id;
  }
}

/** Validate the production site address; returns { url } or { error }. */
function normaliseBase(raw) {
  const text = (raw || '').trim();
  if (!text) return { error: 'Hãy nhập địa chỉ website thiệp cưới trước khi tạo link.' };
  let u;
  try { u = new URL(text); } catch { return { error: 'Đường dẫn chưa hợp lệ. Ví dụ: https://ten-ban.github.io/thiep-cuoi/' }; }
  if (u.protocol !== 'https:') return { error: 'Hãy dùng địa chỉ bắt đầu bằng https://' };
  const h = u.hostname;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || /^127\./.test(h) || h === '[::1]'
    || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
    return { error: 'Đây là địa chỉ trên máy/mạng nội bộ — khách mời sẽ không mở được. Hãy nhập địa chỉ website thật.' };
  }
  u.search = '';
  u.hash = '';
  // GitHub Pages sub-paths: keep the path, make sure a folder path ends with "/"
  if (!u.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(u.pathname)) u.pathname += '/';
  return { url: u.toString() };
}

const personalUrl = (g) => (base ? `${base}?khach=${encodeURIComponent(g.name)}&id=${g.id}` : '');
const previewUrl = (g) => `${location.origin}/?khach=${encodeURIComponent(g.name)}&id=${g.id}`; // this computer

async function copy(text, toastEl) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.append(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  toast(toastEl, ok ? 'Đã sao chép!' : 'Không sao chép được — hãy chọn và sao chép thủ công.', !ok);
  return ok;
}

function toast(el, msg, bad = false) {
  el.textContent = msg;
  el.classList.toggle('bad', bad);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function say(el, msg, kind = '') {
  el.textContent = msg;
  el.className = `hint ${kind}`;
}

// ------------------------------------------------------------------ base url
function applyBase(raw, announce) {
  const r = normaliseBase(raw);
  if (r.error) {
    if (announce) say(els.baseMsg, r.error, 'bad');
    return false;
  }
  base = r.url;
  save(LS_BASE, base);
  els.base.value = base;
  if (announce) say(els.baseMsg, `Đã lưu: ${base}`, 'good');
  render();
  return true;
}
els.baseSave.addEventListener('click', () => applyBase(els.base.value, true));
els.base.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyBase(els.base.value, true); } });

// ------------------------------------------------------------------ new link
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!base && !applyBase(els.base.value, true)) { els.base.focus(); return; }
  const name = cleanName(els.name.value);
  if (!name) {
    say(els.guestMsg, 'Chưa nhập tên. Khách không ghi tên thì dùng LINK THIỆP CHUNG bên dưới.', 'bad');
    els.name.focus();
    return;
  }
  if (name.length > MAX_NAME) {
    say(els.guestMsg, `Tên dài quá (${name.length} ký tự). Tối đa ${MAX_NAME} ký tự.`, 'bad');
    return;
  }
  const existing = guests.filter((g) => sameName(g.name, name));
  if (existing.length) {
    const again = window.confirm(`Đã có ${existing.length} link cho “${name}”.\n\nBấm OK để tạo thêm một link MỚI (cho một khách khác trùng tên).\nBấm Huỷ để dùng lại link đã có.`);
    if (!again) {
      showResult(existing[existing.length - 1]);
      say(els.guestMsg, 'Đang hiện link đã có — mã khách giữ nguyên.', 'good');
      return;
    }
  }
  const g = { id: newId(), name, createdAt: new Date().toISOString() };
  guests.unshift(g);
  save(LS_GUESTS, guests);
  els.name.value = '';
  say(els.guestMsg, `Đã tạo link cho “${name}”.`, 'good');
  showResult(g);
  render();
});

function showResult(g) {
  lastId = g.id;
  els.result.hidden = false;
  els.resultName.textContent = `${g.name} · mã ${g.id}`;
  els.resultUrl.textContent = personalUrl(g) || '(hãy nhập đường dẫn website ở trên)';
}
els.resultCopy.addEventListener('click', () => {
  const g = guests.find((x) => x.id === lastId);
  if (g && base) copy(personalUrl(g), els.resultToast);
});
els.resultPreview.addEventListener('click', () => {
  const g = guests.find((x) => x.id === lastId);
  if (g) window.open(previewUrl(g), '_blank', 'noopener');
});

// ------------------------------------------------------------------ generic link
els.genericCopy.addEventListener('click', () => {
  if (!base) { say(els.baseMsg, 'Hãy nhập địa chỉ website thiệp cưới trước.', 'bad'); els.base.focus(); return; }
  copy(base, els.genericToast);
});
els.genericPreview.addEventListener('click', () => window.open(`${location.origin}/`, '_blank', 'noopener'));

// ------------------------------------------------------------------ list
function render() {
  els.genericUrl.textContent = base || '(hãy nhập đường dẫn website ở trên)';
  if (lastId) { const g = guests.find((x) => x.id === lastId); if (g) showResult(g); }
  const q = els.search.value.trim().normalize('NFC').toLocaleLowerCase('vi');
  const shown = q ? guests.filter((g) => g.name.normalize('NFC').toLocaleLowerCase('vi').includes(q)) : guests;
  els.count.textContent = guests.length ? `(${shown.length}/${guests.length})` : '';
  els.empty.hidden = guests.length > 0;
  els.rows.replaceChildren(...shown.map((g) => {
    const tr = document.createElement('tr');
    const td = (cls, label, content) => {
      const c = document.createElement('td');
      c.className = cls;
      c.dataset.label = label;
      if (content instanceof Node) c.append(content); else c.textContent = content;
      tr.append(c);
      return c;
    };
    td('name', 'Tên khách', g.name);
    td('id', 'Mã khách', g.id);
    const link = document.createElement('code');
    link.className = 'url small';
    link.textContent = personalUrl(g) || '—';
    td('link', 'Link thiệp', link);
    const acts = td('act', 'Thao tác', '');
    const btn = (text, cls, fn) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: `btn ${cls}`, textContent: text });
      b.addEventListener('click', fn);
      acts.append(b);
      return b;
    };
    const t = Object.assign(document.createElement('span'), { className: 'toast' });
    btn('SAO CHÉP', 'primary sm', () => { if (base) copy(personalUrl(g), t); else say(els.baseMsg, 'Hãy nhập địa chỉ website thiệp cưới trước.', 'bad'); });
    btn('XEM TRƯỚC', 'ghost sm', () => window.open(previewUrl(g), '_blank', 'noopener'));
    btn('XOÁ', 'danger sm', () => {
      if (!window.confirm(`Xoá link của “${g.name}” khỏi danh sách?\n\n(Link đã gửi cho khách vẫn mở được thiệp.)`)) return;
      guests = guests.filter((x) => x.id !== g.id);
      save(LS_GUESTS, guests);
      if (lastId === g.id) { lastId = null; els.result.hidden = true; }
      render();
    });
    acts.append(t);
    return tr;
  }));
}
els.search.addEventListener('input', render);

// ------------------------------------------------------------------ CSV (UTF-8 with BOM so Excel keeps Vietnamese)
els.exportBtn.addEventListener('click', () => {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['guest_id', 'guest_name', 'invitation_url'].join(',')]
    .concat(guests.map((g) => [g.id, g.name, personalUrl(g)].map(esc).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `khach-moi-minh-thuy-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});

// ------------------------------------------------------------------ start
if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) $('local-warn').hidden = false;
if (base) els.base.value = base;
render();
