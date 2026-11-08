# Đánh giá “Thiết kế theo file mô tả.zip”

## Kết luận

Đây là bản mẫu giao diện nền tảng tuyển dụng viết bằng React + Vite + Tailwind CSS, xuất từ Figma Make. Mã có thể dùng làm tài liệu tham khảo và nguồn component khi triển khai Next.js. Chưa đủ cơ sở coi đây là ứng dụng tuyển dụng hoàn chỉnh: nhiều màn hình còn thiếu và các nghiệp vụ chính đang mô phỏng trong trình duyệt.

Tài liệu trong ZIP chủ yếu yêu cầu thiết kế trải nghiệm. Vì vậy, dữ liệu mẫu là chấp nhận được để trình diễn; tuy nhiên, những tương tác chưa hoàn thiện vẫn làm gián đoạn việc kiểm thử các hành trình mà tài liệu yêu cầu.

Hai tài liệu đối chiếu:

- `src/imports/pasted_text/recruitment-platform-design.md`: 36 nhóm yêu cầu về trang, luồng nghiệp vụ, responsive, component và accessibility.
- `src/imports/pasted_text/visual-direction.md`: yêu cầu hình ảnh, bố cục kể chuyện và tính nhất quán thị giác.

Các đường dẫn và số dòng bên dưới thuộc mã gốc trong ZIP, không phải thư mục `src/app` của dự án Next.js hiện tại.

## Phát hiện ưu tiên cao

### 1. Form đăng tin mất dữ liệu khi chuyển bước

**Vị trí:** `src/pages/recruiter/CreateJobPage.tsx:14`, `:80`, `:121`, `:144`, `:198`, `:250`.

Chỉ kỹ năng, ô nhập kỹ năng và bước hiện tại được quản lý bằng state. Những input như tiêu đề, mô tả, địa điểm và lương không lưu vào một đối tượng form. Mỗi bước render có điều kiện, nên input bị tháo khỏi cây giao diện khi chuyển bước.

**Cách tái hiện dự kiến từ mã:** nhập Job Title → Next → Back; ô tiêu đề được tạo lại và mất nội dung. Publish Job chỉ điều hướng về danh sách, không thêm tin. Preview và Save Draft cũng chưa có xử lý tương ứng.

**Đề xuất:** quản lý toàn bộ form bằng state hoặc thư viện form; kiểm tra dữ liệu từng bước; lưu nháp, preview và publish phải dùng cùng một bộ dữ liệu.

### 2. Lưu việc và ứng tuyển không liên thông với danh sách

**Vị trí:** `src/components/JobCard.tsx:12`, `src/pages/JobDetailPage.tsx:13`, `src/App.tsx:138`, `src/pages/candidate/ApplicationsPage.tsx:1`.

Saved và Applied chỉ là state riêng của từng component. Thoát màn hình rồi quay lại làm mất trạng thái. Trang Saved lại render RecommendedJobsPage, tức hiển thị các việc gợi ý thay vì việc đã lưu. Applications đọc danh sách mẫu từ `data.ts`, không nhận hồ sơ vừa ứng tuyển.

**Tác động:** hành trình “Save → Saved Jobs” và “Apply → Track Application” không hoạt động đúng ngay cả ở mức demo.

**Đề xuất:** dùng nguồn dữ liệu chung theo job ID/application ID, sau đó kết nối API và lưu bền vững.

### 3. Chưa xác thực và chưa phân quyền thực tế

**Vị trí:** `src/pages/AuthPages.tsx:74`, `src/App.tsx:69`.

Nút đăng nhập/đăng ký chỉ điều hướng, không đọc và xác minh thông tin tài khoản. Bộ chuyển chế độ Public/Candidate/Recruiter cho phép vào các khu vực trực tiếp. Chế độ navigation được suy ra từ tên trang, không từ phiên đăng nhập.

**Tác động:** phù hợp với demo có gắn nhãn, chưa thể dùng làm cơ chế bảo vệ dữ liệu. Đăng nhập tại màn hình Sign In luôn đi vào Candidate vì `isRecruiter` chỉ đúng ở màn hình đăng ký Recruiter.

