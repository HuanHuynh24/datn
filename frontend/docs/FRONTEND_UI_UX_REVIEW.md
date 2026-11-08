# Rà soát và cải tiến Frontend UI/UX

**Cập nhật header ngày 31/10/2026:** cấu trúc header hai tầng trong lượt rà soát này đã được thay bằng một hàng điều hướng theo actor. Xem [báo cáo header mới](HEADER_UI_UX_REVIEW.md) để đối chiếu cấu trúc và file hiện tại.

Ngày thực hiện: 30–31/10/2026. Phạm vi: mã nguồn Frontend hiện có, giao diện và các luồng thao tác trong trình duyệt. Báo cáo này bổ sung cho [rà soát tài khoản ứng viên](KIEM_TRA_UI_UX_UNG_VIEN.md), không thay thế kết quả của lần trước.

## 1. Kiến trúc, actor và các trang đã rà soát

- Next.js 16.4.2, App Router, React 19.3, TypeScript, React Compiler. Đã đọc tài liệu đi kèm phiên bản Next trong `node_modules/next/dist/docs/` trước khi sửa.
- Tailwind 4 kết hợp CSS riêng; component giao diện và SVG icon nội bộ, không có UI library bên ngoài.
- `src/marketplace/routes.ts` định nghĩa URL; `src/app/[...path]/page.tsx` sinh các trang từ bảng route; `App.tsx` chọn màn hình và ngữ cảnh header.
- `demo-store.ts` quản lý dữ liệu giao diện bằng `useSyncExternalStore`. Dữ liệu phiên nằm trong sessionStorage; metadata CV dùng localStorage và tệp CV dùng IndexedDB. Không tìm thấy luồng gọi API tuyển dụng thật.
- Đối chiếu hai tài liệu `recruitment-platform-design.md` và `visual-direction.md` trong ZIP gốc, cùng tài liệu layout đã có trong `docs/`.
- Actor thực tế: khách truy cập, ứng viên, nhà tuyển dụng. Không có module, route hay mô hình quyền Admin trong mã nguồn và tài liệu đã kiểm tra, nên không tạo giao diện Admin mới.
- Truy cập các khu vực tài khoản hiện là chế độ trải nghiệm Frontend. Việc chọn vai trò/header không thay thế xác thực hoặc phân quyền trên máy chủ; giữ nguyên khả năng truy cập trực tiếp các khu vực demo.

| Actor / nhóm | URL | Mục đích riêng |
| --- | --- | --- |
| Khách | `/` | Khám phá việc làm, doanh nghiệp, ngành nghề và cẩm nang |
| Khách / ứng viên | `/jobs` | Danh sách đầy đủ, tìm kiếm, bộ lọc, sắp xếp, phân trang |
| Khách / ứng viên | `/jobs/[id]` | Nội dung công việc, lưu, chọn CV và ứng tuyển |
| Dùng chung | `/companies` | Tìm doanh nghiệp và chuyển sang việc làm của doanh nghiệp |
| Dùng chung | `/career` | Cẩm nang và nội dung bài viết |
| Truy cập tài khoản | `/sign-in` | Đăng nhập giao diện, tiếp tục hành động đang làm |
| Truy cập tài khoản | `/sign-up/candidate`, `/sign-up/recruiter` | Đăng ký theo vai trò hiện có |
| Ứng viên | `/candidate` | Tổng quan hồ sơ, CV, đơn ứng tuyển và gợi ý ngắn |
| Ứng viên | `/candidate/recommended` | Danh sách gợi ý theo dữ liệu phù hợp hiện có |
| Ứng viên | `/candidate/saved` | Công việc đã lưu, tìm kiếm, sắp xếp, bỏ lưu |
| Ứng viên | `/candidate/applications` | Tiến độ hồ sơ, thông tin đã gửi và lịch phỏng vấn |
| Ứng viên | `/candidate/profile` | Thông tin cá nhân, liên hệ và kinh nghiệm nghề nghiệp |
| Ứng viên | `/candidate/cvs` | Tệp CV, bản CV từ hồ sơ, xem trước, mặc định, đổi tên, xóa |
| Nhà tuyển dụng | `/recruiter` | Tổng quan tin, hồ sơ cần xử lý và lịch phỏng vấn |
| Nhà tuyển dụng | `/recruiter/jobs` | Tìm, đổi chức danh, tạm dừng, đóng, mở lại tin; tiếp tục bản nháp |
| Nhà tuyển dụng | `/recruiter/jobs/new` | Form bốn bước, lưu nháp và xem trước tin |
| Nhà tuyển dụng | `/recruiter/applicants` | Danh sách hồ sơ, trạng thái và ngữ cảnh tin tuyển dụng |
| Nhà tuyển dụng | `/recruiter/talent-search` | Tìm tên, vị trí, kỹ năng, địa điểm và lọc hồ sơ |
| Nhà tuyển dụng | `/recruiter/recommended` | Tập hồ sơ được lọc theo điểm phù hợp hiện có |
| Nhà tuyển dụng | `/recruiter/candidates/[id]` | Hồ sơ chi tiết, lưu, ghi chú, đặt lịch và đổi giai đoạn |
| Nhà tuyển dụng | `/recruiter/pipeline` | Theo dõi và di chuyển hồ sơ giữa các giai đoạn |
| Nhà tuyển dụng | `/recruiter/company` | Xem và chỉnh sửa thông tin doanh nghiệp |

