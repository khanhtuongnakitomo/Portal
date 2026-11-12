# TNE Portal Backend

REST API đặt phòng cho ba nhóm quyền `USER`, `MANAGER`, `ADMIN`, xây bằng Express 5, Prisma 7 và PostgreSQL 17.

## Kiến trúc

```text
Frontend
   │ HTTPS + Bearer access token
   ▼
Express API
   ├── Auth + RBAC
   ├── Booking/key state machine
   ├── Manager/Admin workflows
   ├── PostgreSQL email outbox + Resend worker
   └── Prisma
         │ PostgreSQL protocol
         ▼
PostgreSQL local hoặc Supabase (private schema app)
```

Frontend không truy cập database trực tiếp. Schema `app` không được expose qua Supabase Data API; migration cũng thu hồi quyền của `anon` và `authenticated` nếu các role này tồn tại.

## Chức năng

- Đăng ký sinh viên và đăng nhập bằng email/password; mật khẩu hash Argon2id.
- JWT access token và RBAC `USER`, `MANAGER`, `ADMIN`; role/status được đọc lại từ database trên mỗi request.
- `users` là superclass; mỗi tài khoản có đúng một subclass `student_profiles`, `manager_profiles` hoặc `admin_profiles`.
- Public xem phòng và lịch đã duyệt.
- User tạo booking, xem booking cá nhân, hủy và mở digital pass.
- Manager/Admin duyệt, từ chối, giao chìa, nhận lại chìa và theo dõi chìa quá hạn.
- Một state machine duy nhất: `PENDING → APPROVED → KEY_CHECKED_OUT → COMPLETED`.
- Manager/Admin đặt một khoảng block cho từng phòng; block và schedule lock được lưu trong `rooms`.
- Admin quản lý user/role/status, phòng, chính sách và audit log.
- Booking `PENDING` tạo email outbox cho từng manager đang hoạt động; worker gửi qua Resend với retry và idempotency key.
- Sinh viên nhận email khi booking được duyệt hoặc bị từ chối, gồm lý do khi có. Xem [hai mẫu email](../docs/BOOKING_EMAILS.md).
- Manager/Admin có thể gửi yêu cầu cá nhân bằng `isEvent=false`, áp dụng giới hạn và chờ duyệt như sinh viên. Hoạt động chính thức dùng `isEvent=true`, chỉ dành cho manager/admin. Email kết quả gửi cho chủ booking cá nhân ở mọi role.
- DTO validation, Helmet, CORS và health checks.
- Row lock theo phòng và PostgreSQL exclusion constraint chống booking trùng lịch khi request đồng thời.

## Chạy local

Yêu cầu: Docker Desktop, Node.js 24+ và pnpm 11.25.x.

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

- API: `http://localhost:3000/api/v1`
- Liveness: `GET /api/v1/health/live`
- Readiness: `GET /api/v1/health/ready`

Đổi `ADMIN_PASSWORD` trước khi seed môi trường dùng chung. Không commit `.env`.

Đặt `SEED_DEMO_USERS=true` để tạo tài khoản manager và student dùng cho frontend local. Thông tin nằm trong [`../docs/API_HANDOFF.md`](../docs/API_HANDOFF.md); không bật demo users ở production.

### macOS không dùng Docker

```sh
brew install postgresql@17
brew services start postgresql@17
"$(brew --prefix postgresql@17)/bin/createdb" tne_portal
cd backend
cp .env.example .env
```

PostgreSQL do Homebrew tạo dùng username macOS hiện tại (`whoami`). Đổi cả
`DATABASE_URL` và `DIRECT_URL` trong `.env` thành
`postgresql://<macOS-username>@localhost:5432/tne_portal?schema=app`, rồi chạy:

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm db:deploy
pnpm db:seed
pnpm start:dev
```

Chỉ seed lần đầu cho database local mới: seed hiện tại xóa bookings cũ để tạo dữ liệu mẫu.
Mở terminal khác, chạy `cd frontend && npm ci && npm run dev -- --host 127.0.0.1`
từ repo root. Vào `http://localhost:5173`; Vite tự proxy `/api` đến backend port 3000.

## Email thông báo qua Resend

Mặc định local và CI có `EMAIL_NOTIFICATIONS_ENABLED=false`: booking vẫn tạo các row trong `notification_outbox`, nhưng worker không gọi dịch vụ bên ngoài. Để bật gửi thật:

1. Tạo API key trong Resend.
2. Xác minh domain gửi và cấu hình SPF/DKIM theo Resend.
3. Điền `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` và đặt `EMAIL_NOTIFICATIONS_ENABLED=true` trong môi trường chạy backend.
4. Khởi động lại backend và tạo một booking ở phòng không bật `autoApprove`.

Khi được bật, worker sẽ xử lý cả những row `PENDING` đã tạo trước đó. Trước lần bật đầu tiên trên môi trường dùng chung, kiểm tra hàng đợi để tránh gửi email thử nghiệm cũ.

