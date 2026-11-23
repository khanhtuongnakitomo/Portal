# Frontend API handoff

Tài liệu này là hợp đồng HTTP của Express API dành cho team design/frontend.

## Kết nối

```text
Local base URL: http://localhost:3000/api/v1
Content-Type: application/json
Timezone mặc định: Asia/Ho_Chi_Minh
Date/time: ISO 8601 có timezone, ví dụ 2026-11-10T09:00:00+07:00
```

Access token được trả trong JSON và gửi bằng:

```http
Authorization: Bearer <accessToken>
```

Backend không có refresh token/cookie. `expiresIn` mặc định là `28800` giây (8 giờ). Nếu request có phiên đăng nhập nhận `401`, xóa phiên và đưa người dùng về trang login. Logout xóa token và toàn bộ dữ liệu của phiên ở frontend.

## Auth

### Register

```http
POST /auth/register
```

```json
{
  "email": "student@school.edu.vn",
  "fullName": "Nguyen Van A",
  "studentCode": "SE123456",
  "password": "StrongPass123!"
}
```

`studentCode` bắt buộc và duy nhất. User đăng ký luôn có role `USER`.

### Login

```http
POST /auth/login
```

```json
{
  "email": "student@school.edu.vn",
  "password": "StrongPass123!"
}
```

Register/login đều trả:

