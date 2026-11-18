# RSVP → Google Sheets (Apps Script)

The invitation posts each answer to the web app in `.env`
(`VITE_RSVP_ENDPOINT`). It shows success **only** if the reply is JSON with
`"ok": true` (also accepted: `"result": "success"` / `"status": "success"`).

## What was checked (18.11.2026)

- The deployed URL is reachable without signing in (a GET returned Google's
  page *“Không tìm thấy hàm tập lệnh: doGet”* — the script has no `doGet`).
- One labelled test answer was sent (name *TEST - xoa dong nay*, id
  `test-deploy-check`): the deployed `doPost` replied HTTP 200 with the plain
  text `ok`. The invitation accepts exactly that (or JSON `"ok": true`) as success.
- **Still to check in the sheet:** which columns that test row filled (guest id,
  name, RSVP, time?), and whether answering again *updates* the row or adds a
  new one. Delete the TEST rows afterwards.

## Option A — use the reference script (recommended)

1. Open the Google Sheet → **Tiện ích mở rộng → Apps Script**.
2. Compare the current code with `Code.gs` here. If yours already does the same
   (JSON in, `{ "ok": true }` out), keep it.
3. Otherwise paste `Code.gs` (it uses a sheet tab named **RSVP** with the columns
   `Guest ID | Guest Name | RSVP | Submitted At`, created automatically; it does
   not touch other tabs).
4. **Triển khai → Quản lý các bản triển khai → ✏ Chỉnh sửa → Phiên bản: Phiên bản
   mới → Triển khai.** Editing the existing deployment keeps the same `/exec`
   URL, so the invitation needs no change. (Thực thi với tư cách: *Tôi*; Ai có
   quyền truy cập: *Bất kỳ ai*.)
5. Open the `/exec` URL in a browser: it should show `{"ok":true,"service":"rsvp"}`.

## Testing without polluting the real sheet

- On this computer (`localhost`) the invitation writes to `rsvp-data/rsvps.json`,
  never to Google — unless you open it with `?rsvpLive=1`.
- For one live test: open `http://localhost:5174/?khach=TEST&id=test-xoa-dong-nay&rsvpLive=1`,
  answer, check that a row *TEST / test-xoa-dong-nay* appears (answer again → the
  same row changes), then delete that row.
