# V4 — Đồng bộ Web ↔ App

Bản V4 giữ ứng dụng hiện tại và bổ sung nền tảng để đồng bộ cloud.

## Cách hoạt động

- Web GitHub Pages và app "Add to màn hình chính" cùng mở một ứng dụng web.
- Dữ liệu cục bộ vẫn được giữ để app hoạt động offline.
- Khi cấu hình Supabase, dữ liệu có thể đồng bộ qua internet giữa các thiết bị.

## Cần cấu hình Supabase

1. Tạo một project Supabase.
2. Tạo bảng `timepay_records` với các cột:
   - `id` (text, primary key)
   - `user_id` (text, not null)
   - `payload` (jsonb, not null)
   - `updated_at` (timestamptz, not null, default now())
3. Bật Row Level Security và chỉ cho phép người dùng truy cập bản ghi của chính mình.
4. Lấy Project URL và anon/publishable key.
5. Gắn chúng vào cấu hình cloud của app.

> Lưu ý: không đưa `service_role` key vào frontend/GitHub Pages.

## Trạng thái V4

V4 là bản chuẩn bị sẵn lớp cloud-sync, chưa tự động kết nối tới tài khoản Supabase cụ thể vì project URL/key và cơ chế đăng nhập của chủ app chưa được cung cấp.

## Cài như app trên iPhone

Sau khi deploy GitHub Pages:
- Mở web bằng Safari.
- Chọn Chia sẻ → Thêm vào Màn hình chính.
- Mở bằng icon mới.

Web và app này dùng cùng một địa chỉ web, nên khi phần cloud được cấu hình chúng sẽ dùng chung dữ liệu.
