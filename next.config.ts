import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  experimental: {
    // Resume uploads go through a Server Action; the 1MB default rejected most
    // real PDFs. Keep this above MAX_RESUME_BYTES (lib/resume-file.ts).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
