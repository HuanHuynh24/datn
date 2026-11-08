# Rà soát UI/UX tài khoản ứng viên

Ngày kiểm tra: 29/10/2026. Phạm vi: giao diện Next.js hiện có và các thao tác với dữ liệu mẫu trong trình duyệt.

## Danh sách màn hình và trách nhiệm

| Màn hình | Đường dẫn chính sau rà soát | Chức năng riêng | Kết luận |
| --- | --- | --- | --- |
| Tổng quan ứng viên | `/candidate` | Tóm tắt hồ sơ, CV, số đơn, lịch phỏng vấn và một phần gợi ý | Giữ, đưa thông tin tài khoản lên trước; chỉ xem trước 3 việc làm |
| Tìm việc | `/jobs` | Toàn bộ việc làm, từ khóa, địa điểm, bộ lọc và phân trang | Dùng chung cho khách và ứng viên; bỏ bản nội dung riêng tại `/candidate/jobs` |
| Chi tiết việc làm | `/jobs/[id]` | Mô tả, quyền lợi, lưu việc, chọn CV và ứng tuyển | Dùng một địa chỉ cho mỗi công việc; bỏ bản trùng `/candidate/jobs/[id]` |
| Việc làm phù hợp | `/candidate/recommended` | Danh sách có điểm phù hợp và thứ tự gợi ý | Giữ trang đầy đủ; tổng quan chỉ dẫn tới đây |
| Việc làm đã lưu | `/candidate/saved` | Các công việc người dùng chủ động lưu; tìm kiếm và bỏ lưu | Giữ, khác nguồn dữ liệu và mục đích với gợi ý |
| Việc làm đã ứng tuyển | `/candidate/applications` | Lịch sử, trạng thái xử lý, CV đã chọn, lịch phỏng vấn | Giữ; bộ lọc trạng thái được phản ánh trên URL |
| Hồ sơ nghề nghiệp | `/candidate/profile` | Chỉnh sửa thông tin cá nhân, liên hệ, kinh nghiệm, kỹ năng, học vấn | Giữ trong nhóm Hồ sơ & CV |
| Quản lý CV | `/candidate/cvs` | Tải tệp, tạo CV từ hồ sơ, xem trước, đổi tên, chọn mặc định, xóa | Giữ trong nhóm Hồ sơ & CV; đổi URL cũ `/candidate/upload-cv` để phù hợp cả chức năng quản lý |

Đăng nhập và đăng ký ứng viên là màn hình truy cập tài khoản; công ty và cẩm nang là nội dung dùng chung. Chúng không phải những bản sao của màn hình quản lý tài khoản.

## Các điểm trùng đã xác nhận và xử lý

1. **Hai URL cho cùng danh sách và cùng công việc.** Trước sửa, `/jobs` và `/candidate/jobs` cùng dùng `JobSearchPage`, cùng tập 29 công việc và bộ lọc. Mỗi công việc có hai URL chi tiết cùng dùng `JobDetailPage`. Đã bỏ việc sinh bản trang ứng viên riêng, dùng `/jobs` và `/jobs/[id]`. Header và các thao tác tài khoản sử dụng ngữ cảnh ứng viên của phiên trình duyệt, không cần nhân đôi URL.
2. **Tổng quan lặp nguyên danh sách gợi ý.** Trước sửa, `/candidate` hiển thị đủ 6 việc gợi ý, trùng đúng 6 việc tại `/candidate/recommended`, rồi thêm 6 việc mới giống một trang khám phá việc làm. Đã đưa thống kê, hồ sơ, CV và trạng thái ứng tuyển lên trước; bỏ khối việc mới; chỉ giữ 3 gợi ý xem trước và nút tới danh sách đầy đủ.
3. **Tên gọi khiến Hồ sơ và CV giống cùng một chức năng.** Menu “Tạo CV”, “Tải CV lên”, “Cập nhật CV”, “Hồ sơ của tôi” trước đây dẫn vòng giữa hai màn hình. Đã dùng nhóm “Hồ sơ & CV”, tên “Hồ sơ nghề nghiệp” và “Quản lý CV” nhất quán; thêm điều hướng chung với mô tả nhiệm vụ của mỗi mục. Nút chính trên hồ sơ sửa thông tin cá nhân ngay tại chỗ.
4. **Link footer trùng tác vụ.** “Việc làm” và “Tìm việc làm nhanh” trước đây cùng dẫn đến một trang. Đã giữ một mục “Tìm việc làm”.

## Các điểm giống nhau nhưng không nên gộp

