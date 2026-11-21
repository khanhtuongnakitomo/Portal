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
- Lịch phòng hỗ trợ xem ẩn danh; chỉ chủ booking hoặc staff thấy thêm thông tin chi tiết.
- User tạo booking, xem booking cá nhân, hủy và mở digital pass.
- Manager/Admin duyệt, từ chối, giao chìa, nhận lại chìa và theo dõi chìa quá hạn.
- Một state machine duy nhất: `PENDING → APPROVED → KEY_CHECKED_OUT → COMPLETED`.
- Manager/Admin đặt một khoảng block cho từng phòng; block và schedule lock được lưu trong `rooms`.
- Admin quản lý user/role/status, phòng, chính sách và audit log.
- DTO validation, Helmet, CORS allowlist, giới hạn request đăng nhập/đăng ký và health checks.
- Row lock theo phòng và PostgreSQL exclusion constraint chống booking trùng lịch khi request đồng thời.

## Chạy local

Yêu cầu: Docker Desktop, Node.js 24.15+ (dưới 27) và pnpm 11.25.x.

Sau khi copy `.env.example`, mở `.env` và thay secret ví dụ bằng `JWT_ACCESS_SECRET` ngẫu nhiên (ít nhất 32 ký tự), đặt `ADMIN_EMAIL` và `ADMIN_PASSWORD` (ít nhất 12 ký tự). `CORS_ORIGINS` là danh sách origin chính xác, phân cách bằng dấu phẩy. Không commit `.env`.

`TRUST_PROXY` mặc định là `loopback` để Express nhận IP client qua proxy Vite chạy local. Dùng `false` nếu không có reverse proxy; nếu có, đặt IP/CIDR đáng tin cậy (phân cách bằng dấu phẩy) hoặc số hop cố định. Chỉ tin proxy kiểm soát `X-Forwarded-For`, và không cho phép kết nối đi đường ngắn hơn nếu cấu hình theo số hop. Giới hạn đăng nhập là 30 lần/phút theo IP và 10 lần/phút theo cặp IP/email.

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
- Hợp đồng API: [`../docs/API_HANDOFF.md`](../docs/API_HANDOFF.md)
- Liveness: `GET /api/v1/health/live`
- Readiness: `GET /api/v1/health/ready`

`db:seed` thêm admin bootstrap và phòng chuẩn, đồng thời áp dụng cấu hình seed nếu chưa có cấu hình hoặc hàng mặc định của migration chưa được chỉnh. Chạy lại không xóa dữ liệu, không đổi mật khẩu hoặc ghi đè cấu hình đã chỉnh. Nếu `ADMIN_EMAIL` thuộc về một tài khoản không phải `ADMIN`, lệnh sẽ từ chối thay vì nâng quyền.

### Tài khoản demo và reset local

Chỉ trên database dùng thử, đặt `SEED_DEMO_USERS=true`, cung cấp `DEMO_PASSWORD` ít nhất 12 ký tự, và chạy `pnpm db:seed`. Demo bị từ chối khi `NODE_ENV=production`. Tài khoản hiện có được giữ nguyên; seed bỏ qua booking mẫu đã có hoặc chồng lịch với block đang hoạt động hay booking `APPROVED`/`KEY_CHECKED_OUT`.

| Role | Email demo | Mật khẩu khi tạo |
| ---- | ---------- | ---------------- |
| `ADMIN` | `admin@tne.local`, `g.pham@uts-tne.edu.vn` | `DEMO_PASSWORD` |
| `MANAGER` | `manager@tne.edu.vn`, `manager@tne.local`, `d.tran@uts-tne.edu.vn` | `DEMO_PASSWORD` |
| `USER` | `student@tne.edu.vn`, `student2@tne.edu.vn`, `student3@tne.edu.vn`, `student4@tne.edu.vn`, `student@tne.local`, `linh.nguyen@student.uts.edu.au` | `DEMO_PASSWORD` |

Admin bootstrap dùng `ADMIN_EMAIL` và `ADMIN_PASSWORD`, độc lập với demo. Dùng email bootstrap khác các email demo.

Nếu database từng dùng seed cũ, lệnh seed mới không thu hồi các tài khoản đó. Đổi mật khẩu bootstrap đã dùng mặc định và đình chỉ các tài khoản demo cũ không còn cần đến trước khi dùng database ở production.

**Chỉ reset database local có thể xóa bỏ.** Lệnh dưới xóa toàn bộ booking, lịch sử trạng thái booking và audit log, sau đó chạy seed trong cùng transaction. Tài khoản, phòng, block hiện có và cấu hình đã chỉnh được giữ lại. Nếu bật `SEED_DEMO_USERS=true`, seed sẽ thêm booking mẫu không xung đột.

```powershell
$env:RESET_DEMO_CONFIRM = 'yes'
pnpm db:reset-demo
Remove-Item Env:RESET_DEMO_CONFIRM
```

Lệnh từ chối nếu `NODE_ENV=production`, nếu không có `RESET_DEMO_CONFIRM=yes`, hoặc nếu `DATABASE_URL` hay `DIRECT_URL` (khi được đặt) không trỏ tới PostgreSQL trên `localhost`, `127.0.0.1` hoặc `[::1]`. Không dùng tham số `host` trong URL khi reset.

### Developer mode

Trên môi trường phát triển, có thể đặt `DEV_TOOLS_ENABLED=true` trong `.env` của backend rồi khởi động lại API. Chỉ bật với database dùng thử: chế độ này có thể đăng nhập bằng tài khoản đang hoạt động mà không cần mật khẩu. API từ chối khởi động nếu bật cờ với `NODE_ENV=production`.

