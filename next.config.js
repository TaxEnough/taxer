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
}

module.exports = nextConfig 