**Đề xuất:** xác định phiên và vai trò từ backend, bảo vệ thao tác ở API; điều hướng theo vai trò sau đăng nhập.

### 4. Phân tích CV và chỉnh sửa hồ sơ chưa hoàn thành

**Vị trí:** `src/pages/CVUploadPage.tsx:25`, `:49`, `:184`; `src/pages/candidate/CareerProfilePage.tsx:196`.

CV chỉ được lấy tên và kích thước; tiến trình dùng timer và số ngẫu nhiên. Kết quả luôn là cùng một người và cùng bộ kỹ năng, không đọc nội dung file. Luồng drop không kiểm tra định dạng hoặc giới hạn 10 MB như giao diện công bố; file picker cũng không kiểm tra kích thước. `accept` chỉ hỗ trợ lựa chọn file, không thay thế validation.

Modal chỉnh sửa hồ sơ chỉ có mô tả cùng Cancel/Save Changes, không có input hoặc cập nhật dữ liệu. Vì vậy người dùng không thể rà soát, sửa, thêm, xóa thông tin trích xuất theo mục 19 của tài liệu.

**Đề xuất:** tách upload, trạng thái xử lý, kết quả và xác nhận; lưu dữ liệu editable; có lỗi, retry và cleanup timer nếu tiếp tục giữ chế độ demo.

### 5. Danh sách ứng viên không gắn với tin tuyển dụng được chọn

**Vị trí:** `src/pages/recruiter/JobPostsPage.tsx:63`, `src/App.tsx:145`, `src/pages/recruiter/ApplicantsPage.tsx:18`, `:35`.

Nút View Candidates truyền job vào điều hướng nhưng App không truyền job đó cho ApplicantsPage. Trang này luôn lọc toàn bộ `candidates` mẫu và luôn hiện “Senior Backend Developer”.

**Tác động:** chọn ứng viên của các tin khác nhau vẫn ra cùng danh sách; chưa thể đánh giá độ phù hợp theo từng vị trí.

**Đề xuất:** dùng route có job ID và dữ liệu application/matching theo job ID.

## Phát hiện ưu tiên trung bình

### 6. Tìm kiếm trang chủ bỏ qua nội dung nhập

**Vị trí:** `src/pages/HomePage.tsx:80`, `:83`; `src/pages/JobSearchPage.tsx:16`.

Trang chủ lưu keyword/location nhưng `handleSearch` chỉ đổi màn hình. Trang kết quả khởi tạo lại hai giá trị rỗng. Tìm “React” hoặc một địa điểm rồi Search sẽ không giữ điều kiện đó.

**Đề xuất:** truyền bộ lọc qua query string và dùng query làm nguồn cho form tìm kiếm.

### 7. Nhiều bộ lọc và thao tác chỉ có hình thức

**Vị trí:** `src/pages/JobSearchPage.tsx:83`, `:154`, `:181`; `src/pages/recruiter/ApplicantsPage.tsx:83`, `:92`, `:116`; `src/pages/candidate/ApplicationsPage.tsx:88`.

Job Search có lọc thật theo từ khóa, địa điểm, loại việc, cách làm việc và cấp độ. Tuy nhiên Category không có handler, select sắp xếp không cập nhật kết quả và phân trang không chuyển dữ liệu. Chưa có bộ lọc lương/ngày đăng theo mô tả.

Applicants chỉ lọc tìm kiếm và trạng thái; Experience, Match Level và sort chưa hoạt động. Các mục All/Active/Interview/Rejected của Applications được render bằng span, không phải tab có xử lý.

**Đề xuất:** hoàn thiện logic các control đang hiển thị; tránh tạo cảm giác đã lọc trong khi kết quả không đổi.

### 8. Điều hướng không có URL riêng

**Vị trí:** `src/App.tsx:50`.

Màn hình được chọn bằng `useState`. Reload quay về home; không có deep link tới job/candidate hoặc tích hợp Back/Forward của trình duyệt. `pageData as Job/Candidate` chỉ ép kiểu, không kiểm tra dữ liệu lúc chạy.

