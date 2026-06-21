/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => [
    {
      source: '/api/download',
      destination: process.env.NEXT_PUBLIC_BACKEND_URL
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/download`
        : 'http://localhost:8000/api/download',
    },
    {
      source: '/api/status/:path*',
      destination: process.env.NEXT_PUBLIC_BACKEND_URL
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/:path*`
        : 'http://localhost:8000/api/status/:path*',
    },
    {
      source: '/downloads/:path*',
      destination: process.env.NEXT_PUBLIC_BACKEND_URL
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/downloads/:path*`
        : 'http://localhost:8000/downloads/:path*',
    },
  ],
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