Mở frontend Vite qua `localhost`, `127.0.0.1` hoặc `[::1]` để chọn tài khoản, tạo lịch đặt phòng mẫu hoặc xóa dữ liệu mẫu. Không dùng tunnel hay proxy công khai: API chỉ chấp nhận kết nối loopback, không có `CF-Connecting-IP`, và mọi địa chỉ trong `X-Forwarded-For` (nếu có) phải là loopback. Khi tắt cờ, các route `/dev` trả `404`.

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

Frontend gửi `Authorization: Bearer <accessToken>`. Không có refresh token; `JWT_ACCESS_TTL_SECONDS` mặc định là 28800 giây (8 giờ) và phải là số nguyên từ 300 trở lên. Nếu cấu hình `JWT_ISSUER` hoặc `JWT_AUDIENCE`, API dùng giá trị đó để ký và xác thực token. Khi token hết hạn, người dùng đăng nhập lại.

JWT chỉ chứa định danh, không dùng role trong token để authorize. Middleware đọc role/status hiện tại từ database nên khóa tài khoản hoặc đổi role có hiệu lực ở request kế tiếp.

## Database v2

Các bảng nghiệp vụ:

- `users`, `student_profiles`, `manager_profiles`, `admin_profiles`
- `rooms`, `bookings`, `booking_status_history`
- `audit_logs`, `system_settings`

Migration `20261103000000_apply_erd_v2` nâng schema v1 lên v2 và giữ dữ liệu tương thích. Migration sẽ dừng nếu một phòng đang có nhiều hơn một `room_blocks` ACTIVE, vì schema mới chỉ lưu một block trên mỗi phòng.

Quy tắc chính:

- Mỗi user phải có đúng một profile khớp `users.role`; deferred constraint trigger kiểm tra lúc commit.
- `USER` bắt buộc có `studentCode` duy nhất.
- `PENDING` có thể cạnh tranh cùng khung giờ. `APPROVED` và `KEY_CHECKED_OUT` giữ slot độc quyền.
- `REJECTED`, `CANCELLED`, `COMPLETED` không giữ slot.
- `rooms` chỉ lưu một block hiện tại/gần nhất. Muốn tạo block mới khi block hiện tại chưa kết thúc phải hủy block trước.
- Tạo booking, duyệt booking, giao chìa và tạo room block cùng dùng lock trên row `rooms` để điều phối thay đổi lịch.
- `bookings_no_firm_overlap` do migration quản lý, bảo vệ các booking `APPROVED` và `KEY_CHECKED_OUT` khỏi chồng lịch.

## Đưa database lên Supabase

1. Tạo Supabase project gần region chạy backend, ưu tiên Singapore cho ứng dụng tại Việt Nam.
2. Dùng pooled connection string cho `DATABASE_URL` và direct/session connection string cho `DIRECT_URL`.
3. Giữ tham số SSL đúng như connection string trong Dashboard.
4. Chạy `pnpm prisma:generate`, `pnpm db:deploy`, rồi `pnpm db:seed` từ máy phát hành hoặc CI. Đặt `SEED_DEMO_USERS=false` và cung cấp thông tin admin bootstrap.
5. Không thêm schema `app` vào Data API exposed schemas và không đưa database URL vào frontend.

Supabase/PostgreSQL dùng extension `btree_gist` cho exclusion constraint. Khi Supabase thông báo nâng Postgres có yêu cầu reindex extension, làm theo hướng dẫn nâng cấp của project trước khi đưa production trở lại hoạt động.

## Endpoint chính

| Method     | Path                                      | Quyền                     |
| ---------- | ----------------------------------------- | ------------------------- |
| POST       | `/auth/register`                          | Public                    |
| POST       | `/auth/login`                             | Public                    |
| GET        | `/rooms`                                  | Public                    |
| GET        | `/bookings/calendar`                      | Xác thực tùy chọn         |
| POST       | `/bookings`                               | Đã đăng nhập              |
| GET        | `/bookings/me`                            | Đã đăng nhập              |
| GET        | `/bookings/:id`                           | Chủ booking/Manager/Admin |
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
| GET        | `/admin/rooms`                            | Manager/Admin             |
| GET        | `/admin/users`                            | Admin                     |
| PATCH      | `/admin/users/:id/role`                   | Admin                     |
| POST/PATCH | `/admin/rooms...`                         | Admin                     |
| PATCH      | `/admin/settings`                         | Admin                     |
| GET        | `/admin/audit-logs`                       | Admin                     |

Xem [hợp đồng API](../docs/API_HANDOFF.md) để biết payload, quyền truy cập trường và mã lỗi.

## Kiểm tra chất lượng

```powershell
pnpm prisma:generate
pnpm lint
pnpm test --runInBand
pnpm db:deploy
pnpm test:e2e --runInBand
pnpm build
pnpm audit --prod
```

E2E test chạy luồng đăng ký → booking → approve → giao/trả chìa → room block. GitHub Actions tự dựng PostgreSQL 17, chạy migration và test trên mỗi push/PR có thay đổi backend.

## Lưu ý dependency

`pg` được khóa ở `8.18.0` trong `pnpm-workspace.yaml` do compatibility với `@prisma/adapter-pg`. Chỉ bỏ override sau khi nâng Prisma lên bản đã sửa và chạy lại migration/E2E PostgreSQL.

## Việc cần bổ sung trước production

- Email verification, quên mật khẩu và SMTP/provider của trường.
- Giới hạn request ở reverse proxy cho các deployment nhiều process hoặc instance.
- Email/push notification cho thay đổi trạng thái và chìa quá hạn.
- Backup, monitoring, alerting và kiểm thử restore.
- Chính sách retention dữ liệu sinh viên và phê duyệt của nhà trường.
