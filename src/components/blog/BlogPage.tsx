'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { BlogPost } from '@/lib/blog-firebase';

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

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  // Fetch blog posts
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching blog posts...');
        const response = await fetch('/api/blog/posts');
        
        console.log('API response:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error('An error occurred while fetching blog posts');
        }
        
        const data = await response.json();
        console.log('Received data:', JSON.stringify(data));
        console.log(`${data.length} blog posts received.`);
        
        if (data.length === 0) {
          console.log('WARNING: API response returned an empty array. Firebase query might not be working properly.');
        }
        
        // Sort by date (data might already be sorted, but let's sort again to be sure)
        data.sort((a: any, b: any) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        setPosts(data);
        
        // Collect all tags
        const allTags = data.reduce((acc: string[], post: BlogPost) => {
          if (post.tags && Array.isArray(post.tags)) {
            post.tags.forEach(tag => {
              if (!acc.includes(tag)) {
                acc.push(tag);
              }
            });
          }
          return acc;
        }, []);
        
        setTags(allTags);
      } catch (error) {
        console.error('Error fetching blog posts:', error);
        setError('An error occurred while loading blog posts. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPosts();
  }, []);

  // Search and tag filtering
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       post.summary.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTag = selectedTag 
      ? post.tags && Array.isArray(post.tags) && post.tags.includes(selectedTag)
      : true;
    
    return matchesSearch && matchesTag;
  });

  // Reset tag with search term
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSelectedTag(null);
  };

  // Tag click
  const handleTagClick = (tag: string) => {
    setSelectedTag(tag === selectedTag ? null : tag);
    setSearchTerm('');
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Search and filtering */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <input
            type="text"
            placeholder="Search in blog posts..."
            className="border border-gray-300 rounded-md px-4 py-2 w-full sm:w-auto"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedTag === tag 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Loading state */}
      {isLoading ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading blog posts...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-600">
            {selectedTag 
              ? `No blog posts found with the tag "${selectedTag}".` 
              : searchTerm 
                ? `No blog posts matching the search "${searchTerm}".`
                : 'No blog posts available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
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
                <p className="text-gray-600 mb-4 line-clamp-3 flex-grow">{post.summary}</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags && post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
                      onClick={(e) => {
                        e.preventDefault();
                        handleTagClick(tag);
                      }}
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
      )}
    </div>
  );
} 