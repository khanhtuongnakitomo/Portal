import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Locale = 'vi' | 'en'

// Dictionary containing translations for Vietnamese and English
export const translations = {
  vi: {
    common: {
      appName: 'Hệ thống đặt phòng dành cho TNE - UTS',
      cancel: 'Hủy',
      save: 'Lưu thay đổi',
      close: 'Đóng',
      back: 'Quay lại',
      confirm: 'Xác nhận',
      submit: 'Gửi yêu cầu',
      search: 'Tìm kiếm...',
      loading: 'Đang tải...',
      all: 'Tất cả',
      required: 'Bắt buộc',
      optional: 'Không bắt buộc',
      active: 'Hoạt động',
      overdue: 'Quá hạn',
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      completed: 'Hoàn thành',
      rejected: 'Từ chối',
      cancelled: 'Đã hủy',
      date: 'Ngày',
      time: 'Giờ',
      room: 'Phòng',
      hours: 'Giờ mở cửa',
      maxLength: 'Thời lượng tối đa',
      activeBookings: 'Đang mượn',
      edit: 'Chỉnh sửa',
      remove: 'Xóa',
      status: 'Trạng thái',
      phone: 'Số điện thoại',
      duration: 'Thời lượng',
      notes: 'Ghi chú',
      reason: 'Lý do',
    },
    nav: {
      bookRoom: 'Đặt phòng',
      myBookings: 'Lịch đặt của tôi',
      profile: 'Hồ sơ cá nhân & Mã SV',
      logout: 'Đăng xuất',
      deskEmail: 'Email Quản lý',
      keyCustody: 'Quản lý chìa khóa',
      approvalBoard: 'Bảng duyệt yêu cầu',
      assignActivity: 'Phân bổ hoạt động / Sự kiện',
      weekGrid: 'Lưới tuần · Theo phòng',
      dayMatrix: 'Ma trận ngày · Tất cả phòng',
      backToStudent: 'Quay lại Bàn Sinh viên',
      backToManager: 'Quay lại Bàn Quản lý',
      backToAdmin: 'Quay lại Bàn Quản trị',
      credentials: 'Mã số sinh viên',
    },
    lang: {
      switchLanguage: 'Ngôn ngữ',
      vietnamese: 'Tiếng Việt',
      english: 'English',
      viShort: 'VI',
      enShort: 'EN',
    },
    key: {
      custodyTitle: 'QUẢN LÝ CHÌA KHÓA PHÒNG',
      custodySub: 'Chìa khóa vật lý lấy và trả trực tiếp tại Phòng Manager · Theo dõi sinh viên chịu trách nhiệm và truy vết',
      notReturned: 'Chưa trả chìa',
      notReturnedDesc: 'Sinh viên đang giữ chìa khóa phòng',
      notIssued: 'Chưa đưa chìa',
      notIssuedDesc: 'Chờ sinh viên qua phòng Manager lấy',
      returned: 'Đã trả chìa',
      returnedDesc: 'Đã nhận lại chìa tại phòng Manager',
      allKeys: 'Tất cả',
      overdueBadge: 'QUÁ HẠN CHƯA TRẢ',
      overdueLate: 'Trễ',
      remaining: 'còn lại',
      issueKeyBtn: 'Đã đưa chìa khóa cho SV',
      confirmReturnBtn: 'Xác nhận đã trả chìa',
      inspectBtn: 'Xem chi tiết',
      step1Title: '1. Chưa đưa chìa (Chờ lấy tại phòng Manager)',
      step1Desc: 'Sinh viên có lịch đã duyệt qua phòng Manager để lấy chìa. Manager đưa chìa và bấm nút [Đã đưa chìa khóa].',
      step2Title: '2. Chưa trả (Sinh viên đang giữ chìa khóa)',
      step2Desc: 'Theo dõi thời gian sử dụng phòng. Nếu quá giờ chưa trả, hệ thống báo đỏ [Quá hạn] để liên hệ.',
      step3Title: '3. Đã trả (Nhận lại chìa tại phòng Manager)',
      step3Desc: 'Sinh viên dùng xong mang chìa trả lại phòng Manager. Manager bấm nút xanh [Xác nhận đã trả chìa].',
      responsibleStudent: 'Sinh viên chịu trách nhiệm (Giữ chìa)',
      groupMembers: 'Thành viên cùng tham gia',
      accountabilityRoster: 'Danh sách truy vết',
      bookingWindow: 'Khung giờ đặt phòng',
      issuedAt: 'Đã đưa chìa lúc',
      returnedAt: 'Đã trả chìa',
      activity: 'Nội dung hoạt động',
      orderId: 'Mã đơn',
      noKeysOut: 'Hiện không có phòng nào chưa trả chìa khóa',
      noKeysOutSub: 'Tất cả chìa khóa phòng đã được sinh viên bàn giao trả về phòng Manager an toàn.',
      noKeysReady: 'Hiện không có đơn nào đang chờ giao chìa khóa',
      noKeysReturned: 'Chưa có lịch sử trả chìa khóa khớp bộ lọc',
      emptyKeyList: 'Khi sinh viên qua phòng Manager lấy hoặc trả chìa khóa phòng, danh sách và trạng thái sẽ hiển thị tại đây.',
      roomFilter: 'PHÒNG:',
      searchPlaceholder: 'Tìm SV, MSSV...',
    },
    student: {
      eyebrow: 'KHÔNG GIAN SINH VIÊN · ĐẶT PHÒNG HỌC',
      heroTitle: 'Đặt phòng học. Nhận chìa khóa.',
      heroBody: 'Chọn phòng, sau đó kéo chọn khung giờ còn trống trong tuần. Đặt trước từ 2 đến 7 ngày; nhận và trả chìa khóa tại phòng Manager.',
      allRooms: 'TẤT CẢ PHÒNG',
      combined: 'Tổng hợp 601 · 602 · 605',
      approval: 'DUYỆT BỞI',
      managerRole: 'MANAGER',
      keyPickup: 'NƠI LẤY CHÌA',
      managerOffice: 'PHÒNG MANAGER',
      howItWorks: 'HƯỚNG DẪN ĐẶT PHÒNG',
      step1: 'Kéo chọn các khung giờ còn trống trên lịch tuần.',
      step2: 'Điền thông tin thành viên, lý do mượn phòng và cam kết trách nhiệm.',
      step3: 'Chờ Manager duyệt yêu cầu, sau đó qua phòng Manager nhận chìa khóa.',
      openMyBookings: 'Xem các phòng đã đặt',
      myBookingsTitle: 'Lịch Đặt Phòng Của Tôi',
      passTitle: 'CHÌA KHÓA PHÒNG • NHẬN & TRẢ TẠI PHÒNG MANAGER',
      passNotIssued: 'CHƯA LẤY CHÌA · QUA PHÒNG MANAGER ĐỂ NHẬN',
      passInCustody: 'CHƯA TRẢ CHÌA · ĐANG GIỮ CHÌA KHÓA PHÒNG',
      passOverdue: 'QUÁ HẠN · VUI LÒNG TRẢ CHÌA VỀ PHÒNG MANAGER NGAY',
      returnBefore: 'TRẢ TRƯỚC',
      holder: 'NGƯỜI ĐẶT',
      hcmutId: 'MÃ SỐ HCMUT',
      utsId: 'MÃ SỐ UTS',
      membersList: 'DANH SÁCH THÀNH VIÊN THAM GIA',
    },
    bookingModal: {
      modalTitle: 'Yêu cầu đặt phòng học',
      modalEyebrow: 'PHIẾU ĐẶT PHÒNG HỌC TNE',
      roomLabel: 'Phòng học',
      dateLabel: 'Ngày mượn',
      timeLabel: 'Khung giờ',
      attendeesLabel: 'Số người tham gia',
      phoneLabel: 'Số điện thoại liên hệ',
      phoneHint: 'Dùng để Manager liên hệ giao nhận chìa',
      titleLabel: 'Tên hoạt động / Buổi học',
      titlePlaceholder: 'e.g. Họp nhóm Capstone sprint review',
      purposeLabel: 'Mục đích sử dụng',
      purposePlaceholder: 'e.g. Thảo luận đồ án tốt nghiệp cùng nhóm và giảng viên',
      membersLabel: 'Thành viên nhóm cùng tham gia',
      membersRequired: 'BẮT BUỘC',
      membersHint: 'Tối thiểu 1 thành viên · Nhập tách biệt mã số HCMUT và UTS để đối chiếu',
      addMemberBtn: '+ THÊM THÀNH VIÊN',
      fullNameCol: 'HỌ VÀ TÊN *',
      fullNamePlaceholder: 'e.g. Trần Văn An',
      hcmutIdCol: 'MSSV HCMUT (7 CHỮ SỐ)',
      utsIdCol: 'MSSV UTS (8 CHỮ SỐ)',
      responsibilityText: 'Tôi cam kết chịu toàn bộ trách nhiệm về việc bảo quản phòng, trang thiết bị, vệ sinh và các hoạt động diễn ra trong buổi mượn.',
      submitBtn: 'Gửi yêu cầu đặt phòng',
      memberNum: 'THÀNH VIÊN',
    },
    profile: {
      eyebrow: '01 / TÀI KHOẢN · CÀI ĐẶT',
      title: 'Hồ sơ cá nhân & Mã số sinh viên',
      body: 'Quản lý thông tin định danh chính thức, mã số sinh viên HCMUT & UTS, và thông tin tài khoản trên hệ thống TNE - UTS.',
      officialIdentity: '01 / ĐỊNH DANH HỌC THUẬT CHÍNH THỨC',
      cardSubtitle: 'Xác thực tài khoản & Thẻ sinh viên',
      fullNameLabel: 'HỌ VÀ TÊN',
      fullNameHint: 'Bắt buộc · Họ tên hiển thị trên nhật ký đặt phòng và biên bản mượn chìa',
      emailLabel: 'EMAIL TRƯỜNG ĐĂNG KÝ',
      emailHint: 'Khóa theo tài khoản SSO trường đại học',
      emailSubtext: 'Email trường đã được xác thực qua cổng đăng nhập tập trung SSO.',
      identifiersTitle: 'MÃ SỐ SINH VIÊN CÁC TRƯỜNG LIÊN KẾT',
      identifiersNote: 'Cả mã số HCMUT và UTS đều cần thiết để phục vụ đối soát, mượn chìa khóa và bảo an tòa nhà.',
      hcmutLabel: 'MÃ SỐ SINH VIÊN HCMUT (7 SỐ)',
      hcmutHint: '7 chữ số theo sổ sinh viên ĐH Bách Khoa.',
      utsLabel: 'MÃ SỐ SINH VIÊN UTS (8 SỐ)',
      utsHint: '8 chữ số đã đăng ký với UTS Sydney.',
      staffIdLabel: 'MÃ ĐỊNH DANH NHÂN VIÊN',
      staffIdSub: 'Mã số nhân viên nội bộ có quyền quản trị cơ sở vật chất.',
      cancelBtn: 'Hủy bỏ',
      saveBtn: 'Lưu thay đổi',
      savingBtn: 'Đang lưu...',
      policyTitle: '02 / NỘI QUY CƠ SỞ VẬT CHẤT & SỬ DỤNG PHÒNG',
      maxSlotTitle: 'Thời lượng tối đa',
      maxSlotVal: '2 Giờ',
      maxSlotSub: 'Mỗi lượt mượn phòng cá nhân hoặc nhóm.',
      advanceTitle: 'Khung đặt trước',
      advanceVal: '2 - 7 Ngày',
      advanceSub: 'Mở đặt trước tối thiểu 2 ngày.',
      custodyTitle: 'Quản lý chìa khóa',
      custodyVal: "Phòng Manager",
      custodySub: 'Lấy và trả chìa khóa trực tiếp tại phòng Manager.',
      credentialTitle: 'THẺ ĐỊNH DANH ĐIỆN TỬ',
      verifiedIdentity: 'ĐÃ XÁC THỰC DANH TÍNH',
      accessLevel: 'QUYỀN TRUY CẬP TẦNG 6',
      quickNav: 'Điều hướng nhanh',
      signOut: 'Đăng xuất tài khoản',
      returnWorkspace: 'Quay lại',
      successUpdate: 'Hồ sơ và thông tin mã số sinh viên đã được cập nhật thành công.',
    },
    manager: {
      title: 'Bàn Vận Hành Cơ Sở Vật Chất',
      subtitle: 'Phê duyệt đặt phòng, bàn giao chìa khóa và quản lý lịch học TNE',
      roomTabs: 'Danh sách phòng',
      approvalCount: 'Chờ duyệt',
      assignedActivities: 'Lịch hoạt động & Sự kiện',
      assignActivityBtn: '+ Gán hoạt động / Sự kiện',
      competingRequests: 'YÊU CẦU TRÙNG KHUNG GIỜ',
      approveBtn: 'Duyệt yêu cầu',
      rejectBtn: 'Từ chối',
      approveAndDeclineOther: 'Duyệt & Tự động từ chối đơn trùng',
      reviewNote: 'Ghi chú / Lý do từ chối',
      reviewNotePlaceholder: 'Chọn lý do nhanh bên dưới hoặc nhập ghi chú...',
      presetReasons: 'Lý do từ chối mẫu:',
      sectionsNav: 'PHÂN HỆ VẬN HÀNH',
      approvalSection: {
        eyebrow: '01 / HÀNG ĐỢI XÉT DUYỆT · THAO TÁC 1-CHẠM',
        title: 'Hàng đợi phê duyệt đơn đặt phòng',
        subtitle: 'Kiểm tra, xét duyệt nhanh hoặc từ chối các yêu cầu đặt phòng đang chờ từ sinh viên trước khi vào lịch chính thức.',
        collapseBtn: 'Thu gọn',
        expandBtn: 'Mở rộng',
        pendingBadge: 'YÊU CẦU CHỜ DUYỆT',
        noPending: 'Hiện không có đơn nào chờ duyệt',
      },
      scheduleSection: {
        eyebrow: '02 / THỜI KHÓA BIỂU & LỊCH SỬ DỤNG PHÒNG',
        title: 'Thời khóa biểu & Lịch phòng học',
        subtitle: 'Giám sát và điều phối lịch phòng 601, 602, 605 theo tuần. Kéo chọn ô trống để gán sự kiện hoặc khóa phòng.',
      },
      keySection: {
        eyebrow: '03 / QUẢN LÝ CHÌA KHÓA PHÒNG · BÀN GIAO TRỰC TIẾP',
        title: 'Bàn quản lý mượn & trả chìa khóa phòng',
        subtitle: 'Theo dõi và xử lý vòng đời chìa khóa vật lý: Chưa đưa chìa (Chờ lấy) → Chưa trả (Đang mượn) → Đã trả chìa (Hoàn tất tại phòng Manager).',
      },
    },
    auth: {
      welcome: 'Hệ thống đặt phòng dành cho TNE - UTS',
      signInTitle: 'Đăng nhập hệ thống',
      signUpTitle: 'Đăng ký tài khoản',
      emailLabel: 'Email trường (@tne.edu.vn)',
      passwordLabel: 'Mật khẩu',
      fullNameLabel: 'Họ và tên đầy đủ',
      signInBtn: 'Đăng nhập',
      signUpBtn: 'Tạo tài khoản',
      noAccount: 'Chưa có tài khoản?',
      hasAccount: 'Đã có tài khoản?',
    },
  },
  en: {
    common: {
      appName: 'Room Booking System for TNE - UTS',
      cancel: 'Cancel',
      save: 'Save Changes',
      close: 'Close',
      back: 'Back',
      confirm: 'Confirm',
      submit: 'Submit Request',
      search: 'Search...',
      loading: 'Loading...',
      all: 'All',
      required: 'Required',
      optional: 'Optional',
      active: 'Active',
      overdue: 'Overdue',
      pending: 'Pending',
      approved: 'Approved',
      completed: 'Completed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      date: 'Date',
      time: 'Time',
      room: 'Room',
      hours: 'Operating Hours',
      maxLength: 'Max Length',
      activeBookings: 'Active',
      edit: 'Edit',
      remove: 'Remove',
      status: 'Status',
      phone: 'Phone number',
      duration: 'Duration',
      notes: 'Notes',
      reason: 'Reason',
    },
    nav: {
      bookRoom: 'Book a room',
      myBookings: 'My bookings',
      profile: 'Personal Profile & IDs',
      logout: 'Log out',
      deskEmail: 'Desk Email',
      keyCustody: 'Key Custody',
      approvalBoard: 'Approval Board',
      assignActivity: 'Assign Activity / Event',
      weekGrid: 'Week Grid · By Room',
      dayMatrix: 'Day Matrix · All Rooms',
      backToStudent: 'Back to Student Workspace',
      backToManager: 'Back to Manager Desk',
      backToAdmin: 'Back to Admin Console',
      credentials: 'Student Credentials',
    },
    lang: {
      switchLanguage: 'Language',
      vietnamese: 'Tiếng Việt',
      english: 'English',
      viShort: 'VI',
      enShort: 'EN',
    },
    key: {
      custodyTitle: 'ROOM KEY CUSTODY & TRACKER',
      custodySub: 'Physical room keys picked up and returned directly at Manager Office · Student accountability and tracing',
      notReturned: 'Key Not Returned',
      notReturnedDesc: 'Student currently holding room key',
      notIssued: 'Key Not Handed Out',
      notIssuedDesc: 'Waiting for student pickup at Manager Office',
      returned: 'Key Returned',
      returnedDesc: 'Returned to Manager Office',
      allKeys: 'All Keys',
      overdueBadge: 'OVERDUE RETURN',
      overdueLate: 'Late',
      remaining: 'left',
      issueKeyBtn: 'Issue Key to Student',
      confirmReturnBtn: 'Confirm Key Returned',
      inspectBtn: 'Inspect',
      step1Title: '1. Not Handed Out (Pickup at Manager Office)',
      step1Desc: 'Students with approved bookings come to Manager Office. Manager clicks [Issue Key to Student].',
      step2Title: '2. Not Returned (Student holding room key)',
      step2Desc: 'Track room usage time. Overdue alerts trigger if the key is not returned on time.',
      step3Title: '3. Returned (Received at Manager Office)',
      step3Desc: 'Student returns key to Manager Office. Manager clicks [Confirm Key Returned].',
      responsibleStudent: 'Responsible Student (Key Holder)',
      groupMembers: 'Participating Team Members',
      accountabilityRoster: 'Accountability Roster',
      bookingWindow: 'Reservation Window',
      issuedAt: 'Key Handed Out',
      returnedAt: 'Key Returned',
      activity: 'Activity / Session Purpose',
      orderId: 'Booking ID',
      noKeysOut: 'All room keys are safely in Manager Office',
      noKeysOutSub: 'All room keys have been safely returned by students to the Manager Office.',
      noKeysReady: 'No approved bookings currently waiting for key pickup',
      noKeysReturned: 'No key return records matching the current filter',
      emptyKeyList: 'When students arrive to check out or return physical keys, status updates will reflect here.',
      roomFilter: 'ROOM:',
      searchPlaceholder: 'Search student, ID...',
    },
    student: {
      eyebrow: 'STUDENT WORKSPACE · ROOM RESERVATION',
      heroTitle: 'Reserve a room. Collect the key.',
      heroBody: 'Choose a room tab, then drag across open slots in the weekly ledger. Bookings open two to seven days ahead; collect and return the physical key at Manager Office.',
      allRooms: 'ALL ROOMS',
      combined: '601 · 602 · 605 Combined',
      approval: 'APPROVAL',
      managerRole: 'MANAGER',
      keyPickup: 'KEY PICKUP',
      managerOffice: "MANAGER'S OFFICE",
      howItWorks: 'HOW IT WORKS',
      step1: 'Drag across open slots on a highlighted day.',
      step2: 'Confirm your contact details, member IDs, and purpose in the ledger entry.',
      step3: 'Wait for Manager approval, then collect the physical key at Manager Office.',
      openMyBookings: 'Open my bookings',
      myBookingsTitle: 'My Reservations',
      passTitle: "ROOM KEY • PICK UP & RETURN AT MANAGER'S OFFICE",
      passNotIssued: 'KEY NOT ISSUED · PICK UP AT MANAGER OFFICE',
      passInCustody: 'KEY IN CUSTODY · NOT RETURNED',
      passOverdue: 'OVERDUE · RETURN KEY TO MANAGER OFFICE NOW',
      returnBefore: 'RETURN BEFORE',
      holder: 'HOLDER',
      hcmutId: 'HCMUT ID',
      utsId: 'UTS ID',
      membersList: 'PARTICIPATING MEMBERS',
    },
    bookingModal: {
      modalTitle: 'Reserve a room',
      modalEyebrow: 'ROOM RESERVATION ENTRY',
      roomLabel: 'Room',
      dateLabel: 'Date',
      timeLabel: 'Time Window',
      attendeesLabel: 'Attendee Count',
      phoneLabel: 'Phone number',
      phoneHint: 'Used for manager contact & key pickup',
      titleLabel: 'Booking title',
      titlePlaceholder: 'e.g. Capstone sprint review',
      purposeLabel: 'Purpose / Session notes',
      purposePlaceholder: 'e.g. Weekly progress review with supervisor and team',
      membersLabel: 'Participating Group Members',
      membersRequired: 'REQUIRED',
      membersHint: 'Min 1 member · Separate HCMUT and UTS IDs for facility verification',
      addMemberBtn: '+ ADD MEMBER',
      fullNameCol: 'FULL NAME *',
      fullNamePlaceholder: 'e.g. Tran Van An',
      hcmutIdCol: 'HCMUT ID (7 DIGITS)',
      utsIdCol: 'UTS ID (8 DIGITS)',
      responsibilityText: 'I accept full responsibility for room custody, equipment preservation, cleanliness, and all activities conducted during this reservation.',
      submitBtn: 'Submit Reservation',
      memberNum: 'MEMBER',
    },
    profile: {
      eyebrow: '01 / ACCOUNT · SETTINGS',
      title: 'Personal Profile & Institutional Credentials',
      body: 'Manage your official identity, institutional student IDs, and credential details registered in the UTS-TNE facility booking ledger.',
      officialIdentity: '01 / OFFICIAL ACADEMIC IDENTITY',
      cardSubtitle: 'Account & Identity Verification',
      fullNameLabel: 'FULL NAME',
      fullNameHint: 'Required · Official display name for room reservations and custody sign-off',
      emailLabel: 'REGISTERED INSTITUTIONAL EMAIL',
      emailHint: 'Locked to institutional SSO account',
      emailSubtext: 'University email is authenticated and tied to your institutional single sign-on identity.',
      identifiersTitle: 'INSTITUTIONAL STUDENT IDENTIFIERS',
      identifiersNote: 'Both HCMUT and UTS IDs are required for room access authorization, physical key custody, and cross-campus facility security.',
      hcmutLabel: 'HCMUT STUDENT ID (7 DIGITS)',
      hcmutHint: '7 numeric digits verified with HCMUT ledger.',
      utsLabel: 'UTS STUDENT ID (8 DIGITS)',
      utsHint: '8 numeric digits registered with UTS Sydney.',
      staffIdLabel: 'STAFF IDENTIFIER',
      staffIdSub: 'Assigned internal staff identifier with facility authorization privileges.',
      cancelBtn: 'Cancel',
      saveBtn: 'Save Changes',
      savingBtn: 'Saving Changes...',
      policyTitle: '02 / FACILITY LEDGER & USAGE POLICY',
      maxSlotTitle: 'Max Slot Duration',
      maxSlotVal: '2 Hours',
      maxSlotSub: 'Per individual or group booking session.',
      advanceTitle: 'Advance Window',
      advanceVal: '2 - 7 Days',
      advanceSub: 'Booking opens minimum 2 days in advance.',
      custodyTitle: 'Key Custody',
      custodyVal: "Manager's Office",
      custodySub: 'Collect and return physical key directly at Manager Office.',
      credentialTitle: 'DIGITAL CREDENTIAL',
      verifiedIdentity: 'VERIFIED IDENTITY',
      accessLevel: 'LEVEL 6 ACCESS',
      quickNav: 'Quick Navigation',
      signOut: 'Sign Out of Account',
      returnWorkspace: 'Return to',
      successUpdate: 'Profile and institutional credentials updated successfully.',
    },
    manager: {
      title: 'Facilities Operations Desk',
      subtitle: 'Approve room reservations, track key custody, and manage schedules',
      roomTabs: 'Room Selection',
      approvalCount: 'Pending Review',
      assignedActivities: 'Assigned Activities & Events',
      assignActivityBtn: '+ Assign Activity / Event',
      competingRequests: 'COMPETING REQUESTS FOR THIS WINDOW',
      approveBtn: 'Approve Request',
      rejectBtn: 'Reject',
      approveAndDeclineOther: 'Approve & Decline Other',
      reviewNote: 'Review Note / Rejection Reason',
      reviewNotePlaceholder: 'Select a quick reason below or type custom note...',
      presetReasons: '1-Click Preset Rejection Reasons:',
      sectionsNav: 'OPERATIONS SECTIONS',
      approvalSection: {
        eyebrow: '01 / APPROVAL DECK · 1-CLICK TRIAGE',
        title: 'Approval Deck & Request Queue',
        subtitle: 'Fast-track triage for pending student reservations. One-click approve or decline before timeslots lock.',
        collapseBtn: 'Collapse',
        expandBtn: 'Expand',
        pendingBadge: 'PENDING REQUESTS',
        noPending: 'No pending requests in queue',
      },
      scheduleSection: {
        eyebrow: '02 / MASTER ROOM SCHEDULE & OCCUPANCY',
        title: 'Room Schedule & Occupancy Calendar',
        subtitle: 'Comprehensive weekly timetable across rooms 601, 602, and 605. Drag or click open slots to assign events or blocks.',
      },
      keySection: {
        eyebrow: '03 / ROOM KEY CUSTODY DESK · PHYSICAL DISPATCH & RETURNS',
        title: 'Room Key Custody & Handover Desk',
        subtitle: 'Direct physical key dispatch ledger: Not Handed Out (Awaiting pickup) → Not Returned (Active) → Returned (Completed at Manager Office).',
      },
    },
    auth: {
      welcome: 'Room Booking System for TNE - UTS',
      signInTitle: 'Sign In to Account',
      signUpTitle: 'Create an Account',
      emailLabel: 'University email (@tne.edu.vn)',
      passwordLabel: 'Password',
      fullNameLabel: 'Full name',
      signInBtn: 'Sign In',
      signUpBtn: 'Create Account',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
    },
  },
} as const