**Đề xuất khi chuyển Next.js:** dùng App Router với các trang `/jobs`, `/jobs/[id]`, `/candidate/...`, `/recruiter/jobs/[id]/applicants`; dùng ID thay vì truyền toàn bộ object làm dữ liệu điều hướng.

### 9. Điểm thành phần của matching chưa lấy từ dữ liệu thực

**Vị trí:** `src/components/MatchBadge.tsx:82`, `:141`; `src/pages/JobDetailPage.tsx:174`; `src/pages/recruiter/CandidateProfilePage.tsx:122`.

MatchDetail mặc định Skills/Experience/Education là 95/90/85; hai trang gọi không truyền các điểm này. Nhiều hồ sơ khác nhau sẽ có cùng bộ điểm thành phần. Nút “Why this matches you” chưa có handler. Ngưỡng màu giữa Badge, Summary và Detail cũng chưa thống nhất.

**Đề xuất:** dùng một kiểu dữ liệu MatchResult và quy tắc hiển thị thống nhất; dữ liệu demo cần được nhận diện rõ trước khi triển khai thật.

### 10. Responsive và accessibility chưa đáp ứng đầy đủ

**Vị trí:** `src/pages/recruiter/ApplicantsPage.tsx:51`, `src/components/JobCard.tsx:15`, `src/components/CandidateCard.tsx:18`, `src/pages/JobSearchPage.tsx:42`, `src/pages/AuthPages.tsx:104`.

Applicants ẩn bộ lọc trên mobile mà không có drawer thay thế. Card dùng div có onClick nên không tự có khả năng focus/kích hoạt bằng bàn phím. Một số checkbox được mô phỏng bằng div. Label ở form xác thực không liên kết với input bằng `htmlFor/id`. Drawer và modal chưa có đủ ngữ nghĩa dialog, quản lý focus và xử lý Escape. Pipeline có HTML drag-and-drop nhưng chưa có phương án thao tác tương đương bằng bàn phím.

**Đề xuất:** ưu tiên control HTML chuẩn, link cho điều hướng, label liên kết, dialog quản lý focus và cách đổi trạng thái pipeline không phụ thuộc kéo thả.

## Mức độ đáp ứng thiết kế

| Nhóm | Đánh giá từ mã nguồn |
| --- | --- |
| Nhận diện marketplace | Có top navigation, job card, candidate card, nội dung nghề nghiệp; không dùng sidebar quản trị cố định cho hai vai trò. |
| AI hỗ trợ con người | Có badge và giải thích kỹ năng; cách đặt tên tương đối đúng định hướng, nhưng dữ liệu là mẫu. |
| Màu sắc | Lệch mô tả: `src/index.css:6` dùng xanh lá `#00B14F`, trong khi tài liệu ưu tiên xanh dương/periwinkle và dành xanh lá chủ yếu cho thành công/matching. |
| Typography và khoảng cách | Có Inter, Plus Jakarta Sans, token màu và bo góc, max-width 1280px. Cần kiểm tra CSS đầu ra của các class `font-600`, `font-700`; không nên mặc định chúng tương đương utility chuẩn nếu chưa xác minh. |
| Hình ảnh | Home có nhiều ảnh theo ngành từ Unsplash. Chưa kiểm tra render để kết luận tỷ lệ hình ảnh 35–50%, chất lượng crop hoặc độ giống ảnh tham chiếu. |
| Public | Có Home, Search, Job Detail, Sign In và hai màn đăng ký. Companies chỉ là placeholder; chưa có Company Detail riêng. |
| Candidate | Có Home, Profile, Upload, Recommended, Applications. Kết quả CV gộp vào Upload và chưa editable; Saved dùng nhầm trang; chưa có Application Detail/Account Settings riêng. |
| Recruiter | Có Home, Job Posts, Create Job, Applicants, Candidate Profile, Pipeline. Search/Recommended tái dùng Applicants; Company là placeholder; chưa có đầy đủ Edit Job, Job Management và Settings riêng. |
| Component dùng chung | Có Nav, Footer, JobCard, CandidateCard, MatchBadge/Summary/Detail. Chưa hình thành đầy đủ bộ Button/Input/Select/Dialog/Toast/Empty/Error/Loading dùng chung theo mô tả. |
| Trạng thái hệ thống | Có processing CV và empty results ở tìm việc, nhưng chưa bao phủ lỗi CV, job closed, các empty/loading/error quan trọng khác. |

