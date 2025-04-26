'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// SearchParams hook'unu saran bir iç bileşen oluşturuyorum
function LoadingTransitionInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [prevPathKey, setPrevPathKey] = useState('');
  
  // Make sure we're running on the client side
  useEffect(() => {
    const currentPathKey = `${pathname}?${searchParams?.toString() || ''}`;
    
    // Navigation change listener
    if (typeof window !== 'undefined') {
      // Check DOM loading state
      if (document.readyState !== 'complete') {
        console.log('Page not fully loaded yet, showing loading indicator');
        startLoading();
      }
      
      // When page is fully loaded
      const handleLoadComplete = () => {
        console.log('Page fully loaded');
        stopLoading();
      };
      
      // When user tries to navigate to another page
      const handleBeforeUnload = () => {
        console.log('Page changing...');
        startLoading();
      };
      
      // Capture link clicks
      const handleLinkClick = (e: MouseEvent) => {
        // Only for internal links
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.href && link.href.startsWith(window.location.origin) && !link.target && !e.ctrlKey && !e.metaKey) {
          console.log('Internal link clicked');
          startLoading();
        }
      };
      
      // Capture URL hash changes
      const handleHashChange = () => {
        if (prevPathKey !== currentPathKey) {
          console.log('URL hash changed');
          startLoading();
        }
      };
      
      // Detect router changes
      if (prevPathKey && prevPathKey !== currentPathKey) {
        console.log('Router change detected', prevPathKey, '->', currentPathKey);
        startLoading();
      }
      
      window.addEventListener('load', handleLoadComplete);
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('click', handleLinkClick);
      window.addEventListener('hashchange', handleHashChange);
      
      // Cleanup
      return () => {
        window.removeEventListener('load', handleLoadComplete);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('click', handleLinkClick);
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
    
    // Store current path key
    setPrevPathKey(currentPathKey);
  }, [pathname, searchParams, prevPathKey]);
  
  // Start loading
  function startLoading() {
    console.log('Starting loading');
    setIsLoading(true);
    setProgressWidth(0);
    
    // Interval for progress bar animation
    const interval = setInterval(() => {
      setProgressWidth(prev => {
        if (prev < 90) {
          return prev + (90 - prev) / 10;
        }
        return prev;
      });
    }, 100);
    
    // Automatically close after 3 seconds max
    setTimeout(() => {
      clearInterval(interval);
      stopLoading();
    }, 3000);
    
    return interval;
  }
  
  // Stop loading
  function stopLoading() {
    console.log('Completing loading');
    setProgressWidth(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgressWidth(0);
    }, 200);
  }
  
  // useEffect for progress bar animation
  useEffect(() => {
    let progressTimer: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      progressTimer = setInterval(() => {
        setProgressWidth(prev => {
          if (prev < 90) {
            return prev + (90 - prev) / 10;
          }
          return prev;
        });
      }, 100);
      
      // Automatically close after 3 seconds max
      const maxTimeout = setTimeout(() => {
        stopLoading();
      }, 3000);
      
      return () => {
        if (progressTimer) clearInterval(progressTimer);
        clearTimeout(maxTimeout);
      };
    }
    
    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [isLoading]);
  
  // When page is fully loaded
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete' && isLoading) {
        stopLoading();
      }
    }
  }, [isLoading]);
  
  // Don't render anything if not loading
  if (!isLoading) return null;
  
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Progress bar at the top */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200">
        <div 
          className="h-full bg-primary-600 transition-all duration-300 ease-out"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      
      {/* Logo and spinner in the center - only show for longer loads */}
      {progressWidth > 30 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center justify-center bg-white bg-opacity-95 p-5 rounded-lg shadow-lg">
            <div className="relative h-12 w-12">
              {/* Logo or Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              {/* Spinning ring animation */}
              <svg className="animate-spin h-12 w-12 text-primary-500" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            
            <div className="mt-3 text-center">
              <div className="flex justify-center mb-1">
                <img
                  src="/images/onetext.png"
                  alt="TaxEnough"
                  width={100}
                  height={25}
                  className="h-auto"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Loading...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ana bileşen, Suspense kullanıyor
export default function LoadingTransition() {
  return (
    <Suspense fallback={null}>
      <LoadingTransitionInner />
    </Suspense>
  );
} 