`FRONTEND_URL` được dùng để tạo link `${FRONTEND_URL}/#/manager` trong email,
khớp hash router hiện tại. Manager đăng nhập để xem hàng đợi phê duyệt.
Email kết quả cho sinh viên mở `${FRONTEND_URL}/#/student`. Các sự kiện
`BOOKING_APPROVED` và `BOOKING_REJECTED` dùng chung worker với email booking mới.
Quy tắc gửi và hai mẫu có sẵn tại [BOOKING_EMAILS.md](../docs/BOOKING_EMAILS.md).

### Test Gmail khi chưa có domain riêng

Không cần Gmail SMTP hoặc mật khẩu ứng dụng Google. Resend gửi email, Gmail là nơi nhận.

1. Đăng nhập Resend bằng Gmail muốn nhận thử; tạo key với **Sending access**.
2. Tạo `backend/.env.local` (đã gitignore):

   ```dotenv
   EMAIL_NOTIFICATIONS_ENABLED=true
   RESEND_API_KEY=re_your_private_key
   EMAIL_FROM="TNE Portal Local <onboarding@resend.dev>"
   FRONTEND_URL=http://localhost:5173
   ```

3. Trong Portal, đăng nhập admin, tạo tài khoản manager bằng **đúng Gmail của chủ tài khoản Resend**.
   Suspend các manager demo khác trên database local để hàng đợi không thử gửi tới địa chỉ mẫu.
   Người nhận luôn lấy từ các user `MANAGER` có trạng thái `ACTIVE` trong database.
4. Khởi động lại backend (`pnpm start:dev`), đăng nhập student và tạo booking mới.
   Chọn ngày làm việc cách ít nhất 2 ngày, tối đa 7 ngày, trong giờ mở cửa.
5. Chờ tối đa một chu kỳ worker (15 giây), kiểm tra Gmail Inbox/Spam và Resend Emails.
   Row outbox `SENT` kèm `provider_message_id` nghĩa là Resend đã nhận request;
   xác nhận trong Gmail hoặc sự kiện `Delivered` để biết email đã tới nơi.
   Frontend chỉ báo booking được lưu sau khi API thành công; việc gửi email do worker backend xử lý.

Backend, Prisma CLI và seed đều đọc `.env.local` trước `.env`; biến môi trường từ shell/hosting
được ưu tiên cao nhất. API key chỉ nằm ở backend, không thêm biến `VITE_RESEND_API_KEY`.