## Điểm mạnh có thể tái sử dụng

- Chia trang và component theo Candidate/Recruiter khá dễ đọc; có interface cho Job, Candidate, Company và trạng thái.
- Card của hai vai trò dùng cùng ngôn ngữ giao diện; matching được tách thành component dùng chung.
- Job Search có tìm kiếm/lọc tại chỗ; Recommended Jobs có sort thực; Pipeline có cập nhật cột bằng state khi kéo thả.
- Có responsive utility, menu mobile và drawer bộ lọc việc làm; hướng bố cục nhìn chung phù hợp một website tuyển dụng.
- Có lockfile và cấu hình TypeScript strict. Đây là nền tảng hữu ích cho việc chuyển giao, dù chưa thay thế kiểm tra dự án đầy đủ.

## Chất lượng kỹ thuật và kiểm chứng

- Đã đọc hai tài liệu và các file ứng dụng liên quan; rà soát điều hướng, form, dữ liệu mẫu, component, cấu hình build và CSS.
- Kiểm tra cú pháp bằng TypeScript transpilation trên 24 file `.ts`/`.tsx`: **0 lỗi cú pháp**. Đây không phải kiểm tra kiểu đầy đủ hoặc kết quả build Vite.
- Chưa cài dependencies riêng, chạy Vite build hay kiểm thử trình duyệt cho bản ZIP. Các bước tái hiện trên được suy ra từ mã, chưa phải kết quả E2E.
- `package.json:8` chỉ chạy `vite build`, không kèm `tsc`; không có script lint/typecheck/test. Build thành công nếu có cũng chưa chứng minh không có lỗi kiểu.
- Chưa thấy lớp gọi API hoặc lưu bền vững trong phần mã ứng dụng đã rà soát. Pipeline, Save và Apply đều phụ thuộc state/dữ liệu mẫu.
- `src/pages/HomePage.tsx` khoảng 645 dòng, gộp nhiều section và dữ liệu; nên tách thành các component theo section trước khi mở rộng.
- Metadata trong `.figma/make/site.json` vẫn mô tả ứng dụng quản lý dự án, không khớp sản phẩm tuyển dụng; cần sửa khi triển khai.

## Hướng triển khai vào dự án hiện tại

Dự án hiện tại ở `frontend` là Next.js, còn ZIP là Vite SPA. `src/app/page.tsx` hiện vẫn là trang khởi tạo Next.js; mã ZIP chưa được tích hợp. Không nên chép đè package.json, cấu hình Vite hoặc entrypoint của ZIP vào dự án này.

Thứ tự đề xuất:

1. Thống nhất màu thương hiệu và lập danh sách trang còn thiếu theo hai tài liệu.
2. Chuyển token CSS, component dùng chung và asset có chọn lọc; tạo route App Router bằng ID.
3. Hoàn thiện hai hành trình chính bằng nguồn dữ liệu chung: tìm/lưu/ứng tuyển và đăng tin/xem ứng viên/pipeline.
4. Làm form có validation, giữ dữ liệu giữa các bước, chỉnh sửa hồ sơ và CV review.
5. Kết nối API xác thực, việc làm, hồ sơ, application và matching; có trạng thái loading/error/empty.
6. Kiểm tra các luồng quan trọng, responsive ở 375–430px, 768–1024px, 1440px và thao tác bàn phím.

**Đánh giá cuối:** phù hợp làm prototype giao diện và đầu vào thiết kế cho đồ án; cần phát triển thêm đáng kể để đáp ứng đầy đủ mô tả và sử dụng như ứng dụng thực tế. Chưa thay đổi mã ứng dụng trong lần đánh giá này.