Tổng cộng **23 loại màn hình**: 21 route cố định và 2 loại chi tiết có ID. Có 29 công việc và 6 hồ sơ ứng viên từ dữ liệu đã tồn tại; không thêm bản ghi nghiệp vụ để làm đầy giao diện. Đã kiểm tra thêm trang 404 và các URL cũ.

Các trang dùng chung nội dung đã được hợp nhất từ lần trước: `/candidate/jobs` và `/candidate/jobs/[id]` chuyển hướng sang `/jobs` và `/jobs/[id]`; `/candidate/upload-cv` chuyển sang `/candidate/cvs`. Lần này kiểm tra lại các chuyển hướng. Hồ sơ nghề nghiệp và quản lý CV giữ hai trang vì một bên chỉnh thông tin cá nhân, một bên quản lý tài liệu ứng tuyển. Tổng quan không thay thế danh sách đầy đủ. Ba màn hình hồ sơ nhà tuyển dụng dùng chung `ApplicantsPage` với chế độ/ngữ cảnh khác nhau, tránh ba bản component độc lập.

## 2. Vấn đề phát hiện và thay đổi thực tế

| Vấn đề | Xử lý |
| --- | --- |
| Khách nhấn ứng tuyển/lưu việc mà không có bước đăng nhập giữ ngữ cảnh | Chuyển tới đăng nhập với URL tiếp tục; chuyển đăng ký vẫn giữ công việc; quay lại mở form ứng tuyển hoặc hoàn tất ý định lưu |
| Quay lại danh sách làm mất từ khóa, bộ lọc, trang hoặc vị trí cuộn | Dùng `useViewState`, `useListReturn` và `ReturnLink`; bổ sung ngữ cảnh cho cả danh sách, tổng quan, lịch sử ứng tuyển và pipeline |
| Tên và trạng thái tin đổi ở trang quản lý nhưng chưa phản ánh trên các trang khác | Dùng danh mục việc làm chung và resolve chức danh trong `JobCard`/chi tiết; loại tin tạm dừng/đã đóng khỏi tìm kiếm, gợi ý; chi tiết giải thích vì sao không nhận hồ sơ |
| Nút “Xem ứng viên” của mọi tin mở cùng danh sách không có ngữ cảnh | Truyền `jobId`, hiển thị chức danh và đường quay lại. Khi thiếu liên kết hồ sơ–tin, hiển thị trạng thái rỗng có giải thích và hành động xem toàn bộ hồ sơ |
| Danh sách/tổng quan có 5 hồ sơ nhưng pipeline có 6 | Dùng cùng 6 hồ sơ đã có sẵn; không thêm ứng viên giả |
| Có lưu hồ sơ ứng viên nhưng không có cách tìm lại tập đã lưu | Bổ sung điều kiện “Chỉ hồ sơ đã lưu” vào bộ lọc sẵn có |
| Bản nháp không có điểm vào từ trang quản lý tin | Hiển thị bản nháp đã lưu cùng thời điểm cập nhật và nút tiếp tục; giữ các trường, kỹ năng và bước hiện tại trong phiên |
| Form hồ sơ công ty dài đặt trong modal | Chuyển sang chỉnh sửa tại trang, phân nhóm thông tin; giữ nút lưu/hủy dễ tiếp cận trên mobile |
| Lịch phỏng vấn chấp nhận ngày đã qua | Kiểm tra thời gian tương lai và địa điểm; lỗi xuất hiện ngay trong form, không xóa dữ liệu nhập |
| Chi tiết điểm phù hợp dùng ngưỡng màu khác badge | Thống nhất các ngưỡng 85/65; nhãn và màu trạng thái dùng chung |
| Lịch sử ứng tuyển không hiển thị lại liên hệ/thư đã nhập | Lưu thông tin form trong bản ghi phiên và cho xem bằng mục “Thông tin đã gửi” |
| Đọc CV cập nhật state đồng bộ trong effect gây lỗi lint; cần kiểm tra mở lại blob | Theo dõi kết quả đọc theo ID tệp, xử lý bất đồng bộ và thu hồi object URL khi đóng/đổi CV |
| Truy cập công việc thường dùng phải đi qua menu; hero trang quản lý chiếm quá nhiều chỗ | Thêm thanh điều hướng trực tiếp theo vai trò; giữ mục hiện tại trong vùng nhìn thấy trên mobile; thu gọn hero có ảnh, giữ chiều rộng toàn trang |
| Suspense chưa có trạng thái chờ rõ ràng | Thêm `PageLoading` dùng `role=status`, thông báo tải trang và hỗ trợ giảm chuyển động |