- **Việc phù hợp và việc đã lưu:** dùng chung bố cục/card là hợp lý. Một danh sách lấy các công việc có điểm phù hợp; danh sách còn lại lấy ID người dùng đã lưu. Bỏ lưu phải ảnh hưởng ngay tới danh sách đã lưu, không xóa công việc khỏi gợi ý.
- **Hồ sơ nghề nghiệp và CV:** hồ sơ là thông tin có thể sửa; CV là tài liệu hoặc phiên bản được lưu để ứng tuyển. CV tạo từ hồ sơ là bản lưu độc lập, không phải một trang hồ sơ thứ hai. Đặt hai màn hình trong một nhóm giúp giữ rõ sự khác biệt này.
- **Card công việc ở trang tổng quan, gợi ý, lưu và tìm kiếm:** việc dùng chung component giữ giao diện nhất quán. Chỉ việc lặp nguyên danh sách và mục tiêu sử dụng mới tạo ra màn hình dư thừa.

## Các chỉnh sửa luồng sử dụng

- Link “Lịch phỏng vấn” tại tổng quan mở `/candidate/applications?status=Interview`, thay vì mở tất cả đơn như trước.
- Chọn nhóm trạng thái trong trang ứng tuyển cập nhật URL; tải lại trang giữ đúng nhóm đang chọn.
- Tìm kiếm, xem chi tiết, lưu việc và quản lý CV tiếp tục dùng ngữ cảnh tài khoản ứng viên khi chuyển sang URL dùng chung. Đi tới công ty hoặc cẩm nang không làm menu trở lại lời mời đăng nhập.
- Thanh điều hướng trên điện thoại đánh dấu “Tìm việc” cho chi tiết công việc và gợi ý; “Hồ sơ” cho cả hồ sơ nghề nghiệp lẫn CV.
- Trang tìm việc dùng cùng vị trí tìm kiếm và một biểu mẫu hiển thị theo kích thước màn hình, không giữ phần hero và biểu mẫu riêng của bản ứng viên cũ.

## Tương thích đường dẫn cũ

| Đường dẫn cũ | Chuyển hướng 308 tới |
| --- | --- |
| `/candidate/jobs` | `/jobs` |
| `/candidate/jobs/[id]` | `/jobs/[id]` |
| `/candidate/upload-cv` | `/candidate/cvs` |

Các query tìm kiếm được giữ nguyên về giá trị. Những lời gọi điều hướng nội bộ sử dụng tên trang cũ cũng được ánh xạ tới URL chung. Không thay đổi dữ liệu hồ sơ, tệp CV hay danh sách đã lưu khi chuyển đường dẫn.

## Mã nguồn liên quan

- `src/marketplace/routes.ts`, `next.config.ts`: URL chính và chuyển hướng.
- `src/marketplace/App.tsx`, `demo-store.ts`, `components/Nav.tsx`, `components/MobileNav.tsx`: ngữ cảnh hiển thị và điều hướng; không phải cơ chế xác thực.
- `pages/candidate/CandidateHomePage.tsx`: tổng quan tài khoản và gợi ý rút gọn.
- `components/ProfileNavigation.tsx`, `pages/candidate/CareerProfilePage.tsx`, `pages/CVUploadPage.tsx`: phân biệt hồ sơ với tài liệu CV.
- `pages/candidate/ApplicationsPage.tsx`: trạng thái đơn và bộ lọc có URL.

## Kết quả kiểm tra

- `npm run build`: thành công, bao gồm TypeScript và tạo trang tĩnh. Tổng số trang build giảm từ 90 xuống 60 do không còn sinh một danh sách và 29 trang chi tiết ứng viên bị lặp.
- 159 kiểm tra trình duyệt đạt. Rà soát đủ 8 loại màn hình tại các chiều rộng 1440, 1024, 390 và 360 px: không tràn ngang, một H1 cho mỗi trang, ảnh tải thành công, menu tài khoản đúng ngữ cảnh.
- Kiểm tra HTTP 308 và giữ nguyên giá trị từ khóa/địa điểm khi chuyển hướng URL cũ.
- Kiểm tra tìm kiếm từ tổng quan tới `/jobs`, mở chi tiết, lưu/bỏ lưu và trạng thái rỗng của danh sách đã lưu.
- Kiểm tra chuyển giữa hồ sơ và CV, tạo một CV mẫu, chọn CV mặc định khi ứng tuyển, và bản ghi mới xuất hiện trong lịch sử ứng tuyển.
- Kiểm tra nút lịch phỏng vấn, chuyển bộ lọc trạng thái, tải lại trang, menu mobile và phím Escape.
- Không ghi nhận ngoại lệ JavaScript trong các luồng đã kiểm tra. Kết quả chi tiết được lưu ở `.artifacts/candidate-ui-ux-qa.json`; ảnh trước/sau ở `.artifacts/candidate-audit-*.png`.

