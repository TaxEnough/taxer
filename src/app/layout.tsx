import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import { Providers } from './providers'
import LoadingTransition from '@/components/LoadingTransition'
import React, { Suspense } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { AuthProvider } from '@/context/AuthContext'
import Footer from '@/components/Footer'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import PremiumSync from '@/components/PremiumSync'
import { GoogleAnalytics } from '@next/third-parties/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tax Enough | Your Tax and Investment Tools Assistant',
  description: 'Calculate your tax obligations from stock investments in the US quickly and accurately.',
  icons: {
    icon: [
      {
        url: '/images/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/images/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/images/favicon.ico',
        sizes: 'any',
      },
    ],
    apple: {
      url: '/images/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
    other: [
      {
        rel: 'android-chrome-192x192',
        url: '/images/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        rel: 'android-chrome-512x512',
        url: '/images/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  },
  manifest: '/images/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-US">
      <head>
        {/* Clerk oturum sürdürme için özel script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Session token yönetimi ve sürdürme
              (function() {
                function setClerkTokenObserver() {
                  try {
                    // LocalStorage'ı kullanabilirliği kontrol et
                    if (typeof localStorage === 'undefined') return;
                    
                    // JWT token ve session gözlemcisi
                    setInterval(function() {
                      // Clerk session_jwt token'ını ara
                      const allCookies = document.cookie.split(';').map(c => c.trim());
                      const sessionTokenCookie = allCookies.find(c => c.startsWith('__session=') || c.startsWith('__clerk_db_jwt='));
                      
                      if (sessionTokenCookie) {
                        const token = sessionTokenCookie.split('=')[1];
                        if (token) {
                          // Token güncellemesi
                          localStorage.setItem('clerk-auth-token', token);
                          console.log('Clerk token refreshed');
                          
                          // Window nesnesine de ekle
                          if (window.__clerk_frontend_api) {
                            window.__clerk_frontend_api.tokenCache = window.__clerk_frontend_api.tokenCache || {};
                            window.__clerk_frontend_api.tokenCache.core = {
                              token: token,
                              expiresAt: (new Date().getTime() + 3600000)
                            };
                          }
                        }
                      }
                    }, 5000); // 5 saniyede bir kontrol et
                  } catch (e) {
                    console.warn('Clerk token observer error:', e);
                  }
                }
                
                // Sayfa yüklendiğinde başlat
                if (document.readyState === 'complete') {
                  setClerkTokenObserver();
                } else {
                  window.addEventListener('load', setClerkTokenObserver);
                }
              })();
            `
          }}
        />
      </head>
      <body className={inter.className}>
        <ClerkProvider
          appearance={{
            elements: { formButtonPrimary: 'bg-primary hover:bg-primary-dark' }
          }}
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        >
          <AuthProvider>
            <Toaster position="top-center" />
            <LoadingTransition />
            <PremiumSync />
            <Providers>
              <main className="min-h-screen">
                {children}
              </main>
              <Footer />
            </Providers>
            <Analytics />
            <GoogleAnalytics gaId="G-K9V32THQ8M" />
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  )
} 