# Mã Auth đồng bộ Backend — 2026-11-02

Nguồn mã frontend: `src/marketplace/auth-codes.ts`; backend: `app/auth/schemas.py`. Chủ dự án đã chấp thuận:

- SystemRole: CANDIDATE, COMPANY_MEMBER, ADMIN.
- AccountStatus: ACTIVE, DISABLED.
- MemberStatus: ACTIVE, INACTIVE.
- CompanyApprovalStatus: PENDING, APPROVED, REJECTED.
- InternalCompanyRole: OWNER, RECRUITER.

Audience UI `candidate` ánh xạ CANDIDATE; `recruiter` ánh xạ COMPANY_MEMBER. Lựa chọn audience không cấp role, status hoặc OWNER/ADMIN. AuthPages hiện dùng mapping để đồng nhất mã/nhãn; form và navigation vẫn là demo, chưa tích hợp gọi API/backend token memory.

Backend có POST `/api/v1/auth/login` chỉ nhận email/password và GET `/api/v1/auth/me` đọc lại principal từ server; không gửi role/internal_role/status/companyId để tự gán quyền. Company PENDING/REJECTED được login/me để tiếp tục onboarding khi luồng đó được triển khai, các nghiệp vụ tuyển dụng cần guard APPROVED ở BE.

Khi tích hợp sau: token chỉ memory, bearer header, 401 yêu cầu login lại, 403 thể hiện thiếu quyền, 503 thể hiện dịch vụ chưa sẵn sàng; không dùng demo flags làm principal. Reload sẽ mất token khi không có refresh. Logout xóa client state, không thu hồi token đã phát hành. Không tự thêm public signup Admin/Owner hoặc lưu JWT trong sessionStorage/localStorage.
