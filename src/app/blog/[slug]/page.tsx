import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug } from '@/lib/blog-firebase';
import Link from 'next/link';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import Head from 'next/head';

type BlogParams = {
  params: {
    slug: string;
  };
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

// Convert Timestamp to ISO string
const getISOStringFromTimestamp = (timestamp: any): string => {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return timestamp.toDate().toISOString();
  } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
};

// Dynamically generate page metadata
export async function generateMetadata({ params }: BlogParams): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.slug);
  
  if (!post) {
    return {
      title: 'Blog Post Not Found',
      description: 'The blog post you are looking for was not found or has been removed.'
    };
  }
  
  return {
    title: `${post.title} | Tax Enough Blog`,
    description: post.summary,
    openGraph: {
      title: `${post.title} | Tax Enough Blog`,
      description: post.summary,
      type: 'article',
      publishedTime: getISOStringFromTimestamp(post.createdAt),
      modifiedTime: getISOStringFromTimestamp(post.updatedAt),
      authors: [post.author],
      images: [
        {
          url: post.imageUrl || '/images/blog-default.jpg',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}

// Get blog post from Firebase and local storage
async function getBlogPost(slug: string) {
  try {
    // Try to get the post from Firebase
    const firestorePost = await getBlogPostBySlug(slug);
    if (firestorePost) {
      return firestorePost;
    }
    
    // If not found in Firebase, check local storage
    const response = await fetch(`/api/blog/post/${slug}`, { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Could not fetch blog post: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export default async function BlogPostPage({ params }: BlogParams) {
  const post = await getBlogPost(params.slug);
  
  if (!post) {
    notFound();
  }
  
  // Safely render HTML content
  function createMarkup(content: string) {
    return { __html: content };
  }
  
  // Add FAQPage JSON-LD only for the specific blog post
  const isTaxLotBlog = params.slug === 'tax-lot-accounting-methods';
  const faqJsonLd = `{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is a tax lot in investing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A tax lot refers to a group of shares purchased in a single transaction, on a specific date, and at a specific price. Each lot has its own cost basis and acquisition date, which are essential for calculating capital gains or losses when you sell."
        }
      },
      {
        "@type": "Question",
        "name": "What is the difference between FIFO and Specific Identification?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "FIFO assumes the oldest shares are sold first, while Specific Identification allows investors to choose which shares to sell. FIFO is the default method used by most brokers unless otherwise specified."
        }
      },
      {
        "@type": "Question",
        "name": "Is LIFO allowed for stock sales in the U.S.?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, the IRS does not allow the LIFO (Last-In, First-Out) method for stocks and securities. It is only permitted for inventory accounting in specific business contexts."
        }
      },
      {
        "@type": "Question",
        "name": "What is the Average Cost method and when is it used?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Average Cost method is mainly used for mutual funds and dividend reinvestment plans (DRIPs). It calculates an average purchase price per share and applies that to all sales."
        }
      },
      {
        "@type": "Question",
        "name": "Can I switch between FIFO and Specific Identification?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, you can switch, but you must notify your broker at the time of sale if you're using Specific Identification. Otherwise, FIFO will be applied by default."
        }
      },
      {
        "@type": "Question",
        "name": "How do tax lot accounting methods affect capital gains taxes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Different accounting methods can yield different capital gains or losses. Choosing higher-cost shares with Specific ID may reduce your tax bill compared to FIFO, which might trigger higher gains by selling older, cheaper shares."
        }
      },
      {
        "@type": "Question",
        "name": "Does the tax lot I sell affect short-term vs. long-term classification?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Each tax lot has its own holding period. Selling shares held longer than one year results in long-term capital gains, which are usually taxed at a lower rate."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need to keep records myself, or does my broker do that?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "While brokers usually maintain tax lot data, you are ultimately responsible for accurate tax reporting. Keeping your own records is especially important if you use Specific Identification."
        }
      },
      {
        "@type": "Question",
        "name": "How can TaxEnough.com help with tax lot tracking?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "TaxEnough.com helps you track tax lots, simulate gain/loss scenarios under different methods, and prepare for accurate Form 8949 filing."
        }
      }
    ]
  }`;
  
  return (
    <>
      {isTaxLotBlog && (
        <Head>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
        </Head>
      )}
      <div className="bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-8">
            <a href="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All Blog Posts
            </a>
          </div>
          
          <article className="bg-white rounded-xl shadow-lg overflow-hidden">
            {post.imageUrl && (
              <div className="w-full h-72 md:h-96 relative">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <div className="flex flex-wrap items-center text-sm text-gray-500 mb-3 gap-3">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(post.createdAt)}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{post.author}</span>
                  </div>
                </div>
                
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
                <p className="text-xl text-gray-600 mb-6" 
                   dangerouslySetInnerHTML={{ __html: post.summary }}>
                </p>
                
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {post.tags.map((tag: string, index: number) => (
                      <a 
                        href={`/blog?tag=${encodeURIComponent(tag)}`} 
                        key={index}
                        className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
                      >
                        #{tag}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={createMarkup(post.content)} />
              
              {/* Related Posts or Author Info could go here */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Share This Article</h3>
                <div className="flex space-x-4">
                  <a 
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://taxenough.com/blog/${post.slug}`)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a 
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://taxenough.com/blog/${post.slug}`)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-800 hover:text-blue-900"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a 
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://taxenough.com/blog/${post.slug}`)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  );
} 