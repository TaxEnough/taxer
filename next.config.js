/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Alt alan adları (subdomain) için yapılandırma
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'blog.siteadi.com',
          },
        ],
        destination: '/blog/:path*',
      },
    ];
  },
  
  // Firebase Admin SDK için Node.js modüllerini webpack'te yönetme
  webpack: (config, { isServer }) => {
    // Firebase Admin SDK sadece sunucu tarafında kullanılacak
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        fs: false,
        http2: false,
        dns: false,
        tls: false,
        child_process: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig 