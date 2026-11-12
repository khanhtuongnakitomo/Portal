# Email kết quả đặt phòng cho sinh viên

Sinh viên đặt phòng nhận email tại địa chỉ của tài khoản đã tạo booking khi manager/admin
duyệt hoặc từ chối. Email chứa phòng, vị trí, ngày giờ theo timezone hệ thống, mã yêu cầu,
ghi chú/lý do của manager và link tới Portal. Cả hai mẫu có bản HTML và bản văn bản.

## Mẫu 1 — Được duyệt

**Tiêu đề:** `[TNE Portal] Đặt phòng đã được duyệt — {{tên phòng}}`

> Chào {{tên sinh viên}},
>
> Yêu cầu đặt phòng của bạn đã được duyệt. Vui lòng kiểm tra thông tin bên dưới và sử dụng phòng đúng khung giờ.
>
> Mã yêu cầu: {{mã booking}}  
> Hoạt động: {{tên hoạt động}}  
> Phòng: {{tên phòng}} — {{vị trí}}  
> Bắt đầu: {{ngày giờ bắt đầu}}  
> Kết thúc: {{ngày giờ kết thúc}}  
> Ghi chú từ quản lý: {{ghi chú, chỉ hiện khi có}}
>
> Vui lòng mang theo thẻ sinh viên và mở digital pass trong mục Đặt phòng của tôi trên Portal khi đến phòng Manager nhận chìa khóa. Giữ gìn phòng, trang thiết bị và trả chìa khóa sau khi kết thúc.
>
> **Xem booking trong Portal** → `{{FRONTEND_URL}}/#/student`
>
> Trân trọng,  
> Ban quản lý phòng học TNE

## Mẫu 2 — Không được duyệt

**Tiêu đề:** `[TNE Portal] Đặt phòng không được duyệt — {{tên phòng}}`

> Chào {{tên sinh viên}},
>
> Yêu cầu đặt phòng của bạn hiện không được chấp thuận. Khung giờ này không còn được giữ cho bạn.
>
> Mã yêu cầu: {{mã booking}}  
> Hoạt động: {{tên hoạt động}}  
> Phòng: {{tên phòng}} — {{vị trí}}  
> Bắt đầu: {{ngày giờ bắt đầu}}  
> Kết thúc: {{ngày giờ kết thúc}}  
> Lý do: {{lý do của quản lý}}
>
> Bạn có thể chọn phòng hoặc thời gian khác trên Portal và gửi yêu cầu mới. Nếu cần làm rõ lý do, vui lòng liên hệ Manager để được hỗ trợ.
>
> **Chọn lịch và đặt phòng lại** → `{{FRONTEND_URL}}/#/student`
>
> Trân trọng,  
> Ban quản lý phòng học TNE

Khi không có lý do, mẫu ghi: “Quản lý chưa cung cấp lý do cụ thể. Vui lòng liên hệ Manager để được hỗ trợ.”
Nội dung do người dùng nhập được escape trong HTML; email không chứa mật khẩu, access token hoặc mã digital pass.
Mẫu thực thi nằm tại `backend/src/notifications/booking-decision-email.ts`.

## Quy tắc gửi và triển khai

- Duyệt: tạo `BOOKING_APPROVED` cho chủ booking là sinh viên (`USER`).
- Từ chối: tạo `BOOKING_REJECTED`, bao gồm các booking bị tự từ chối khi quản lý phân bổ
  hoạt động chính thức, duyệt một yêu cầu cạnh tranh, hoặc khóa phòng. Nếu phòng bị khóa
  sau khi booking đã được duyệt, sinh viên nhận thêm email từ chối để biết lịch không còn hiệu lực.
- Thay đổi trạng thái và email outbox nằm trong cùng transaction. Ghi hàng đợi lỗi thì
  quyết định không được commit. Worker gửi sau commit với retry/idempotency hiện có.
- Mỗi loại kết quả chỉ tạo một email cho mỗi booking/sinh viên; thao tác lặp thất bại không gửi thêm.
  Hủy bởi sinh viên và giao/trả chìa không tạo email kết quả duyệt.
- Không gửi hồi tố cho booking đã duyệt/từ chối trước khi triển khai.
- Chạy `pnpm prisma:generate`, `pnpm db:deploy`, `pnpm build` từ `backend` trước khi khởi động
  bản backend mới. Migration chỉ thêm hai giá trị vào enum sự kiện, giữ nguyên dữ liệu cũ.
- Giữ cấu hình Resend đang có. Khi chưa xác minh domain, `onboarding@resend.dev` chỉ gửi tới
  email chủ tài khoản Resend; gửi tới email sinh viên khác cần domain gửi đã xác minh.

Kiểm tra từ `backend`: `pnpm lint`, `pnpm test --runInBand`, `pnpm test:e2e --runInBand`, `pnpm build`.
E2E cần database kiểm thử riêng; kiểm tra `DATABASE_URL`/`DIRECT_URL` trước khi chạy.
