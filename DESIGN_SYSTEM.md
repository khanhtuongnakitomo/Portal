# UTS-TNE Portal — Design System & Style Guide

> **Design Concept:** Modern Treasury (Ledger on Graph Paper) × UTS Academic Precision  
> **Target Audience:** Sinh viên và Ban Quản lý Phòng Chức năng / Lab thuộc UTS-TNE  
> **Key Attributes:** High-density data grid, crisp financial/ledger aesthetics, technical authority, zero fluff, cinematic yet restrained animations.

---

## 1. Design Philosophy (Triết lý thiết kế)

Hệ thống giao diện của **UTS-TNE Portal** được xây dựng dựa trên phong cách **Modern Treasury** phối hợp cùng bộ nhận diện học thuật **UTS Blue**:
- **Bề mặt Graph Paper**: Nền canvas kẻ ô vuông kỹ thuật 24px/96px (`#E0E0E0` mờ) mô phỏng giấy vẽ kỹ thuật / sổ cái tài chính.
- **Sắc nét & Chính xác (Sharp & Crisp)**: Ưu tiên đường kẻ 1px mảnh, góc bo vuông vức nhỏ (`rounded-sm: 2px`, `rounded-md: 4px`), loại bỏ hoàn toàn các góc bo tròn quá đà (bubbly pills) để giữ tính chuyên nghiệp của hệ thống vận hành.
- **Phân cấp thị giác hai tầng (Two-Row Ledger Hierarchy)**: Mọi thông tin danh sách hay thẻ dữ liệu (như hàng đợi duyệt phòng, lịch đặt) đều được tổ chức rõ ràng: Thông số phòng/thời gian ở trên, định danh sinh viên/mã số ở dưới.
- **Chuyển động có kiểm soát (Cinematic Restraint)**: Tích hợp các chuyển động tinh tế lấy cảm hứng từ React Bits (`BlurText`, `SplitText`, `Reveal`, `ShinyText`) với quy tắc: Chuyển động phải tôn vinh dữ liệu, không gây gián đoạn thao tác và tôn trọng triệt để `prefers-reduced-motion`.

---

## 2. Color Palette (Bảng màu chuẩn)

Hệ thống màu sắc được cấu hình trực tiếp qua Tailwind CSS v4 `@theme` trong `src/index.css`.

### 2.1. UTS Brand Colors (Màu nhận diện UTS)
| Token Variable | HEX Code | Mô tả & Ứng dụng |
| :--- | :--- | :--- |
| `--color-accent` | `#0F62FE` | **UTS Academic Blue**: Màu chủ đạo cho button chính, dải viền thẻ mini-card (3px left accent), trạng thái active. |
| `--color-meta` | `#0F62FE` | Dùng cho metadata kỹ thuật, mã số sinh viên, dot tín hiệu hoạt động. |
| `--color-tint` | `#DCE8FF` | Màu xanh nhạt (soft blue tint) cho vùng được chọn (selection), hover background, thẻ đặt phòng đã duyệt. |
| `--color-ink-blue` | `#002D9C` | Màu xanh đậm tương phản cao cho chữ hiển thị trên nền xanh tint. |
| *Hover Accent* | `#0043CE` | Trạng thái hover của các button và liên kết UTS Blue. |

### 2.2. Monochrome & Surfaces (Màu nền & Bề mặt)
| Token Variable | HEX Code | Mô tả & Ứng dụng |
| :--- | :--- | :--- |
| `--color-paper` | `#FFFFFF` | Nền trắng tuyệt đối cho card, popover ledger, modal chi tiết và sheet. |
| `--color-ice` | `#F4F5F7` | **Technical Gray-Blue**: Nền cho mini-card hàng đợi, ô nhập liệu disabled, hàng bảng xen kẽ. |
| `--color-rule` | `#E0E0E0` | Đường kẻ lưới graph paper, viền card 1px sắc nét (`border-[#E0E0E0]`). |
| `--color-edge` | `#CBCBCB` | Đường phân cách thứ cấp, thanh cuộn (`scrollbar-thin`). |
| `--color-reserved`| `#E3E7ED` | Thẻ đặt chỗ của sinh viên khác trên lịch tuần. |

### 2.3. Typography Colors (Màu sắc chữ viết)
| Token Variable | HEX Code | Mô tả & Ứng dụng |
| :--- | :--- | :--- |
| `--color-ink` | `#000000` | **Rich Black**: Tiêu đề chính, viền khi hover, text có độ nhấn mạnh cao nhất. |
| `--color-graphite`| `#2B2B2B` | Nội dung mô tả, phụ đề, tên sinh viên (được tăng độ tương phản để dễ đọc). |
| `--color-steel` | `#4A4A4A` | Timestamp monospace, nhãn phụ trợ, thời lượng buổi book. |