type TranslationsType = typeof translations.vi

// Helper type for nested dot notation keys: "common.cancel", "key.custodyTitle", etc.
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)]

export type TranslationKey = NestedKeyOf<TranslationsType>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'tne_preferred_locale'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'vi' || saved === 'en') return saved
    } catch {
      // ignore
    }
    return 'vi' // Default to Vietnamese as requested
  })

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // ignore
    }
  }

  const toggleLocale = () => {
    setLocale(locale === 'vi' ? 'en' : 'vi')
  }

  // Translation lookup with fallback
  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.')
    let current: any = translations[locale]
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k]
      } else {
        current = undefined
        break
      }
    }

    // Fallback to English if missing in Vietnamese
    if (typeof current !== 'string') {
      let fallback: any = translations.en
      for (const k of keys) {
        if (fallback && typeof fallback === 'object' && k in fallback) {
          fallback = fallback[k]
        } else {
          fallback = undefined
          break
        }
      }
      if (typeof fallback === 'string') {
        current = fallback
      } else {
        current = path // Return key path if missing
      }
    }

    if (typeof current === 'string' && params) {
      return Object.entries(params).reduce((str, [k, v]) => {
        return str.replace(new RegExp(`{${k}}`, 'g'), String(v))
      }, current)
    }

    return String(current ?? path)
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return ctx
}
