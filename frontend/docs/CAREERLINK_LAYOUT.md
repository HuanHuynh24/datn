# Đối chiếu giao diện CareerLink

Nguồn: https://www.careerlink.vn/ và trang `/viec-lam/viec-lam-hap-dan`, đối chiếu trực tiếp bằng Chrome ngày 17/10/2026.

| Thành phần | Bản dựng |
| --- | --- |
| Header | 58px, nền trắng; menu theo vai trò, đánh dấu trang hiện tại; giữ khi cuộn. Trang đăng tuyển dùng header nhà tuyển dụng |
| Banner | Ảnh ngang toàn chiều rộng; hai ô tìm kiếm và nút tìm trên desktop |
| Tìm kiếm mobile | Một ô nhập và nút tìm, nằm phía trên banner |
| Khung trang chủ | Tối đa 1.410px gồm padding ngang 55px, phần nội dung khoảng 1.300px |
| Việc làm nổi bật | 3 cột desktop, 2 cột tablet, 1 cột mobile; card 125px; logo 96px |
| Ngành nghề | Icon nét xanh trong vòng tròn; 6 cột desktop, 4 cột tablet, 2 cột mobile. Giữ đầy đủ tên; phân trang 12 mục desktop / 6 mục mobile |
| Doanh nghiệp | 4 thẻ desktop; ảnh cover và logo tròn; cuộn ngang trên mobile |
| Cẩm nang | 5 cột desktop; ảnh tỷ lệ 16:9, nhãn màu cam |
| Footer | Nền xanh đậm, 4 cột desktop, 2 cột mobile |
| Tìm việc | Bộ lọc ngang chỉ mở một bảng, hỗ trợ đóng bên ngoài và Escape; kết quả một cột, banner bên phải; drawer mobile |
| Điều hướng mobile | Menu mở rộng theo vai trò; thanh dưới 5 mục cho trang công khai và ứng viên |
| Đăng tuyển | Form tiếng Việt 4 bước, khoảng cách gọn, có kiểm tra dữ liệu và xem trước; chưa xử lý backend |

Tên Talentiq và các màn hình nghiệp vụ từ ZIP được giữ lại. Banner và hình ảnh tham chiếu được lưu cục bộ, danh sách nguồn ở `CAREERLINK_ASSET_SOURCES.json`. Nội dung tuyển dụng trong `reference-data.json` là snapshot phục vụ xem giao diện; không phải dữ liệu cập nhật trực tiếp. Các trang chi tiết tương ứng dùng dữ liệu mẫu và có URL riêng.

Build kiểm tra TypeScript và tạo route tĩnh. Kiểm tra trình duyệt đối chiếu kích thước 1440px, 768px, 390px; kiểm tra tìm kiếm, bộ lọc, chuyển banner/danh sách, điều hướng, form nhiều bước và kéo thả pipeline. Không bổ sung backend.
