/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  typescript: {

    ignoreBuildErrors: true,
  },
  eslint: {

    ignoreDuringBuilds: true,
  },
  experimental: {
    // optimizeCss özelliğini kaldırıyoruz çünkü 'critters' modülü eksik
  },
  // Firebase Admin SDK gibi Node.js modüllerini istemci tarafına derlememek için transpilePackages yapılandırması
  transpilePackages: [],
  
  // Sayfa geçişlerinin sorunsuz olması için yapılandırma
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Alt alan adları (subdomain) için yapılandırma
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'blog.taxenough.com',
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
    
    // Performans için ek optimizasyonlar
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig 
