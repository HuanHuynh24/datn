import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép CI/verification build song song với dev server đang giữ khóa `.next` trên Windows.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactCompiler: true,
  async redirects() {
    return [
      { source: '/candidate/jobs/:path*', destination: '/jobs/:path*', permanent: true },
      { source: '/candidate/upload-cv', destination: '/candidate/cvs', permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
