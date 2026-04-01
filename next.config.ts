import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/bot/:path*',
        destination: process.env.API_PROXY_TARGET 
          ? `${process.env.API_PROXY_TARGET}/api/:path*` 
          : 'http://85.215.229.230:9820/api/:path*'
      }
    ];
  }
};

export default nextConfig;
