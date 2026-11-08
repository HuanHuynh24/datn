# Talentiq Frontend

Giao diện Next.js được chuyển từ `Thiết kế theo file mô tả.zip`. Các trang công khai được dựng lại theo bố cục [CareerLink](https://www.careerlink.vn/): header 58px, banner ngang có tìm kiếm phủ bên trên, 3 cột việc làm cao 125px, lưới icon ngành nghề, nhà tuyển dụng, cẩm nang và footer xanh đậm. Giữ tên ứng dụng Talentiq.

## Chạy dự án

```powershell
npm.cmd install
npm.cmd run dev
```

Mở http://localhost:3000. Trên terminal không bị chặn script PowerShell có thể dùng `npm` thay cho `npm.cmd`.

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run start
```

## Các khu vực

| Khu vực | Đường dẫn |
| --- | --- |
| Trang chủ | `/` |
| Tìm việc | `/jobs` |
| Chi tiết việc làm mẫu | `/jobs/j1` |
| Đăng nhập | `/sign-in` |
| Đăng ký ứng viên / nhà tuyển dụng | `/sign-up/candidate`, `/sign-up/recruiter` |
| Trang ứng viên | `/candidate` |
| Tất cả việc làm cho ứng viên / chi tiết | `/candidate/jobs`, `/candidate/jobs/j1` |
| Hồ sơ nghề nghiệp | `/candidate/profile` |
| Quản lý CV | `/candidate/upload-cv` |
| Việc làm gợi ý / đã lưu / đã ứng tuyển | `/candidate/recommended`, `/candidate/saved`, `/candidate/applications` |
| Trang nhà tuyển dụng | `/recruiter` |
| Tin tuyển dụng / đăng tin | `/recruiter/jobs`, `/recruiter/jobs/new` |
| Ứng viên / tìm nhân tài / gợi ý | `/recruiter/applicants`, `/recruiter/talent-search`, `/recruiter/recommended` |
| Hồ sơ ứng viên mẫu | `/recruiter/candidates/ca1` |
| Quy trình tuyển dụng | `/recruiter/pipeline` |
| Công ty / tài nguyên nghề nghiệp / hồ sơ công ty | `/companies`, `/career`, `/recruiter/company` |

Header dùng menu riêng cho trang công khai, ứng viên và nhà tuyển dụng, đánh dấu mục đang xem và đóng menu khi chuyển trang. Trang tìm kiếm và chi tiết việc làm có tìm kiếm ngay trên header desktop. Mobile dùng menu mở rộng theo đúng vai trò; thanh điều hướng dưới chỉ xuất hiện ở khu vực công khai và ứng viên.

## Phạm vi

- Chỉ triển khai frontend. Dữ liệu mẫu của dashboard nằm trong `src/marketplace/data.ts`; dữ liệu hiển thị để đối chiếu web mẫu nằm trong `reference-data.json`, được ánh xạ sang việc làm mẫu ở `public-data.ts`.
- Trang chủ có banner và danh sách chuyển trang, ngành nghề, nhà tuyển dụng, cẩm nang. Trang tìm việc dùng bộ lọc ngang, danh sách một cột và banner bên phải trên desktop; bộ lọc mobile dùng hộp thoại hỗ trợ bàn phím. Trang Công ty có tìm theo tên/địa điểm; trang Cẩm nang có tìm kiếm, lọc chủ đề và mở bài viết tương ứng từ trang chủ.
- Các màn hình ứng viên/nhà tuyển dụng dùng chung navigation, typography, form, màu sắc và trạng thái trống. Hồ sơ cá nhân và hồ sơ công ty có hộp thoại chỉnh sửa; tài liệu và thao tác giao diện bằng tiếng Việt.
- Tương tác tìm kiếm, lọc/sắp xếp việc làm, phân trang, tab ứng tuyển, menu mobile, form nhiều bước và kéo thả pipeline chạy trong trình duyệt.
- Bộ lọc chỉ mở một bảng tại một thời điểm, đóng khi nhấn bên ngoài hoặc Escape. Lưới ngành nghề giữ đầy đủ tên, phân trang 12 mục trên desktop và 6 mục trên mobile.
- Trang đăng tuyển dùng header nhà tuyển dụng và form 4 bước bằng tiếng Việt, giữ dữ liệu khi quay lại bước trước, kiểm tra trường bắt buộc và xem trước nội dung. Bản nháp được lưu trong `sessionStorage`, có thể mở lại trong cùng phiên trình duyệt; chưa đăng tin lên máy chủ.
- Tìm kiếm từ trang chủ truyền từ khóa/địa điểm qua URL; các màn hình có URL riêng và hỗ trợ tải lại, Back/Forward.
- `demo-store.ts` đồng bộ việc làm đã lưu, đơn ứng tuyển, hồ sơ, trạng thái tin/ứng viên, ghi chú và lịch phỏng vấn giữa các trang trong cùng phiên trình duyệt. Không gọi API; dữ liệu demo này không được lưu sau khi đóng phiên. Mật khẩu không được lưu.
- Khu vực ứng viên có mục Tất cả việc làm, đủ dữ liệu danh sách và phân trang; tìm kiếm, xem chi tiết, công việc tương tự và quay lại danh sách đều giữ header ứng viên. Việc làm gợi ý là mục riêng.
- Quản lý tối đa 5 CV: tải PDF/DOCX tối đa 10 MB, đặt tên, chọn mặc định, xem trước, tải xuống và xác nhận xóa. Tệp được lưu bằng IndexedDB trên thiết bị; thông tin danh sách và CV mặc định được lưu bằng localStorage nên có thể mở lại trên cùng trình duyệt. Không gửi tệp đến máy chủ. PDF dùng trình xem tích hợp của trình duyệt; DOCX có nút tải để mở bằng ứng dụng phù hợp, chưa trích xuất nội dung.
- Có thể tạo CV từ hồ sơ với bố cục Cơ bản hoặc Chuyên nghiệp. Bản CV lưu một bản sao nội dung hồ sơ tại thời điểm tạo và được xem trực tiếp trong ứng dụng. CV mặc định được chọn sẵn khi ứng tuyển; người dùng có thể chọn CV khác hoặc hồ sơ nghề nghiệp. Đơn ứng tuyển mẫu ghi lại tên CV đã chọn.
- Đăng nhập/đăng ký kiểm tra trường nhập và cho chọn vai trò. Quên mật khẩu là mô phỏng, không gửi email. Ứng tuyển và lên lịch phỏng vấn không gửi dữ liệu ra ngoài.
- Quản lý tin có tìm kiếm, lọc trạng thái, sửa chức danh, tạm dừng/mở lại và xác nhận đóng tin. Hồ sơ ứng viên có lưu, ghi chú, xem CV mẫu và lịch phỏng vấn. Bảng quy trình hỗ trợ kéo thả hoặc chọn trạng thái bằng bàn phím/mobile.
- Banner, icon ngành nghề và ảnh doanh nghiệp/bài viết tham chiếu CareerLink đã lưu tại `public/images/careerlink`. Đây là snapshot giao diện, không phải nguồn tuyển dụng trực tiếp. Không sao chép thông tin pháp lý hoặc thông tin liên hệ của CareerLink vào Talentiq. Font Google cần mạng để tải; có font hệ thống dự phòng.

## Cấu trúc

- `src/app`: entrypoint, metadata, global CSS và route Next.js.
- `src/marketplace/App.tsx`: ghép các màn hình với navigation/footer.
- `src/marketplace/routes.ts`: ánh xạ tên màn hình sang URL.
- `src/marketplace/components`: component dùng chung từ bản ZIP.
- `src/marketplace/pages`: các màn hình công khai, ứng viên và nhà tuyển dụng.
- `public/images/design`: ảnh gốc kèm theo ZIP.
- `public/images/careerlink`: 88 ảnh/icon tham chiếu được tải từ web mẫu.
- `public/images/workspace`: ảnh công việc, đội ngũ và chân dung minh họa. Nguồn ảnh, tác giả và liên kết giấy phép được ghi tại `sources.json`; ảnh chân dung gắn với hồ sơ hư cấu, không phải danh tính thật của người trong ảnh.
- `src/app/careerlink.css`: kích thước và responsive cho các thành phần theo mẫu.
- `src/marketplace/components/JobCard.tsx` và `src/app/job-cards.css`: mẫu công việc dùng chung cho tìm kiếm, gợi ý, đã lưu, đã ứng tuyển và quản lý tuyển dụng. Dùng `cl-job-collection` cho danh sách; không ghi đè typography/logo theo từng trang. Trạng thái và thao tác theo vai trò được truyền vào cùng component.
- `src/app/components.css`: điều hướng, dropdown, lưới ngành nghề và form đăng tuyển đã điều chỉnh theo phản hồi giao diện.
- `src/app/workspace.css` và `src/marketplace/ui.tsx`: thành phần và responsive dùng chung cho các trang nghiệp vụ.
- `src/app/workspace-visuals.css`, `WorkspaceHero.tsx` và `ProfilePhoto.tsx`: hero ảnh theo vai trò, ảnh phụ và chân dung dùng nhất quán giữa danh sách, hồ sơ và pipeline.
- `src/marketplace/demo-store.ts`: trạng thái demo trong phiên; `job-copy.ts`: nội dung mô tả tiếng Việt cho các việc làm mẫu.

## Kiểm tra

Production build kiểm tra TypeScript và tạo các route tĩnh. Kiểm tra Chrome headless bao gồm desktop/tablet/mobile, tìm kiếm qua URL, bộ lọc, menu/drawer mobile, banner/danh sách chuyển trang, tìm công ty, nội dung cẩm nang và các thao tác demo trong dashboard.

## Quy ước màu và bề mặt

- Token dùng chung ở `globals.css`: nội dung trắng, chữ chính `#25282c`, chữ phụ `#6b7078`. Trang tìm việc, ứng viên và nhà tuyển dụng dùng cùng nền trắng; bề mặt phụ dùng `--ui-subtle`, hover dùng `--ui-hover`. Hero dùng cùng nền trắng chuyển tiếp vào ảnh. Xanh `#0069db` dành cho thương hiệu, liên kết và thao tác chính.
- Chiều rộng nội dung dùng `--layout-content` (1110px), sidebar `--layout-sidebar` (253px) và khoảng cách cột `--layout-gap` (32px); hero vẫn full width.
- Khối nội dung dùng khoảng cách và nền để phân nhóm; không thêm khung xanh quanh panel. Đường phân cách danh sách dùng `--ui-line`; ô nhập dùng `--ui-input-border` và trạng thái focus rõ ràng.
- Menu nổi dùng `--ui-shadow-menu`, hộp thoại dùng `--ui-shadow-dialog`; không đổi card sang viền xanh hoặc bóng màu khi hover.
- Trang chi tiết việc làm có khối tiêu đề/mức lương/hành động riêng, phần mô tả dễ đọc và thông tin phụ ở bên cạnh. Không lặp nút ứng tuyển trong sidebar.

Hero trải hết chiều rộng trang, nằm ngay dưới header và ở ngoài container nội dung. Phần chữ giữ cùng lề với nội dung bên dưới; ảnh chuyển nhẹ vào nền bằng CSS mask. Hero tổng quan cao hơn hero của trang quản lý, không dùng khung hoặc bo góc kiểu card. Ảnh vẫn hiển thị trên điện thoại với chiều cao giới hạn. Ảnh được lưu cục bộ và phân phối bằng Next Image theo kích thước màn hình; không phụ thuộc hotlink ảnh bên ngoài.
