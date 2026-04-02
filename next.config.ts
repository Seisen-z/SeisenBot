import type { NextConfig } from "next";

const localDevApi = "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    const isDev = process.env.NODE_ENV === "development";
    const apiTarget = process.env.API_PROXY_TARGET || (isDev ? localDevApi : "http://85.215.229.230:9820");

    return [
      {
        source: '/api/bot/:path*',
        destination: `${apiTarget}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
