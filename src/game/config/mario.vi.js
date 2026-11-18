// All guest-facing text of the platform-game invitation.
// Wedding facts (date, time, venue) live in event.vi.js.

export const MARIO_TEXT = {
  loading: 'LOADING...',
  ready: 'SẴN SÀNG CHƯA?',
  start: 'CHƠI THÔI!',

  // Opening
  greeting: (n) => (n ? `Gửi ${n},` : 'Gửi bạn,'),
  inviteLine: 'Có một lời mời dành cho bạn!',
  scrollHint: '↑  VUỐT LÊN ĐỂ TIẾP TỤC',
  // Title screen — the name is shown exactly as given in the link (no added
  // titles/honorifics), upper-cased in Vietnamese.
  titleQuestion: (n) => `${n.toLocaleUpperCase('vi')}, SẴN SÀNG CHƯA?`,
  titleQuestionAnon: 'BẠN SẴN SÀNG CHƯA?',
  startButton: '▶ BẮT ĐẦU',
  skip: 'BỎ QUA ▸▸',
  quickView: 'XEM THÔNG TIN THIỆP',
  quickPlay: '▶ VÀO GAME',
  quickBack: '↩ QUAY LẠI GAME',
  quickPhotos: (n) => `📷 KHOẢNH KHẮC BÍ MẬT (${n}/3)`,
  infoButton: 'THIỆP',
  infoButtonLabel: 'Xem thông tin thiệp cưới',

  // Venue
  partyLabel: 'TIỆC CƯỚI',
  venueArrow: 'SEASONS',
  mapButton: '📍 XEM ĐƯỜNG ĐI',
  mapButtonLabel: 'Xem đường đi đến Seasons trên Google Maps (mở thẻ mới)',

  // RSVP
  rsvpQuestion: (n) => `${n}, bạn sẽ đến chung vui chứ?`,
  rsvpQuestionAnon: 'Bạn sẽ đến chung vui chứ?',
  rsvpNameLabel: 'TÊN CỦA BẠN',
  rsvpYes: 'CÓ, MÌNH SẼ ĐẾN!',
  rsvpNo: 'TIẾC QUÁ, MÌNH KHÔNG ĐẾN ĐƯỢC',
  rsvpNeedName: 'Bạn nhập tên giúp Minh & Thủy nhé!',
  rsvpSending: 'Đang gửi...',
  rsvpError: 'Chưa gửi được phản hồi. Bạn thử lại nhé!',
  // shown in the RSVP box once the backend has confirmed the answer
  rsvpSavedYes: ['ĐÃ XÁC NHẬN!', 'Hẹn gặp bạn tại Seasons!'],
  rsvpSavedNo: ['ĐÃ GHI NHẬN!', 'Cảm ơn bạn đã phản hồi!'],
  rsvpRetryTag: 'THỬ LẠI',
  rsvpNotConfigured: 'Hệ thống RSVP chưa sẵn sàng. Bạn báo Minh & Thủy giúp nhé!',

  // Ending (finish-line banner)
  doneYesTitle: 'HẸN GẶP Ở SEASONS!',
  doneYesLine: (time, date) => `${time} · ${date}`,
  doneNoTitle: 'CẢM ƠN BẠN NHÉ!',
  doneNoLine: 'HẸN GẶP DỊP KHÁC!',
  // Venue card tag after a confirmed RSVP
  cardTagYes: '♥ HẸN GẶP Ở SEASONS!',
  cardTagNo: '♥ CẢM ƠN BẠN NHÉ!',
  // Quick view: the saved answer
  answeredYes: '✓ Bạn đã trả lời: CÓ, MÌNH SẼ ĐẾN! Hẹn gặp bạn ở Seasons nhé!',
  answeredNo: '✓ Bạn đã trả lời: không đến được. Cảm ơn bạn nhé!',

  // HUD + photos
  photosHud: (n) => `ẢNH ĐÃ TÌM: ${n}/3`,
  photoFound: 'ĐÃ TÌM THẤY!',
  photoGift: 'TẶNG BẠN NÈ!',
  photoMoment: (nn) => `KHOẢNH KHẮC #${nn}`,
  photoMissing: 'Ảnh sẽ được cập nhật sớm!',
  photoLocked: 'Chưa tìm thấy',
  photoCount: (n) => `ẢNH ĐÃ TÌM: ${n}/3`,
  photoHintNote: 'Gợi ý: đồng xu vàng có hình máy ảnh — chạm vào để mở!',
  photoUnlockNote: 'Chạm vào ô “?” để mở luôn nhé!',
  photoHint1: 'Sau bụi cây chỗ chú rùa',
  photoHint2: 'Sau tấm lịch cưới',
  photoHint3: 'Trong vách đất cạnh ống nước',

  review: '▲ XEM LẠI THIỆP',
  replay: '↺ CHƠI LẠI',
  gallery: 'XEM KHOẢNH KHẮC',
  change: 'ĐỔI CÂU TRẢ LỜI',
};