## 3. Các hành trình sau cải tiến

| Hành trình | Điểm vào và các bước chính | Phản hồi / cách tiếp tục |
| --- | --- | --- |
| Khách ứng tuyển | Danh sách → chi tiết → ứng tuyển → đăng nhập/đăng ký → form trên đúng công việc | Không phải tìm lại tin; không tự gửi đơn sau đăng nhập; người dùng chủ động xác nhận, sau đó xem thông tin đã gửi trong lịch sử |
| Khách lưu việc | Nhấn lưu → đăng nhập → trở lại công việc đã lưu | Ý định lưu được xử lý một lần; bỏ lưu sau đó không bị tự bật lại; URL tiếp tục ngoài website bị từ chối |
| Duyệt danh sách | Tìm/lọc/sắp xếp/chọn trang → chi tiết → quay lại | Giữ trạng thái trong phiên và vị trí cuộn; nhãn quay lại phù hợp nguồn truy cập |
| Theo dõi ứng tuyển | Tổng quan → bộ lọc lịch sử → xem lại tin → quay lại | Giữ bộ lọc trạng thái trên URL; xem lại CV, liên hệ và thư đã gửi |
| CV | Hồ sơ & CV → chọn tệp → đặt tên/mặc định → lưu → xem trước | Tệp không hỗ trợ có thông báo; PDF đọc từ tệp đã lưu trên thiết bị; CV tạo từ hồ sơ dùng thông tin người dùng vừa chỉnh |
| Quản lý tin | Danh sách → sửa chức danh hoặc thay đổi trạng thái tại chỗ | Thông báo kết quả; đóng tin cần xác nhận; tin không nhận hồ sơ có trạng thái rõ ràng ở phía tìm việc |
| Soạn tin | Tin tuyển dụng → bốn bước thông tin → xem trước → lưu nháp và về danh sách | Lương tối đa thấp hơn tối thiểu bị chặn; nội dung được giữ lại; tiếp tục từ thẻ bản nháp, không phải nhập lại |
| Xem ứng viên của tin | Tin → “Xem ứng viên” → trang có tên tin → toàn bộ hồ sơ hoặc quay lại | Khi chưa có dữ liệu liên kết, không gán tùy ý hồ sơ vào một tin |
| Xử lý hồ sơ | Tìm/lọc → chi tiết → lưu, ghi chú, đổi giai đoạn hoặc đặt lịch → quay lại | Bộ lọc giữ nguyên; lịch không hợp lệ không đóng form; trạng thái cập nhật ở danh sách và pipeline |
| Pipeline | Chọn hồ sơ hoặc chọn trạng thái ngay trên thẻ | Có select dùng bàn phím thay cho yêu cầu kéo thả; mở chi tiết rồi quay lại đúng pipeline |
| Công ty | Hồ sơ công ty → chỉnh sửa tại trang → lưu hoặc hủy | Hủy giữ nguyên dữ liệu cũ; lưu phản ánh ngay trên trang; nút hành động vẫn tiếp cận được trên mobile |

