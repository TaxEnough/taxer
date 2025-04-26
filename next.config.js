/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: true,
  },
  // Firebase Admin SDK gibi Node.js modüllerini istemci tarafına derlememek için transpilePackages yapılandırması
  transpilePackages: [],
  
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
    // İstemci tarafında çalışacak kodda Node.js modüllerini yoksay
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        http2: false,
        path: false,
        os: false,
        crypto: false,
        util: false,
        ...config.resolve.fallback,
      };
    }
    return config;
  },
}

module.exports = nextConfig 