```json
{
  "accessToken": "jwt",
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

### Hồ sơ cá nhân

`GET /users/me` trả hồ sơ của người đang đăng nhập. `PATCH /users/me` yêu cầu bearer token,
chỉ nhận `{ "fullName": "Nguyen Van B" }` (chuỗi 2–120 ký tự sau khi trim), và trả cùng
cấu trúc với `GET /users/me`. Thành công ghi audit `USER_PROFILE_UPDATED`. Mọi trường
khác trả `400`; `studentCode` chỉ admin có thể đổi qua `/admin/users/:id/role`.

## Demo accounts local

Xem [danh sách email demo và cách cấu hình](../backend/README.md#tài-khoản-demo-và-reset-local). Demo chỉ dùng với database local dùng thử.

## Developer mode

Chỉ bật cho môi trường phát triển local bằng `DEV_TOOLS_ENABLED=true`; xem [hướng dẫn bật và giới hạn truy cập](../backend/README.md#developer-mode). Các route sau nằm dưới `/api/v1`:

- `GET /dev/status` → `{ enabled: true }`.
- `GET /dev/accounts` → `{ accounts: [{ id, email, fullName, role, studentCode, kind }] }`, `kind` là `DEV`, `MOCK` hoặc `USER`.
- `POST /dev/login` nhận `{ role }` (`USER`, `MANAGER`, `ADMIN`) hoặc `{ userId }` của tài khoản đang hoạt động; trả cùng cấu trúc như `/auth/login`, với audit action `DEV_LOGIN`.
- `POST /dev/mock-data` nhận `{ days? }` (1–10 ngày làm việc, mặc định 5), trả `{ created: { students, bookings, blocks }, skipped }`.
- `DELETE /dev/mock-data` → `{ deleted: { bookings, users, blocks } }`. Xóa booking và lịch sử của tài khoản mock/dev, block do mock staff tạo và tài khoản mock; giữ lại ba tài khoản dev.
  Dữ liệu khác được giữ lại; các trường tham chiếu tới tài khoản mock đã xóa được chuyển sang `dev.admin@dev.local`.

## Enums dùng trong UI

### BookingStatus

| Value               | Nhãn gợi ý     | Giữ slot |
| ------------------- | -------------- | -------- |
| `PENDING`           | Chờ duyệt      | Có       |
| `APPROVED`          | Đã duyệt       | Có       |
| `KEY_CHECKED_OUT`   | Đã giao chìa   | Có       |
| `COMPLETED`         | Hoàn tất       | Không    |
| `REJECTED`          | Bị từ chối     | Không    |
| `CANCELLED`         | Đã hủy         | Không    |

Không còn `KeyStatus`. Luồng chính là:

```text
PENDING → APPROVED → KEY_CHECKED_OUT → COMPLETED
```

### RoomStatus

`AVAILABLE`, `MAINTENANCE`, `INACTIVE`.

## Luồng sinh viên

### 1. Lịch phòng

```http
GET /rooms
GET /bookings/calendar?from=2026-11-09T00:00:00%2B07:00&to=2026-11-16T00:00:00%2B07:00
```

Không gửi `Authorization` để xem ẩn danh. Bearer token hợp lệ xác định người xem; header có mặt nhưng không hợp lệ, hết hạn hoặc thuộc tài khoản bị đình chỉ thì trả `401`, không tự chuyển sang chế độ ẩn danh.

Response có hai danh sách:

```json
{
  "bookings": [
    {
      "id": "booking-uuid",
      "roomId": "room-uuid",
      "title": "Project discussion",
      "startTime": "2026-11-10T02:00:00.000Z",
      "endTime": "2026-11-10T04:00:00.000Z",
      "status": "APPROVED",
      "kind": "STUDENT",
      "isMine": false,
      "room": { "id": "room-uuid", "name": "Room 1" }
    }
  ],
  "blocks": [
    {
      "id": "room-uuid",
      "roomId": "room-uuid",
      "reason": "Department event",
      "startTime": "2026-11-11T06:00:00.000Z",
      "endTime": "2026-11-11T10:00:00.000Z",
      "room": { "id": "room-uuid", "name": "Room 2" }
    }
  ]
}
```

- Mỗi booking luôn có `id`, `roomId`, `room: { id, name }`, `title`, `startTime`, `endTime`, `status`, `kind`, `isMine`.
- `kind` là `OFFICIAL` cho hoạt động chính thức (`isEvent=true`) và `STUDENT` cho booking cá nhân của mọi role, kể cả staff. Không xác định loại dựa vào tiêu đề hoặc role. `isMine` chỉ là `true` khi người xem là chủ booking.
- Chỉ chủ booking, `MANAGER` và `ADMIN` mới nhận thêm `userId`, `purpose`, `attendeeCount`, `reviewNote`, `createdAt`, `keyCheckedOutAt`, `keyReturnedAt` và `user: { id, fullName, email, role, studentCode }`.
- Lịch không bao giờ trả `passCode`, kể cả với chủ booking hoặc staff.
- Block được gộp trong room nên `blocks[].id` chính là `roomId`.

### 2. Tạo booking

```http
POST /bookings
Authorization: Bearer ...
```

```json
{
  "roomId": "uuid",
  "title": "Group study",
  "purpose": "Prepare final presentation",
  "attendeeCount": 6,
  "isEvent": false,
  "startTime": "2026-11-10T09:00:00+07:00",
  "endTime": "2026-11-10T11:00:00+07:00"
}
```

- `isEvent=false` tạo booking cá nhân ở mọi role, áp dụng cùng giới hạn và chính sách của phòng. Nếu phòng bật `autoApprove`, booking được duyệt ngay khi không có booking `PENDING`, `APPROVED` hoặc `KEY_CHECKED_OUT` chồng giờ; nếu chồng giờ, yêu cầu mới ở `PENDING`. Không được tạo yêu cầu trùng với yêu cầu `PENDING` của chính mình. Phòng không bật `autoApprove` tạo yêu cầu ở `PENDING` hoặc trả `409` nếu đã có booking giữ slot độc quyền.
- `isEvent=true` chỉ dành cho `MANAGER`/`ADMIN` tạo hoạt động chính thức (`APPROVED`); `USER` gửi `true` nhận `403`. Nếu không gửi trường này: `USER` tạo booking cá nhân, staff tạo hoạt động chính thức. Giới hạn số booking cá nhân không tính hoạt động chính thức.
- Booking `PENDING` tạo email outbox cho từng manager `ACTIVE`; duyệt (kể cả tự duyệt) hoặc từ chối tạo email kết quả cho chủ booking cá nhân. Hoạt động chính thức không gửi email chờ duyệt hay kết quả cho chủ hoạt động. Worker gửi email sau khi transaction thành công.

### 3. Booking cá nhân và digital pass

```http
GET /bookings/me?page=1&limit=20
GET /bookings/:id
GET /bookings/:id/pass
PATCH /bookings/:id/cancel
```

- `/bookings/me` trả lịch sử của tài khoản đang đăng nhập ở mọi trạng thái (gồm `REJECTED`, `CANCELLED`, `COMPLETED`), phân trang `{ items, total, page, limit }`.
- `/bookings/:id` chỉ dành cho chủ booking, `MANAGER` hoặc `ADMIN`. Endpoint này và `/bookings/me` trả `kind`.
- Các phản hồi booking cho chủ booking hoặc staff (kể cả tạo booking, danh sách staff và chuyển trạng thái) chỉ có `passCode` khác `null` ở `APPROVED` hoặc `KEY_CHECKED_OUT`. Lịch không trả trường này.
- `/bookings/:id/pass` dành cho chủ booking, `MANAGER` hoặc `ADMIN`; trả `passCode`, holder, room, thời gian và `status` cho `APPROVED` hoặc `KEY_CHECKED_OUT`. Trạng thái khác trả `409`. QR có thể encode `passCode` hoặc `bookingId`; manager vẫn xác nhận qua API.

## Luồng Manager

`MANAGER` và `ADMIN` có thể gọi `GET /admin/rooms` để đọc toàn bộ phòng, kể cả phòng `MAINTENANCE` và `INACTIVE`. Tạo và cập nhật phòng vẫn chỉ dành cho `ADMIN`.

### Approval queue

```http
GET /manager/bookings?status=PENDING&page=1&limit=20
PATCH /manager/bookings/:id/approve
PATCH /manager/bookings/:id/reject
```

Approve nhận `note` tùy chọn; reject yêu cầu `note`.

Email booking mới liên kết tới `${FRONTEND_URL}/#/manager`, khớp hash router của frontend hiện tại và mở hàng đợi phê duyệt sau khi manager đăng nhập. Người nhận lấy từ các tài khoản `MANAGER` đang `ACTIVE`; frontend không gọi API gửi email riêng hoặc tự chọn người nhận.