Các lỗi nhập liệu được kiểm tra trong trình duyệt. Khi không có dữ liệu, trạng thái rỗng dẫn tới xóa bộ lọc, xem toàn bộ danh sách hoặc tác vụ tiếp theo. Không dùng thông báo thành công để giả lập gửi email, xuất bản tin hay lưu dữ liệu lên máy chủ.

## 4. Component và quy chuẩn giao diện

- Giữ hệ token hiện có theo hướng trang chủ: xanh `#0069DB` cho hành động, nền trắng/xám trung tính, đường biên `#E6E7E9`, chữ `#25282C`/`#464B52`. Không thêm palette riêng cho từng actor.
- Header chung `Nav`; thanh `WorkspaceNavigation` có mục theo vai trò. Ứng viên trên mobile tiếp tục dùng thanh điều hướng cuối màn hình; nhà tuyển dụng dùng thanh cuộn ngang giữ mục hiện tại trong vùng nhìn thấy.
- `WorkspaceHero` dùng ảnh hiện có, chiều rộng toàn trang; phần quản lý được thu gọn để nội dung và thao tác đến sớm hơn. `HomeHero` tiếp tục phục vụ các trang tổng quan/trang chủ.
- `JobCard` là thành phần chung cho tìm kiếm, tổng quan, đã lưu, lịch sử và quản lý tin. Khác biệt hành động theo actor qua props, chung hệ chữ và bố cục thông tin. `CandidateCard` được dùng lại ở các danh sách hồ sơ.
- `Page`, `Panel`, `Field`, `Notice`, `Empty`, `Badge` tiếp tục dùng chung; chuẩn hóa radius panel 4 px và nút form đăng tin theo hệ nút hiện có. Nội dung phẳng, không thêm shadow cho từng khối; shadow dành cho menu/modal nổi.
- Trạng thái: mới nhận/đã nộp/phỏng vấn dùng xanh; xem xét/tạm dừng dùng cam; đang tuyển/đề nghị nhận việc/đã tuyển dùng xanh lá; đóng/chưa phù hợp/bản nháp dùng xám. Luôn có tên trạng thái kèm màu.
- `Dialog` giữ hành vi native modal, focus bên trong, Escape và đóng qua nút; `Dropdown` đóng bằng Escape và trả focus về trigger. Tái sử dụng các component này cho bộ lọc mobile và tác vụ ngắn.
- `ReturnLink`, `PageLoading`, `useViewState`, `useListReturn`, `useJobCatalog` bổ sung các hành vi dùng chung thay vì tạo giải pháp riêng trên mỗi trang.

## 5. File thay đổi trong lần này

Các đường dẫn bên dưới tính từ thư mục `frontend/`.

