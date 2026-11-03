# Frontend API handoff

Tài liệu này dành cho team design/frontend. Hợp đồng chính xác nhất là Swagger tại `http://localhost:3000/api/v1/docs`.

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

Backend không có refresh token/cookie. `expiresIn` mặc định là `28800` giây (8 giờ); khi API trả `401` do token hết hạn, đưa người dùng về trang login. Logout là xóa token và user state ở frontend.

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

## Demo accounts local

Khi `.env` có `SEED_DEMO_USERS=true` và đã chạy `pnpm db:seed`:

| Role    | Email               | Password source               |
| ------- | ------------------- | ----------------------------- |
| Admin   | `ADMIN_EMAIL`       | `ADMIN_PASSWORD` trong `.env` |
| Manager | `manager@tne.local` | `DEMO_PASSWORD` trong `.env`  |
| User    | `student@tne.local` | `DEMO_PASSWORD` trong `.env`  |

Không bật demo users trên production.

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

Response có hai danh sách:

```json
{
  "bookings": [
    {
      "id": "booking-uuid",
      "title": "Project discussion",
      "startTime": "2026-11-10T02:00:00.000Z",
      "endTime": "2026-11-10T04:00:00.000Z",
      "status": "APPROVED",
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

Block được gộp trong room nên `blocks[].id` chính là `roomId`. Public calendar không trả thông tin sinh viên.

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
  "startTime": "2026-11-10T09:00:00+07:00",
  "endTime": "2026-11-10T11:00:00+07:00"
}
```

Phòng bật `autoApprove` trả booking `APPROVED`; còn lại trả `PENDING`.

### 3. Booking cá nhân và digital pass

```http
GET /bookings/me?page=1&limit=20
GET /bookings/:id
GET /bookings/:id/pass
PATCH /bookings/:id/cancel
```

Digital pass khả dụng ở `APPROVED` và `KEY_CHECKED_OUT`, trả `passCode`, holder, room, thời gian và `status`. QR có thể encode `passCode` hoặc `bookingId`; manager vẫn xác nhận qua API.

## Luồng Manager

### Approval queue

```http
GET /manager/bookings?status=PENDING&page=1&limit=20
PATCH /manager/bookings/:id/approve
PATCH /manager/bookings/:id/reject
```

Approve nhận `note` tùy chọn; reject yêu cầu `note`.

### Key tracker

```http
GET /manager/bookings/today
GET /manager/bookings/today?date=2026-11-10
PATCH /manager/bookings/:id/key-checkout
PATCH /manager/bookings/:id/key-return
GET /manager/bookings/overdue-keys
```

- `key-checkout`: `APPROVED → KEY_CHECKED_OUT`.
- `key-return`: `KEY_CHECKED_OUT → COMPLETED`.
- Overdue list gồm booking `KEY_CHECKED_OUT` có `endTime` trong quá khứ.

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
  "reason": "Department workshop"
}
```

Mỗi phòng chỉ lưu một block hiện tại/gần nhất. Muốn tạo block mới khi block ACTIVE chưa kết thúc, manager phải cancel block hiện tại. Backend từ chối block nếu còn booking giữ slot giao với khoảng đó.

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

```json
{
  "statusCode": 409,
  "message": "This room is already reserved for that time range",
  "error": "Conflict"
}
```

- `400`: dữ liệu hoặc khung giờ không hợp lệ.
- `401`: chưa đăng nhập/token hết hạn; chuyển về login.
- `403`: sai role hoặc không sở hữu booking.
- `404`: resource không tồn tại.
- `409`: trùng lịch, room bị block hoặc state đã thay đổi.

## Frontend acceptance checklist

- Calendar render booking và room block đúng timezone Việt Nam.
- Login/register lưu `accessToken`, `expiresIn`, `user`; logout xóa toàn bộ state local.
- Route guard dựa trên `user.role` do API trả về, không tự tin role decode từ JWT.
- Không cho user tự chọn role khi đăng ký; `studentCode` là bắt buộc.
- Manager dashboard có approval queue, today's tracker và overdue badge.
- Nút giao chìa chỉ bật ở `APPROVED`; nút nhận chìa chỉ bật ở `KEY_CHECKED_OUT`.
- Digital pass không hiện ở pending/rejected/cancelled/completed.
- Khi API trả `409`, refetch booking/calendar trước khi thao tác lại.
