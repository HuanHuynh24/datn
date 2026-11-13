import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "./jobs-ui-sample.css";
import "./layout-alignment.css";

export const metadata: Metadata = {
  title: {
    default: "Talentiq — Tìm đúng công việc cho bạn",
    template: "%s | Talentiq",
  },
  description:
    "Khám phá việc làm phù hợp với kỹ năng, kinh nghiệm và định hướng nghề nghiệp. Kết nối ứng viên với nhà tuyển dụng cùng Talentiq.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="antialiased">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
