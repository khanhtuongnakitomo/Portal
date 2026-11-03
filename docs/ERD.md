# TNE Portal ERD

File DBML chính: [`TNE_PORTAL_ERD.dbml`](TNE_PORTAL_ERD.dbml).

## Mở bằng dbdiagram.io

1. Mở [dbdiagram.io](https://dbdiagram.io/).
2. Tạo diagram mới và chọn DBML.
3. Copy toàn bộ nội dung `TNE_PORTAL_ERD.dbml` vào editor bên trái.
4. Diagram sẽ được render tự động; dùng toolbar để export PNG hoặc PDF.

## Trạng thái tài liệu

Đây là **ERD v2 đã triển khai**, áp dụng feedback ngày 2026-11-02. File được đồng bộ với `backend/prisma/schema.prisma` và migration `20261103000000_apply_erd_v2`.

Các thay đổi chính:

- `rooms` hấp thụ dữ liệu block và cơ chế schedule lock; không còn `room_blocks` hoặc `room_schedule_locks`.
- `users` là superclass, với ba subclass 1–1: `student_profiles`, `manager_profiles`, `admin_profiles`.
- Bỏ `refresh_tokens` và `system_settings.key_pickup_window_minutes`.
- `bookings.status` quản lý cả quy trình duyệt phòng và chìa khóa; không còn `key_status`.

## Quy tắc cần nhớ

- Mỗi `users` row phải có đúng một subclass khớp với `users.role` (total, disjoint specialization).
- State machine chính của booking là `PENDING -> APPROVED -> KEY_CHECKED_OUT -> COMPLETED`.
- `REJECTED` và `CANCELLED` là trạng thái kết thúc không giữ slot.
- Vì block được gộp vào `rooms`, mỗi phòng chỉ lưu một block hiện tại/gần nhất. Nếu cần nhiều lịch bảo trì trong tương lai hoặc lịch sử block, nên tách `room_blocks` trở lại.
- Backend phải khóa row `rooms` trong transaction trước khi kiểm tra và cập nhật lịch phòng.
- `booking_status_history` lưu toàn bộ lịch sử trạng thái; `audit_logs.target_id` là polymorphic nên không có FK.
- `system_settings` là singleton row với `id = default`.

Tài liệu cú pháp: [DBML Syntax](https://dbml.dbdiagram.io/docs/) và [dbdiagram editing guide](https://docs.dbdiagram.io/basic-editing-experience/).
