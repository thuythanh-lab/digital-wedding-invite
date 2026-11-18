/**
 * Wedding details — the ONLY place they are written.
 * Edit here to update the invitation; no scene code needs to change.
 */
export const WEDDING = {
  couple: 'MINH & THỦY',
  tagline: 'Một chương mới sắp bắt đầu...',
  date: '24.12.2026',
  weekday: 'THỨ NĂM',
  time: '11:00',
  eventName: 'TIỆC CƯỚI',
  venueName: 'SEASONS',
  venueFullName: 'SEASONS EVENTS & CONFERENCES',
  venueFloor: 'Tầng 2 & 3, tòa nhà VCCI',
  venueAddress: '9 Đào Duy Anh, Hà Nội',
  // Machine-readable, for later use (calendar links, RSVP) — not displayed.
  startsAt: '2026-12-24T11:00:00+07:00',
  // Google Maps link from Seasons' official website (verified by Minh & Thủy).
  // The "📍 XEM ĐƯỜNG ĐI" button only appears when this is set.
  mapUrl: 'https://maps.app.goo.gl/rNnmcg2bZFmnGfDZ6',
};

/** "11:00 — TIỆC CƯỚI" */
export const timeLine = (w = WEDDING) => `${w.time} — ${w.eventName}`;