### 2.4. Semantic & Operational Accents (Màu sắc trạng thái vận hành)
| Token Variable | HEX Code | Mô tả & Ứng dụng |
| :--- | :--- | :--- |
| `--color-slate` | `#2E3A4B` | Khối giờ hạn chế/ngoài giờ hành chính, khung bảo trì. |
| `--color-plum` | `#543B4E` | Cảnh báo chìa khóa quá hạn trả (**KEY OVERDUE**), lỗi bảo mật. |
| `--color-forest` | `#000000` / `#0E6251` | Trạng thái phòng khả dụng / đã phê duyệt hợp lệ. |

---

## 3. Typography System (Hệ thống chữ)

Dự án nạp 3 font chữ chuyên biệt thông qua Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@100..900&family=Manrope:wght@200..800&display=swap');
```

### 3.1. Phân vai các Font Family
1. **`IBM Plex Mono` (`--font-mono`)**:
   - Sử dụng cho: Mã phòng (`RM 601`), Mã số sinh viên (`SE184022`), Khung giờ (`08:00 → 12:00`), Badge hàng đợi (`[ PENDING QUEUE • 4 ]`), Ledger headers.
   - Mặc định: Thiết lập `font-weight: 600` để đảm bảo độ rõ nét trên nền sáng.
2. **`Inter` (`--font-sans`)**:
   - Sử dụng cho: Văn bản giao diện chính, tên sinh viên, form inputs, button text, nhãn điều hướng, trục giờ dọc của lịch.
   - Tính năng OpenType kích hoạt sẵn: `'cv10' 1, 'ss07' 1, 'ss08' 1` (số không gạch chéo, số dạng bảng cân đối).
3. **`Manrope` (`--font-display`)**:
   - Sử dụng cho: Hero title trang chủ, các tiêu đề trang lớn (kết hợp hiệu ứng `BlurText` và `ShinyText`).

### 3.2. Type Scale (Tỉ lệ kích thước chữ)
- **Hero Title**: `71px` (Line height: `1.1`)
- **Major Title**: `47px` (Line height: `1.25`)
- **Section Heading**: `32px` (Line height: `1.25`)
- **Feature / Subhead**: `21px` (Line height: `1.3`)
- **Standard Body**: `14px` / `16px` (Line height: `1.5`)
- **Technical Metadata**: `11px` / `12px` (Monospace, Tracking rộng)

---

## 4. Layout & Grid Rules (Quy chuẩn bố cục & Vận hành)

### 4.1. Lịch vận hành văn phòng (Strict Office Hours 08:00 – 17:00)
- **Quy tắc khung giờ**: Trục giờ dọc phía bên trái chỉ hiển thị duy nhất từ `08:00` đến `17:00` (8:00 AM – 5:00 PM). Không hiển thị các khung giờ ngoài giờ làm việc (06:00, 07:00 hay sau 17:00).
- **Ràng buộc kéo thả (Drag-to-select)**: Sinh viên không thể kéo chọn đặt phòng trước 08:00 hoặc kết thúc sau 17:00.
- **Chống tràn khung (Overflow Containment)**: Các cột ngày trên lịch áp dụng `overflow-hidden` nghiêm ngặt, vị trí thẻ (`top` và `height`) được clamp tự động, không để thẻ đè lên date header.
- **Thước đo thời gian thực (Current Time Bar)**: Thanh ngang màu xanh UTS Blue hiển thị thời gian hiện tại được giới hạn chính xác trong tọa độ của dải 08:00 – 17:00.

### 4.2. Mẫu Thẻ Hàng Đợi (Pending Queue Mini-Cards)
Nằm ngay dưới tiêu đề "Room schedule" trong view Quản lý:
```tsx
<button className="flex shrink-0 flex-col gap-1 rounded-[4px] border border-[#E0E0E0] border-l-[3px] border-l-[#0F62FE] bg-[#F4F5F7] px-3.5 py-2 text-left transition-all hover:border-[#000000] hover:bg-[#FFFFFF]">
  {/* Hàng 1: Mã phòng & Giờ */}
  <div className="flex items-center justify-between gap-3">
    <span className="font-sans text-[12px] font-semibold text-ink">RM 601</span>
    <span className="font-mono text-[11px] font-medium text-steel">06 NOV • 15:00</span>
  </div>
  {/* Hàng 2: Mã SV & Họ tên */}
  <div className="flex items-center gap-1.5">
    <span className="font-mono text-[12px] font-semibold text-[#0F62FE]">SE184022</span>
    <span className="text-[11px] text-steel">•</span>
    <span className="font-sans text-[12px] font-medium text-graphite">Anh Vo</span>
  </div>
