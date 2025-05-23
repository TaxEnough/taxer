import { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { getAllBlogPosts, BlogPost } from '@/lib/blog-firebase';

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

// Date formatting function
const formatDate = (dateValue: any): string => {
  try {
    // Firebase Timestamp or Date or string
    let jsDate;
    
    if (dateValue instanceof Date) {
      jsDate = dateValue;
    } else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
      // Firebase Timestamp
      jsDate = dateValue.toDate();
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      jsDate = new Date(dateValue);
    } else {
      jsDate = new Date();
    }
    
    return format(jsDate, 'd MMMM yyyy', { locale: enUS });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Date unknown';
  }
};

// Server Side Blog Page
export default async function Blog() {
  // Fetch blog posts on the server side
  const posts = await getAllBlogPosts();
  
  // Extract all tags from posts
  const tags = posts.reduce((acc: string[], post: BlogPost) => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => {
        if (!acc.includes(tag)) {
          acc.push(tag);
        }
      });
    }
    return acc;
  }, []);

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
          <div className="max-w-7xl mx-auto">
            {/* Blog posts grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <a
                  href={`/blog/${post.slug}`}
                  key={post.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col h-full"
                >
                  <div className="relative h-52 w-full">
                    {post.imageUrl ? (
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <svg
                          className="w-16 h-16 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex-grow flex flex-col">
                    <h2 className="text-xl font-semibold mb-2 text-gray-900">{post.title}</h2>
                    <div className="text-gray-600 mb-4 line-clamp-3 flex-grow"
                         dangerouslySetInnerHTML={{ __html: post.summary }}>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags && post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-gray-500 mt-auto">
                      <span>{formatDate(post.createdAt)}</span>
                      <span className="italic">{post.author}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
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