Khi duyệt/từ chối thành công, backend tạo email outbox cho sinh viên sở hữu booking trong
cùng transaction (`BOOKING_APPROVED` / `BOOKING_REJECTED`). Áp dụng cả các booking bị tự
từ chối do hoạt động chính thức, lịch cạnh tranh hoặc khóa phòng. Worker gửi qua Resend
sau commit, link `${FRONTEND_URL}/#/student`; API và payload review giữ nguyên.
Mẫu email và hướng dẫn triển khai: [BOOKING_EMAILS.md](BOOKING_EMAILS.md).

### Key tracker

```http
GET /manager/bookings/today
GET /manager/bookings/today?date=2026-11-10
PATCH /manager/bookings/:id/key-checkout
PATCH /manager/bookings/:id/key-return
GET /manager/bookings/overdue-keys
```

- `key-checkout`: `APPROVED → KEY_CHECKED_OUT`. Body yêu cầu `passCode` dạng chuỗi và nhận `note` tùy chọn. Mã được so sánh không phân biệt hoa/thường; mã sai trả `400` với thông báo `Pass code does not match`.
- `key-return`: `KEY_CHECKED_OUT → COMPLETED`.
- Overdue list gồm booking `KEY_CHECKED_OUT` có `endTime` trong quá khứ.

Approve, reject, cancel, checkout và return đều kiểm tra trạng thái booking tại lúc ghi. Nếu các thao tác cạnh tranh cho cùng một lần chuyển trạng thái, tối đa một thao tác thành công; thao tác thua trả `409`.

