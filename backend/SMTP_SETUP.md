# SMTP cho chức năng tài khoản

Thêm biến từ `smtp.env.example` vào **file `.env` root đang có**, giữ nguyên DB/JWT. Không gửi password qua chat hoặc commit `.env`.

- `SMTP_HOST`: hostname máy chủ, không nhập connection string.
- `SMTP_PORT`, `SMTP_SECURITY`: theo nhà cung cấp; thường `587/starttls` hoặc `465/ssl`. Chứng chỉ TLS luôn được kiểm tra.
- `SMTP_USERNAME`, `SMTP_PASSWORD`: thông tin SMTP do nhà cung cấp cấp; có thể cần app password.
- `SMTP_FROM_EMAIL`: địa chỉ gửi được nhà cung cấp cho phép.
- `FRONTEND_URL`: origin Frontend để dựng link, local mặc định `http://localhost:3000`.
- `SMTP_TEST_EMAIL`: địa chỉ của chính bạn, chỉ dùng khi chủ động gửi email kiểm thử.

Compose local đã ánh xạ `SMTP_*` và `FRONTEND_URL` vào Backend. Root Compose không nằm trong Git theo allowlist source của dự án; nếu dùng cấu hình Compose khác, cần ánh xạ các biến tương ứng. Nạp env mới bằng `docker compose up -d --no-deps backend`; không restart MySQL hoặc xóa volume.

Sau khi cấu hình, chạy từ root: `backend/.venv/Scripts/python.exe backend/tools/check_smtp.py`. Script gửi đúng một email test không có token/password. PASS nghĩa là SMTP đã nhận thư; cần kiểm tra inbox/spam để xác nhận nhận được.

Đổi mật khẩu tại menu tài khoản (Candidate/Employer) hoặc sidebar Admin. Quên mật khẩu tại trang đăng nhập. Xác thực email tại menu tài khoản; chưa xác thực vẫn đăng nhập được. SMTP chưa cấu hình hoặc lỗi gửi trả 503, không giả lập đã gửi thư.

Link reset 15 phút, verification 24 giờ; token nằm trong URL fragment và được xóa khỏi thanh địa chỉ sau khi trang đọc vào memory. Reset dùng một lần, mất hiệu lực sau khi hash/email thay đổi; xác thực email không đổi role/status. Các bản JWT access đã phát hành vẫn có giới hạn cũ tối đa30 phút, không có server revocation.