Theo [giới hạn domain thử của Resend](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
`onboarding@resend.dev` chỉ gửi tới email chủ tài khoản Resend. Nếu gặp `403`, kiểm tra
người nhận hoặc domain gửi. `401` thường do API key không hợp lệ. Worker lưu lỗi trong
`notification_outbox.last_error` và retry; khắc phục cấu hình trước khi gửi lại.

### Chuyển cấu hình email lên môi trường chính thức

Code có thể push lên repo mà không kèm `.env`, `.env.local` hoặc tài khoản thử.
Trên hosting backend, cấu hình secret `RESEND_API_KEY` riêng; xác minh domain gửi trong
Resend rồi đổi `EMAIL_FROM` sang địa chỉ thuộc domain đó, đặt `FRONTEND_URL` thành URL
HTTPS của Portal và bật `EMAIL_NOTIFICATIONS_ENABLED=true`. Đảm bảo manager có email thật,
kiểm tra hàng đợi cũ trước khi bật và giữ tiến trình backend chạy để worker xử lý email.
Không dùng domain `resend.dev` để gửi cho nhiều manager ở production.

Luồng gửi:

```text
Booking PENDING + active MANAGERs
  -> notification_outbox (cùng database transaction)
  -> worker claim bằng FOR UPDATE SKIP LOCKED
  -> Resend API
  -> SENT hoặc retry exponential tối đa EMAIL_MAX_ATTEMPTS
```

Worker chạy mỗi 15 giây, tự phục hồi row `PROCESSING` bị treo quá 5 phút và dùng `dedupe_key` làm Resend idempotency key. Không có API key nào được lưu trong database hoặc commit lên Git.

## Xác thực

`POST /auth/register` và `POST /auth/login` trả:

```json
{
  "accessToken": "...",
  "expiresIn": 28800,
  "user": {
    "id": "uuid",
    "email": "student@school.edu.vn",
    "fullName": "Nguyen Van A",
    "studentCode": "SE123456",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

Frontend gửi `Authorization: Bearer <accessToken>`. Theo ERD v2, hệ thống không lưu refresh token; mặc định access token sống 8 giờ và khi hết hạn người dùng đăng nhập lại. Logout là xóa access token phía frontend.

JWT chỉ chứa định danh, không dùng role trong token để authorize. Strategy đọc role/status hiện tại từ database nên khóa tài khoản hoặc đổi role có hiệu lực ở request kế tiếp.

## Database v2

Các bảng nghiệp vụ:

- `users`, `student_profiles`, `manager_profiles`, `admin_profiles`
- `rooms`, `bookings`, `booking_status_history`
- `notification_outbox`, `audit_logs`, `system_settings`

Migration `20261103000000_apply_erd_v2` nâng schema v1 lên v2 và giữ dữ liệu tương thích. Migration sẽ dừng nếu một phòng đang có nhiều hơn một `room_blocks` ACTIVE, vì schema mới chỉ lưu một block trên mỗi phòng.

Quy tắc chính:

- Mỗi user phải có đúng một profile khớp `users.role`; deferred constraint trigger kiểm tra lúc commit.
- `USER` bắt buộc có `studentCode` duy nhất.
- `PENDING`, `APPROVED`, `KEY_CHECKED_OUT` giữ slot.
- `REJECTED`, `CANCELLED`, `COMPLETED` không giữ slot.
- `rooms` chỉ lưu một block hiện tại/gần nhất. Muốn tạo block mới khi block hiện tại chưa kết thúc phải hủy block trước.
- Booking create và room-block create cùng lock row `rooms`, giữ transaction ngắn và ngăn race condition giữa hai workflow.
- `bookings_no_active_overlap` là lớp bảo vệ cuối ở database.

## Đưa database lên Supabase

1. Tạo Supabase project gần region chạy backend, ưu tiên Singapore cho ứng dụng tại Việt Nam.
2. Dùng pooled connection string cho `DATABASE_URL` và direct/session connection string cho `DIRECT_URL`.
3. Giữ tham số SSL đúng như connection string trong Dashboard.
4. Chạy `pnpm prisma:generate`, `pnpm db:deploy`, rồi `pnpm db:seed` từ máy phát hành hoặc CI.
5. Không thêm schema `app` vào Data API exposed schemas và không đưa database URL vào frontend.

Supabase/PostgreSQL dùng extension `btree_gist` cho exclusion constraint. Khi Supabase thông báo nâng Postgres có yêu cầu reindex extension, làm theo hướng dẫn nâng cấp của project trước khi đưa production trở lại hoạt động.

## Endpoint chính

| Method     | Path                                      | Quyền                     |
| ---------- | ----------------------------------------- | ------------------------- |
| POST       | `/auth/register`                          | Public                    |
| POST       | `/auth/login`                             | Public                    |
| GET        | `/rooms`                                  | Public                    |
| GET        | `/bookings/calendar`                      | Public                    |
| POST       | `/bookings`                               | Đã đăng nhập              |
| GET        | `/bookings/me`                            | Đã đăng nhập              |
| GET        | `/bookings/:id/pass`                      | Chủ booking/Manager/Admin |
| PATCH      | `/bookings/:id/cancel`                    | Chủ booking/Manager/Admin |
| GET        | `/manager/bookings`                       | Manager/Admin             |
| GET        | `/manager/bookings/today`                 | Manager/Admin             |
| GET        | `/manager/bookings/overdue-keys`          | Manager/Admin             |
| PATCH      | `/manager/bookings/:id/approve`           | Manager/Admin             |
| PATCH      | `/manager/bookings/:id/reject`            | Manager/Admin             |
| PATCH      | `/manager/bookings/:id/key-checkout`      | Manager/Admin             |
| PATCH      | `/manager/bookings/:id/key-return`        | Manager/Admin             |
| GET/POST   | `/manager/room-blocks`                    | Manager/Admin             |
| PATCH      | `/manager/room-blocks/:roomId/cancel`     | Manager/Admin             |
| GET        | `/admin/users`                            | Admin                     |
| PATCH      | `/admin/users/:id/role`                   | Admin                     |
| POST/PATCH | `/admin/rooms...`                         | Admin                     |
| PATCH      | `/admin/settings`                         | Admin                     |
| GET        | `/admin/audit-logs`                       | Admin                     |

Các endpoint và payload tích hợp frontend được duy trì trong [`../docs/API_HANDOFF.md`](../docs/API_HANDOFF.md).

## Kiểm tra chất lượng

```powershell
pnpm prisma:generate
pnpm lint
pnpm test --runInBand
pnpm test:e2e --runInBand
pnpm build
pnpm audit --prod
```

E2E test chạy toàn bộ luồng đăng ký → booking → email outbox → approve → giao/trả chìa → room block. GitHub Actions tự dựng PostgreSQL 17, chạy các migration và test trên mỗi push/PR có thay đổi backend.

## Lưu ý dependency

`pg` được khóa ở `8.18.0` trong `pnpm-workspace.yaml` do compatibility với `@prisma/adapter-pg`. Chỉ bỏ override sau khi nâng Prisma lên bản đã sửa và chạy lại migration/E2E PostgreSQL.

## Việc cần bổ sung trước production

- Email verification, quên mật khẩu và SMTP/provider của trường.
- Rate limiting tại reverse proxy hoặc middleware Express.
- Email cảnh báo chìa quá hạn; email kết quả duyệt/từ chối cho sinh viên đã có.
- Backup, monitoring, alerting và kiểm thử restore.
- Chính sách retention dữ liệu sinh viên và phê duyệt của nhà trường.