| Nhóm | File | Nội dung |
| --- | --- | --- |
| Layout | `src/marketplace/App.tsx` | Điều hướng workspace và loading khi chờ nội dung |
| CSS | `src/app/workspace-visuals.css` | Điều hướng, hero quản lý, form công ty, bản nháp, trạng thái tải và responsive |
| Routing | `src/marketplace/routes.ts` | URL tiếp tục an toàn, ngữ cảnh quay lại và bộ lọc theo tin |
| UI state | `src/marketplace/view-state.ts` **mới** | Giữ bộ lọc, bản nháp và vị trí quay lại trong phiên |
| Dữ liệu dùng chung | `src/marketplace/job-catalog.ts`, `src/marketplace/candidate-catalog.ts` **mới** | Chức danh/trạng thái công việc và tập hồ sơ thống nhất |
| Dữ liệu phiên | `src/marketplace/demo-store.ts`, `src/marketplace/data.ts` | Thông tin đơn đã nhập; trường liên kết tin tùy chọn trong kiểu Frontend, chưa gán dữ liệu |
| Component | `src/marketplace/components/WorkspaceNavigation.tsx`, `ReturnLink.tsx`, `PageLoading.tsx` **mới** | Điều hướng theo actor, quay lại đúng nguồn và trạng thái tải |
| Component | `src/marketplace/components/JobCard.tsx`, `MatchBadge.tsx`, `src/marketplace/ui.tsx` | Trạng thái và nội dung chung, tiếp tục thao tác lưu sau đăng nhập |
| Dùng chung | `src/marketplace/pages/AuthPages.tsx`, `JobSearchPage.tsx`, `JobDetailPage.tsx`, `CVUploadPage.tsx` | Ngữ cảnh đăng nhập, trạng thái danh sách, ứng tuyển và xem tệp |
| Ứng viên | `src/marketplace/pages/candidate/CandidateHomePage.tsx`, `RecommendedJobsPage.tsx`, `ApplicationsPage.tsx` | Danh mục chung, giữ ngữ cảnh, thông tin đã gửi |
| Nhà tuyển dụng | `src/marketplace/pages/recruiter/RecruiterHomePage.tsx`, `JobPostsPage.tsx`, `CreateJobPage.tsx` | Ưu tiên thông tin cần xử lý, quản lý tin và tiếp tục bản nháp |
| Nhà tuyển dụng | `src/marketplace/pages/recruiter/ApplicantsPage.tsx`, `CandidateProfilePage.tsx`, `PipelinePage.tsx`, `CompanyProfilePage.tsx` | Ngữ cảnh hồ sơ, lọc đã lưu, lịch phỏng vấn, quay lại và form công ty |
| Kiểm tra | `eslint.config.mjs` | Loại `.artifacts/` chứa script QA tạm khỏi lint mã ứng dụng |
| Báo cáo | `docs/FRONTEND_UI_UX_REVIEW.md` **mới** | Kết quả, bằng chứng kiểm tra và giới hạn |

Các script, ảnh chụp và JSON kết quả QA được lưu trong `.artifacts/` (đã nằm trong `.gitignore`). Không thay API, schema, package dependency hay tạo module nghiệp vụ mới. `next.config.ts` và các chuyển hướng từ lần trước được giữ nguyên.

## 6. Phần cần Backend hỗ trợ

| Phụ thuộc | Trạng thái Frontend và hướng tích hợp |
| --- | --- |
| Xác thực, quyền truy cập, đăng ký, quên mật khẩu | Hiện là demo giao diện. Cần dịch vụ xác thực/session thật; URL tiếp tục đã được chuẩn bị nhưng không phải cơ chế phân quyền |
| Liên kết đơn ứng tuyển với ứng viên và tin | Chưa có dữ liệu ánh xạ. Cần ID/liên kết thật để đồng bộ trạng thái giữa tài khoản ứng viên và nhà tuyển dụng; không thể suy ra từ tên hoặc chức danh |
| Xuất bản và chỉnh sửa đầy đủ tin tuyển dụng | Hiện có form, preview và bản nháp cục bộ; chưa có API tạo/xuất bản. Không hiển thị thông báo đã đăng công khai |
| Lưu hồ sơ, công ty, trạng thái, ghi chú trên nhiều thiết bị | Các cập nhật hiện thuộc phiên trình duyệt. Cần lưu máy chủ và xử lý tải/lỗi/xung đột từ API thật |
| Lưu trữ và đọc nội dung CV | Tệp hiện ở IndexedDB. Cần dịch vụ upload/storage thật nếu muốn nhà tuyển dụng truy cập; chưa trích xuất/đọc DOCX trên máy chủ |
| Lịch phỏng vấn, email/thông báo | Chỉ lưu lịch cục bộ và cập nhật trạng thái. Chưa gửi lời mời, email hoặc đồng bộ lịch bên ngoài |
| Điểm phù hợp, số liệu và dữ liệu tuyển dụng | Dùng fixtures sẵn có. Cần dữ liệu thật và cơ chế tính điểm; chưa tự tính lại điểm khi người dùng đổi hồ sơ |

## 7. Kết quả xác minh

