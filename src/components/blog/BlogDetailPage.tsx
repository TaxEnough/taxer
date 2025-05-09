'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import type { BlogPost } from '@/lib/blog-firebase';

export default function BlogDetailPage({ post }: { post: BlogPost }) {
  const router = useRouter();
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelatedPosts = async () => {
      if (!post || !post.tags || post.tags.length === 0) {
        setRelatedPosts([]);
        setLoading(false);
        return;
      }

      // Get related posts (with the same tags)
      try {
        // Get similar posts using the first tag
        const primaryTag = post.tags[0];
        const response = await fetch(`/api/blog/posts?tag=${encodeURIComponent(primaryTag)}`);
        
        if (response.ok) {
          const data = await response.json();
          // Filter out the current post and show maximum 2 posts
          const filtered = data.filter((p: BlogPost) => p.id !== post.id).slice(0, 2);
          setRelatedPosts(filtered);
        }
      } catch (error) {
        console.error('Error fetching related posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedPosts();
  }, [post]);

  const goBack = () => {
    router.push('/blog');
  };

  // Format timestamp or string as date
  const formatDate = (dateValue: string | Timestamp | Date) => {
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toLocaleDateString('en-US');
    } else if (dateValue instanceof Timestamp) {
      return dateValue.toDate().toLocaleDateString('en-US');
    } else if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('en-US');
    }
    return 'No date';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button
        onClick={goBack}
        className="flex items-center text-sm text-blue-600 hover:text-blue-800 mb-6"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-1"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        Back
      </button>

      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-4">
            {post.title}
          </h1>
          <p className="text-xl text-gray-600 mb-6" 
             dangerouslySetInnerHTML={{ __html: post.summary }}>
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500 gap-4">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold mr-2">
                {post.author.charAt(0).toUpperCase()}
              </div>
              <span>{post.author}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
              <span>Published: {formatDate(post.createdAt)}</span>
              {post.updatedAt && post.updatedAt !== post.createdAt && (
                <span>Updated: {formatDate(post.updatedAt)}</span>
              )}
            </div>
          </div>
          
          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <span 
                  key={index} 
                  className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full cursor-pointer hover:bg-blue-100"
                  onClick={() => router.push(`/blog?tag=${encodeURIComponent(tag)}`)}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {post.imageUrl && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        <div className="prose prose-blue max-w-none">
          {generateContent(post.content)}
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Related Posts
          </h2>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                  <div className="flex gap-1">
                    <div className="h-4 w-12 bg-gray-200 rounded"></div>
                    <div className="h-4 w-12 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : relatedPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedPosts.map(relatedPost => (
                <div
                  key={relatedPost.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/blog/${relatedPost.slug}`)}
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {relatedPost.title}
                  </h3>
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {relatedPost.summary}
                  </p>
                  {relatedPost.tags && relatedPost.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {relatedPost.tags.slice(0, 2).map((tag, index) => (
                        <span key={index} className="text-xs text-blue-600">
                          #{tag}
                        </span>
                      ))}
                      {relatedPost.tags.length > 2 && (
                        <span className="text-xs text-gray-500">+{relatedPost.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No related posts found.</p>
          )}
        </div>
      </article>
    </div>
  );
}

// Simple content generator function
function generateContent(content: string) {
  // Markdown to HTML conversion can be added here
  // For now, we're using simple formatting
  if (!content || content.trim().length === 0) {
    return <p className="text-gray-500">No content found.</p>;
  }
  
  // Split paragraphs
  const paragraphs = content.split('\n\n');
  
  return (
    <>
      {paragraphs.map((paragraph, index) => {
        // Heading check - if starts with #
        if (paragraph.startsWith('# ')) {
          return <h2 key={index} className="text-2xl font-bold mb-4 mt-8">{paragraph.substring(2)}</h2>;
        }
        // Subheading check - if starts with ##
        else if (paragraph.startsWith('## ')) {
          return <h3 key={index} className="text-xl font-bold mb-3 mt-6">{paragraph.substring(3)}</h3>;
        }
        // Normal paragraph
        else {
          return <p key={index} className="mb-4">{paragraph}</p>;
        }
      })}
    </>
  );
} 