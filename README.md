# Chấm công & Tính lương

App web chạy trực tiếp trên trình duyệt, phù hợp đưa lên GitHub Pages.

## Chức năng
- Thêm / sửa / xóa ca.
- Tính thời gian theo phút thực tế.
- Ca qua 00:00.
- Kiểm tra mọi trường hợp ca bị giao nhau.
- Lương = phút thực tế × đơn giá / 60.
- Thưởng / phụ cấp / khoản khác, từng khoản có tùy chọn "Tính vào lương".
- Thống kê tháng.
- Nhập lịch nhanh nhiều dòng: `1/9, Lani, 18-22`.
- Backup / restore JSON.
- Responsive cho màn hình điện thoại.

## Chạy
Mở `index.html` hoặc đưa toàn bộ thư mục lên GitHub Pages.

Dữ liệu được lưu trong `localStorage` của trình duyệt. Hãy xuất backup định kỳ nếu cần chuyển thiết bị/trình duyệt.


## V4 Cloud Sync
Đã bổ sung `cloud-sync.js` làm lớp kết nối cloud, sẵn sàng cho đồng bộ Web ↔ App.
