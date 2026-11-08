# Cập nhật header theo actor

Ngày: 31/10/2026. Phạm vi: header, điều hướng theo vai trò, menu mobile và tìm kiếm liên quan đến header.

## Vấn đề đã xử lý

- Hai tầng menu cùng dẫn tới các chức năng tương tự, tạo hai vị trí active và làm header chiếm nhiều chiều cao.
- Header ở trang tìm việc thay toàn bộ menu bằng ô tìm kiếm, khiến các lối vào tài khoản khó tìm hơn.
- Menu “Tài khoản” không cho biết người dùng và vai trò hiện tại.
- Biểu tượng tin nhắn dẫn tới danh sách hồ sơ/đơn ứng tuyển, không phải chức năng nhắn tin; cờ ngôn ngữ chỉ là trang trí.
- Nhà tuyển dụng mở nội dung dùng chung bị chuyển về header khách.
- Menu mobile dài, trùng đích đến; thanh dưới của khách lại hiển thị tác vụ riêng của ứng viên.
- Ô tìm kiếm desktop/mobile không dùng cùng trạng thái khi đổi độ rộng màn hình hoặc tải lại danh sách.

## Cấu trúc mới

| Actor | Điều hướng chính | Tài khoản / nội dung thêm | Hành động nổi bật |
| --- | --- | --- | --- |
| Khách | Tìm việc làm, Công ty, Hồ sơ & CV, Cẩm nang | Đăng nhập; lối vào nhà tuyển dụng | Đăng ký |
| Ứng viên | Tổng quan, Tìm việc, Hồ sơ & CV, Đã lưu, Đã ứng tuyển | Tên ứng viên; hồ sơ nghề nghiệp, công ty, cẩm nang và chuyển khu vực | Tải CV lên |
| Nhà tuyển dụng | Tổng quan, Tin tuyển dụng, Ứng viên, Quy trình | Tên doanh nghiệp; hồ sơ công ty, nội dung dùng chung và chuyển khu vực | Đăng tin |

- Mỗi actor có **một hàng điều hướng chính**: 72 px nội dung trên desktop, 64 px trên tablet/mobile, cộng đường biên dưới 1 px. Bỏ component và style của thanh `WorkspaceNavigation` cũ.
- Giữ cùng logo, khung căn giữa, typography, màu thương hiệu, chiều cao và quy tắc active. Chỉ menu nổi dùng shadow.
- Các mục đã gom vẫn giữ đủ đường dẫn: việc làm phù hợp nằm trong Tìm việc; tìm nhân tài và ứng viên phù hợp nằm trong Ứng viên; hồ sơ công ty nằm trong menu doanh nghiệp.
- Tại trang việc làm, thanh tìm kiếm là vùng công cụ riêng bên dưới header. Menu chính vẫn giữ nguyên; ô nhập dùng chung trạng thái với form tìm kiếm mobile.
- Tên, chữ viết tắt và vai trò lấy từ dữ liệu hồ sơ hiện có. Tên dài được giới hạn trên header và hiển thị đầy đủ trong menu.
- Đăng tin/Tải CV lên không lặp lại thành nút dẫn về chính trang đang mở. Các thao tác của form bên trong trang được giữ nguyên.
- Dùng `Link` với URL thật cho các đích điều hướng, hỗ trợ mở tab mới; click thông thường vẫn cập nhật ngữ cảnh actor như luồng cũ.
- Giữ ngữ cảnh nhà tuyển dụng khi đọc cẩm nang hoặc mở trang công ty. Đây là trạng thái giao diện trong phiên, không phải cơ chế phân quyền Backend.

## Mobile và bàn phím

- Dưới 1200 px, menu chuyển thành drawer tối đa 390 px; vừa màn hình nhỏ, cuộn bên trong, khóa cuộn nền khi mở.
- Drawer hiển thị tên/vai trò, nhóm tác vụ, mục hiện tại và lối chuyển khu vực. Mỗi đích xuất hiện một lần trong danh sách menu.
- Escape đóng menu và trả focus về nút mở. Dialog giữ focus bên trong. Khi đổi sang desktop, drawer tự đóng và trả lại khả năng cuộn trang.
- Guest bottom navigation: Trang chủ, Tìm việc, Công ty, Cẩm nang, Đăng nhập. Ứng viên giữ điều hướng nhanh theo tài khoản; nhà tuyển dụng dùng drawer riêng.
- Các menu desktop đóng bằng Escape hoặc click ra ngoài, dùng thứ tự Tab thông thường.

## File thay đổi

- `src/marketplace/components/Nav.tsx`: header và drawer theo vai trò.
- `src/marketplace/components/header-navigation.ts`: cấu hình menu dùng chung cho desktop/mobile.
- `src/marketplace/components/HeaderSearch.tsx`: đồng bộ trạng thái tìm kiếm với danh sách.
- `src/marketplace/components/MobileNav.tsx`: nhóm điều hướng dành cho khách.
- `src/app/header.css`, `src/app/globals.css`: style header mới và import.
- `src/app/workspace-visuals.css`: bỏ style của tầng điều hướng cũ.
- `src/marketplace/App.tsx`, `demo-store.ts`, `pages/AuthPages.tsx`: giữ đúng vai trò khi điều hướng và chuyển tài khoản trong demo.
- Xóa `src/marketplace/components/WorkspaceNavigation.tsx`; các chức năng được chuyển vào header mới.

## Xác minh

Kết quả và ảnh chụp được lưu trong `.artifacts/header-responsive-results.json`, `.artifacts/header-interaction-results.json` và các ảnh `header-*.png`.

- 36 lượt kiểm tra bố cục tại 1440, 1200, 1024, 768, 390 và 360 px: đúng chiều cao, đúng actor, không tràn ngang, không chồng menu với hành động, không còn tầng navigation cũ.
- **45 kiểm tra tương tác đạt**: đường dẫn đăng nhập/đăng ký, chuyển actor, active theo trang con, tài khoản, logo về tổng quan, CTA, tìm kiếm, giữ vai trò trên nội dung chung và sau refresh, menu mobile, Escape/focus, resize và trạng thái tìm kiếm giữa các kích thước. Không ghi nhận JavaScript runtime exception.
- **Lint đạt** (`npm.cmd run lint`; kiểm tra lại toàn bộ `src` sau thay đổi cuối bằng ESLint). **TypeScript đạt** (`npx.cmd tsc --noEmit` và bước kiểm tra TypeScript trong build cuối). **Production build đạt**, sinh 60 trang tĩnh.
- Preview dùng Chrome headless và server local. Chưa kiểm thử Safari/iOS trên thiết bị thật. Không thay đổi API, thêm chức năng tin nhắn/ngôn ngữ hoặc triển khai Backend.
