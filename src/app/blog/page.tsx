import { Metadata } from 'next';
import BlogPage from '@/components/blog/BlogPage';
import Script from 'next/script';

// SEO metadata
export const metadata: Metadata = {
  title: 'Blog | Tax Enough - Tax and Investment Tools',
  description: 'Stay informed with the latest tax tips, investment strategies, and financial planning advice for US investors.',
  openGraph: {
    title: 'Blog | Tax Enough - Tax and Investment Tools',
    description: 'Stay informed with the latest tax tips, investment strategies, and financial planning advice for US investors.',
    url: '/blog',
    type: 'website',
  },
};

// Server Side Blog Page
export default function Blog() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Blog Hero Banner with gradient background */}
      <div className="relative bg-gradient-to-r from-blue-800 to-blue-600 text-white py-16">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjIiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIzMCIgcj0iMSIvPjxjaXJjbGUgY3g9IjM2IiBjeT0iMzAiIHI9IjEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjE4IiByPSIxIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI0MiIgcj0iMSIvPjxjaXJjbGUgY3g9IjQ4IiBjeT0iMTgiIHI9IjEiLz48Y2lyY2xlIGN4PSI0OCIgY3k9IjQyIiByPSIxIi8+PGNpcmNsZSBjeD0iMzAiIGN5PSIxMiIgcj0iMSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iNDgiIHI9IjEiLz48L2c+PC9zdmc+')]"></div>
        </div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Tax Enough Blog</h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto opacity-90">
              Stay informed about taxes, investments, and strategies to optimize your financial life
            </p>
          </div>
        </div>
      </div>
      
      {/* Blog Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="prose max-w-none">
          <BlogPage />
        </div>
      </div>
      
      {/* Google Analytics or other 3rd party scripts */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXX');
        `}
      </Script>
    </main>
  );
} 