- `npm.cmd run lint`: đạt, không lỗi/cảnh báo ở lần chạy cuối.
- `npx.cmd tsc --noEmit`: đạt. Build cũng chạy TypeScript thành công sau các thay đổi điều hướng cuối cùng.
- `npm.cmd run build`: đạt, sinh **60 trang tĩnh**; không còn các trang chi tiết ứng viên bị nhân đôi từ URL cũ.
- **40 kiểm tra luồng thao tác** đạt: đăng nhập tiếp tục ứng tuyển/lưu; dữ liệu đơn đã nhập; trở lại đúng phân trang và cuộn; tên/trạng thái tin xuyên trang; ngữ cảnh hồ sơ theo tin; lọc hồ sơ đã lưu; lịch quá khứ; cập nhật pipeline; lương sai; bản nháp bốn bước; chỉnh công ty; lưu/mở lại PDF; chặn URL tiếp tục ngoài website.
- **26 kiểm tra mobile và điều hướng** đạt: menu/Escape/focus; bộ lọc mobile và reset; trạng thái rỗng có hành động; active navigation nằm trong viewport; form công ty; email không hợp lệ không mất dữ liệu; loại tệp CV sai; CV từ hồ sơ; quay lại từ lịch sử/tổng quan/pipeline; ba URL cũ; trang 404.
- **115 lượt kiểm tra responsive**: 23 loại trang × 5 độ rộng **1440, 1024, 768, 390, 360 px**. Không phát hiện tràn ngang toàn trang, thiếu/thừa H1 hoặc ảnh hiển thị bị lỗi. Pipeline cuộn trong vùng riêng. Đã xem ảnh chụp của các trang chính và modal CV/form công ty trên mobile.
- Không ghi nhận JavaScript runtime exception trong các lượt kiểm tra trình duyệt trên.

Bằng chứng: `.artifacts/platform-flow-results.json`, `.artifacts/platform-mobile-results.json`, `.artifacts/platform-responsive-results.json` và ảnh `platform-*.png`. Các script tương ứng: `platform-flows-qa.mjs`, `platform-mobile-qa.mjs`, `platform-responsive-qa.mjs`, dùng Chrome headless qua CDP tại cổng 9225 và ứng dụng local ở cổng 3000. Script QA tạo dữ liệu riêng trong hồ sơ Chrome kiểm thử; không sửa fixtures ứng dụng. Repo chưa có test runner/unit suite trong `package.json`; không coi các kiểm tra này là kiểm thử tích hợp Backend.

## 8. Giới hạn và phần chưa xác minh

- Chưa thể hoàn tất luồng tuyển dụng nhiều tài khoản thực, xuất bản tin thật, gửi hồ sơ qua mạng hoặc email do chưa có Backend tương ứng. Trạng thái rỗng theo tin vẫn có thể xuất hiện dù số hồ sơ trong fixture của tin lớn hơn 0, vì thiếu liên kết dữ liệu thật.
- Giữ các nội dung và số liệu mẫu đã tồn tại. Chưa biến chúng thành số liệu thị trường hoặc số liệu tuyển dụng trực tiếp. Không thêm dữ liệu mẫu để che phần thiếu.
- PDF xem trước dựa vào khả năng trình duyệt; DOCX có hướng dẫn tải xuống. CV tạo từ hồ sơ hiện là bản lưu nội dung để xem trong ứng dụng, chưa có dịch vụ xuất PDF.
- Dữ liệu phiên/bản nháp phụ thuộc sessionStorage; tệp CV phụ thuộc dung lượng và quyền lưu trữ của trình duyệt. Chưa xác minh tình huống quota đầy hoặc API thất bại vì không có API. Các thông báo lỗi cục bộ sẵn có được giữ lại.
- Kiểm tra responsive bằng Chrome headless, chưa kiểm thử Safari/iOS/Android trên thiết bị thật hoặc công cụ đọc màn hình. Đã kiểm tra focus, Escape, nhãn và trạng thái cơ bản; chưa tuyên bố đạt chứng nhận accessibility đầy đủ.
- Bản production đã build thành công; các tương tác được chạy trên preview local. Chưa triển khai website hoặc chạy kiểm thử dịch vụ production.