</button>
```

### 4.3. Popover Sổ Cái Tương Tác (Student Booking Popover)
Khi sinh viên bấm vào khối đặt phòng của chính mình trên lịch:
- **Anchoring**: Neo trực tiếp bên cạnh khối đặt phòng tương ứng.
- **Header**: Mã phòng IBM Plex Mono (`ROOM 601 • SEMINAR HALL`) + Huy hiệu trạng thái (`PENDING APPROVAL` hoặc `APPROVED`).
- **Thời gian**: Monospace độ tương phản cao (`FRI 06 NOV • 10:30 → 14:30 (4h)`).
- **Hành động tức thì**:
  - Nút **[ Cancel reservation ]**: Cho phép hủy ngay lập tức mà không cần chuyển trang.
  - An toàn vận hành: Nếu đơn đã lấy chìa (`KEY_CHECKED_OUT`) hoặc đã hoàn thành (`COMPLETED`), nút hủy bị vô hiệu hóa và hiển thị ghi chú *"Key already collected — cannot cancel"*.

---

## 5. Motion Layer & Animation Standards (React Bits)

Các chuyển động được tích hợp tại `src/components/effects.tsx` và `src/index.css`:

1. **`BlurText` (Tiêu đề chính khi tải trang)**:
   - Các từ xuất hiện từ trạng thái mờ (`blur(8px)`), trượt nhẹ `translateY(10px)` với màu UTS Blue (`#0F62FE`) rồi nét dần và chuyển sang màu Rich Black (`#000000`).
   - Thời gian: `duration = 600ms`, `stagger = 65ms/từ`.
2. **`ShinyText` (Ánh kim quét qua tiêu đề)**:
   - Ánh quét gradient 105° chứa điểm sáng UTS Blue (`#0F62FE`) quét nhẹ theo chu kỳ 9s.
   - Chỉ kích hoạt sau khi `BlurText` đã hoàn thành xong việc hiển thị từ.
3. **`SplitText` (Tiêu đề phân đoạn)**:
   - Từng từ trong tiêu đề mục (Section Heading) trồi lên từ dưới lên với độ trễ ngắn `45ms/từ` khi cuộn tới vị trí quan sát.
4. **`Reveal` & `Reveal-Stagger` (Nội dung và thẻ card)**:
   - Các khối card (Dashboard stats, Room items, Ticket details) mờ dần và nâng lên `20px` với hiệu ứng de-blur khi lọt vào khung nhìn (chỉ kích hoạt 1 lần duy nhất).
   - Danh sách phần tử con sử dụng stagger `80ms` giữa các bậc.
5. **`ScrollRevealText` (Đoạn văn miêu tả)**:
   - Độ nét và độ trong suốt của từng chữ được tính toán đồng bộ theo tiến độ lăn chuột của người dùng (`--p: 0 → 1`).
6. **`AuroraBackdrop` & `CursorField`**:
   - Dải hào quang xanh UTS nhẹ trôi lững lờ ở nền sâu bên dưới lớp graph paper.
   - Con trỏ chất lỏng mượt mà (chỉ hiển thị trên thiết bị dùng chuột và tự động tắt trên màn hình cảm ứng).
7. **Hỗ trợ `prefers-reduced-motion`**:
   - Tự động ngắt tất cả animation, chuyển sang trạng thái tĩnh sắc nét cho người dùng cần sự ổn định thị giác.

---

## 6. Directory Reference (Cấu trúc mã nguồn giao diện)

```text
TNE BOOKING/
├── src/
│   ├── index.css                # Định nghĩa Tailwind v4 @theme, bảng màu, graph-paper & motion keyframes
│   ├── components/
│   │   ├── ui.tsx               # Button, Input, Textarea, Eyebrow, cx utility
│   │   ├── effects.tsx          # BlurText, SplitText, Reveal, ScrollRevealText, ShinyText, AuroraBackdrop
│   │   ├── Shell.tsx            # Khung điều hướng TopNav, PageHeader, NavItem
│   │   └── RoomTabs.tsx         # Thanh chuyển tab phòng kèm badge đếm số lượng chờ duyệt
│   ├── student/
│   │   ├── StudentView.tsx      # Giao diện chính của sinh viên (đặt phòng, xem lịch)
│   │   ├── WeekCalendar.tsx     # Bảng lịch tuần (08:00 – 17:00, drag-to-select, containment)
│   │   ├── StudentBookingPopover.tsx # Popover sổ cái chi tiết & hủy đặt phòng trực tiếp
│   │   └── MyBookings.tsx       # Danh sách phiếu đặt phòng cá nhân
│   ├── manager/
│   │   └── ManagerView.tsx      # Bàn làm việc của Quản lý: Master Calendar, Ledger Queue Mini-Cards
│   └── lib/
│       ├── types.ts             # TypeScript interfaces (Room, Booking, User, Statuses)
│       ├── time.ts              # Xử lý thời gian, tính toán tuần, định dạng ngày giờ
│       └── store.tsx            # Local state management & lookups
```

---

*Tài liệu này được biên soạn để đảm bảo tính nhất quán thẩm mỹ và tiêu chuẩn kỹ thuật khi mở rộng hoặc tích hợp backend cho hệ thống UTS-TNE Portal.*
