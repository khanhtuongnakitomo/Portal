# Portal — UTS-TNE Student Room Booking & Key Management System

Hệ thống đặt phòng và quản lý phòng lab / seminar trực tuyến dành cho sinh viên và ban quản lý thuộc UTS-TNE. Thay thế quy trình đặt phòng và nhận chìa khóa qua email bằng một lịch trực quan và vòng đời rõ ràng:

1. Sinh viên xem lịch và gửi yêu cầu đặt phòng.
2. Student Manager duyệt, từ chối hoặc hệ thống tự duyệt theo cấu hình phòng.
3. Khi sinh viên đến, manager kiểm tra digital pass và ghi nhận giao chìa khóa.
4. Khi chìa khóa được trả, manager ghi nhận hoàn tất booking.

---

## 🎨 Design System & Style Guide
Chi tiết toàn bộ triết lý thiết kế **Modern Treasury**, bảng màu chuẩn UTS Blue, hệ thống font chữ và hiệu ứng chuyển động React Bits được trình bày đầy đủ tại:
👉 **[DESIGN.md](./DESIGN.md)**

---

## 📁 Repository Layout

```text
backend/                 Express REST API + Prisma + PostgreSQL
frontend/                React 19 + TypeScript + Tailwind CSS v4 Frontend
docs/API_HANDOFF.md      Hợp đồng API và luồng tích hợp frontend
docs/TNE_PORTAL_ERD.dbml ERD chi tiết để import vào dbdiagram.io
DESIGN.md                Tài liệu Design System & Style Guide chi tiết
.github/workflows/       CI kiểm tra backend
```

---

Backend hiện đã triển khai ERD v2, Resend email outbox cho manager, migration nâng cấp dữ liệu, unit test, PostgreSQL E2E test và CI GitHub Actions.

## 🏛️ Vai trò người dùng (Roles)

- `USER`: Sinh viên xem lịch, tạo/hủy booking, theo dõi trạng thái và hiển thị digital pass.
- `MANAGER`: Duyệt booking, quản lý giao/trả chìa, cảnh báo chìa quá hạn và chặn phòng theo lịch.
- `ADMIN`: Toàn quyền manager cộng quản lý user, role, trạng thái phòng và chính sách hệ thống.

---

## 🚀 Hướng dẫn chạy Frontend (Local)

```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt dependencies
npm install

# 3. Khởi chạy môi trường phát triển (Dev Server)
npm run dev

# 4. Build kiểm tra production
npm run build
```

---

## ⚙️ Hướng dẫn chạy Backend

```powershell
cd backend
Copy-Item .env.example .env
docker compose up -d
pnpm install
pnpm prisma:generate
pnpm db:deploy
pnpm db:seed
pnpm start:dev
```

Hướng dẫn backend chi tiết: [backend/README.md](backend/README.md).

---

## 🛠️ Công nghệ chính
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4 (`@theme`, custom CSS utilities)
- **Icons:** `lucide-react`
- **Typography:** IBM Plex Mono, Inter, Manrope
- **Motion:** React Bits-inspired restrained animations (`BlurText`, `SplitText`, `Reveal`, `ScrollRevealText`, `ShinyText`)
- **Backend:** Express 5, Prisma ORM, PostgreSQL, Docker, Resend

Backend bám theo product overview ban đầu của Portal: room schedule, approval queue, email booking mới cho manager, digital pass, key tracker, overdue alerts, room blocking và fair-use limits.
