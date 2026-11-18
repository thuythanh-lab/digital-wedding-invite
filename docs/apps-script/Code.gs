/**
 * Minh & Thủy — RSVP web app (Google Apps Script, bound to the RSVP Google Sheet).
 *
 * REFERENCE SCRIPT: this is the contract the invitation (src/game/mario/rsvp.js)
 * expects. Compare it with the script that is currently deployed before
 * replacing anything (see README.md in this folder).
 *
 * Request  (POST, body = JSON text, sent as text/plain so there is no CORS pre-flight):
 *   { "guestId": "k7m2q9x4ra",        // personal link id, or "web-…" for the generic link
 *     "name": "Anh Tuấn",
 *     "attending": true,               // true = CÓ, MÌNH SẼ ĐẾN! · false = TIẾC QUÁ, MÌNH KHÔNG ĐẾN ĐƯỢC
 *     "rsvp": "Attending" | "Declined",
 *     "answer": "yes" | "no",
 *     "linkType": "personal" | "generic",
 *     "submittedAt": "2026-11-18T12:00:00.000Z" }
 *
 * Response (JSON):
 *   { "ok": true, "updated": false }   new guest → new row
 *   { "ok": true, "updated": true }    same guestId again → that guest's row is updated
 *   { "ok": false, "error": "…" }      nothing saved (the invitation then shows “thử lại”)
 *
 * Sheet "RSVP", one current row per guest:
 *   Guest ID | Guest Name | RSVP | Submitted At
 */

const SHEET_NAME = 'RSVP';
const HEADERS = ['Guest ID', 'Guest Name', 'RSVP', 'Submitted At'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // two guests answering at once never overwrite each other
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const guestId = String(data.guestId || '').replace(/[^\w-]/g, '').slice(0, 64);
    const name = String(data.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    if (!guestId || !name || typeof data.attending !== 'boolean') return json({ ok: false, error: 'invalid' });
    const rsvp = data.attending ? 'Attending' : 'Declined';
    const submittedAt = isNaN(Date.parse(data.submittedAt)) ? new Date().toISOString() : String(data.submittedAt);

    const sheet = getSheet();
    const row = [guestId, name, rsvp, submittedAt];
    const last = sheet.getLastRow();
    let found = -1;
    if (last > 1) {
      const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === guestId) { found = i + 2; break; }
    }
    if (found > 0) sheet.getRange(found, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return json({ ok: true, updated: found > 0 });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* not held */ }
  }
}

/** Health check (no data): opening the /exec URL shows {"ok":true,"service":"rsvp"}. */
function doGet() {
  return json({ ok: true, service: 'rsvp' });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
