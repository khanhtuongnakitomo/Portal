# TNE Portal ERD

File DBML chính: [`TNE_PORTAL_ERD.dbml`](TNE_PORTAL_ERD.dbml).

## Mở bằng dbdiagram.io

1. Mở [dbdiagram.io](https://dbdiagram.io/).
2. Tạo diagram mới và chọn DBML.
3. Copy toàn bộ nội dung `TNE_PORTAL_ERD.dbml` vào editor bên trái.
4. Diagram sẽ được render tự động; dùng toolbar để export PNG hoặc PDF.

## Trạng thái tài liệu

Đây là **ERD v2 đã triển khai**, gồm phần mở rộng email và phân biệt booking cá nhân với hoạt động chính thức. Xem `backend/prisma/schema.prisma` và các migration trong `backend/prisma/migrations` để biết schema hiện hành.

Các thay đổi chính:

- `rooms` hấp thụ dữ liệu block và cơ chế schedule lock; không còn `room_blocks` hoặc `room_schedule_locks`.
- `users` là superclass, với ba subclass 1–1: `student_profiles`, `manager_profiles`, `admin_profiles`.
- Bỏ `refresh_tokens` và `system_settings.key_pickup_window_minutes`.
- `bookings.status` quản lý cả quy trình duyệt phòng và chìa khóa; không còn `key_status`.
- `bookings.is_event` phân biệt hoạt động chính thức với booking cá nhân; không suy ra từ role hiện tại của chủ booking.
- `notification_outbox` lưu email booking mới và kết quả duyệt/từ chối trong cùng transaction và cho phép worker Resend retry an toàn.

## Quy tắc cần nhớ

- Mỗi `users` row phải có đúng một subclass khớp với `users.role` (total, disjoint specialization).
- State machine chính của booking là `PENDING -> APPROVED -> KEY_CHECKED_OUT -> COMPLETED`.
- PostgreSQL exclusion constraint ngăn `APPROVED` và `KEY_CHECKED_OUT` chồng lịch trong cùng phòng; các booking `PENDING` có thể cạnh tranh.
- `REJECTED` và `CANCELLED` là trạng thái kết thúc không giữ slot.
- Vì block được gộp vào `rooms`, mỗi phòng chỉ lưu một block hiện tại/gần nhất. Phải hủy block `ACTIVE` chưa hết hạn trước khi tạo block mới.
- Backend phải khóa row `rooms` trong transaction trước khi kiểm tra và cập nhật lịch phòng.
- `booking_status_history` lưu toàn bộ lịch sử trạng thái; `audit_logs.target_id` là polymorphic nên không có FK.
- `system_settings` là singleton row với `id = default`.
- Mỗi booking `PENDING` có tối đa một notification cho mỗi manager nhờ `dedupe_key` duy nhất.

Tài liệu cú pháp: [DBML Syntax](https://dbml.dbdiagram.io/docs/) và [dbdiagram editing guide](https://docs.dbdiagram.io/basic-editing-experience/).