### Chặn lịch phòng

```http
GET /manager/room-blocks
POST /manager/room-blocks
PATCH /manager/room-blocks/:roomId/cancel
```

```json
{
  "roomId": "uuid",
  "startTime": "2026-11-11T13:00:00+07:00",
  "endTime": "2026-11-11T17:00:00+07:00",
  "reason": "Department workshop",
  "displaceBookings": false
}
```

- `displaceBookings` không bắt buộc, mặc định `false`. Với `false`, booking `PENDING` hoặc `APPROVED` giao với block sẽ làm request trả `409`.
- Với `true`, các booking `PENDING` và `APPROVED` giao với block chuyển thành `REJECTED`, có ghi lịch sử và audit log. Booking `KEY_CHECKED_OUT` giao với block luôn làm request trả `409`, bất kể tùy chọn.
- Mỗi phòng chỉ lưu một block hiện tại/gần nhất. Nếu đã có block `ACTIVE` chưa hết hạn, tạo block mới luôn trả `409` (kể cả khi hai khoảng không giao nhau); phải cancel block cũ trước.
- Khi cancel, có thể gửi cả `startTime` và `endTime` (chuỗi ISO) của block đang hiển thị. Nếu khoảng thời gian không còn khớp với block `ACTIVE`, API trả `409` với thông báo `Room block has changed; refresh and try again`. Không gửi body để hủy block `ACTIVE` hiện tại mà không đối chiếu khoảng thời gian.

## Luồng Admin

```http
GET /admin/users
PATCH /admin/users/:id/role
PATCH /admin/users/:id/status
GET /admin/rooms
POST /admin/rooms
PATCH /admin/rooms/:id
PATCH /admin/rooms/:id/status
PATCH /admin/settings
GET /admin/audit-logs
```

Đổi user sang role `USER` phải gửi thêm `studentCode`:

```json
{
  "role": "USER",
  "studentCode": "SE123456"
}
```

Settings gồm timezone, giờ mở/đóng cửa, thời lượng tối đa, số ngày đặt trước và số booking active tối đa. Không còn `keyPickupWindowMinutes`.

## Error handling

Mọi lỗi API trả JSON `{ statusCode, message, error }`:

```json
{
  "statusCode": 409,
  "message": "This room is already reserved for that time range",
  "error": "Conflict"
}
```

- `400`: JSON sai cú pháp, trường không được hỗ trợ hoặc dữ liệu/khung giờ không hợp lệ.
- `401`: thiếu token trên route bắt buộc xác thực, hoặc token không hợp lệ/hết hạn/tài khoản bị đình chỉ.
- `403`: sai role hoặc không sở hữu booking.
- `404`: resource hoặc route dưới API prefix không tồn tại.
- `409`: trùng lịch, room bị block hoặc state đã thay đổi.
- `413`: JSON body vượt giới hạn 100 KiB.
- `429`: `/auth/login` giới hạn 10 lần/phút theo IP và email, `/auth/register` 5 lần/phút theo IP. Dùng `Retry-After` để biết còn bao nhiêu giây trước khi thử lại.

## Frontend acceptance checklist

- Calendar render booking và room block đúng timezone Việt Nam.
- Login/register lưu `accessToken`, `expiresIn`, `user`; logout xóa toàn bộ state local.
- Route guard dựa trên `user.role` do API trả về, không tự tin role decode từ JWT.
- Không cho user tự chọn role khi đăng ký; `studentCode` là bắt buộc.
- Manager dashboard có approval queue, today's tracker và overdue badge.
- Nút giao chìa chỉ bật ở `APPROVED`; nút nhận chìa chỉ bật ở `KEY_CHECKED_OUT`.
- Digital pass không hiện ở pending/rejected/cancelled/completed.
- Khi API trả `409`, refetch booking/calendar trước khi thao tác lại.
