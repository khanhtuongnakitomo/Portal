# Portal — Student Room Booking & Key Management System

Portal thay thế quy trình đặt phòng và nhận chìa khóa qua email bằng một lịch trực quan và vòng đời rõ ràng:

1. Sinh viên xem lịch và gửi yêu cầu đặt phòng.
2. Student Manager duyệt, từ chối hoặc hệ thống tự duyệt theo cấu hình phòng.
3. Khi sinh viên đến, manager kiểm tra digital pass và ghi nhận giao chìa khóa.
4. Khi chìa khóa được trả, manager ghi nhận hoàn tất booking.

## Repository layout

```text
backend/                 NestJS REST API + Prisma + PostgreSQL
docs/API_HANDOFF.md      Hợp đồng API và luồng tích hợp frontend
docs/TNE_PORTAL_ERD.dbml ERD chi tiết để import vào dbdiagram.io
.github/workflows/       CI kiểm tra backend
```

Frontend chưa được scaffold để team design/frontend tự chọn framework. Backend cung cấp Swagger tại `http://localhost:3000/api/v1/docs`, tài liệu tích hợp ở [docs/API_HANDOFF.md](docs/API_HANDOFF.md) và ERD ở [docs/ERD.md](docs/ERD.md).

Backend hiện đã triển khai ERD v2, có migration nâng cấp dữ liệu, unit test, PostgreSQL E2E test và CI GitHub Actions.

## Roles

- `USER`: sinh viên xem lịch, tạo/hủy booking, theo dõi trạng thái và hiển thị digital pass.
- `MANAGER`: duyệt booking, quản lý giao/trả chìa, cảnh báo chìa quá hạn và chặn phòng theo lịch.
- `ADMIN`: toàn quyền manager cộng quản lý user, role, trạng thái phòng và chính sách hệ thống.

## Quick start

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

## Product scope

Backend bám theo product overview ban đầu của Portal: room schedule, approval queue, digital pass, key tracker, overdue alerts, room blocking và fair-use limits.
