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
      <body className={inter.className}>
        <ClerkProvider
          appearance={{
            elements: { formButtonPrimary: 'bg-primary hover:bg-primary-dark' }
          }}
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        >
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Basit bir token cache mekanizması manuel olarak ekle
                // Bu, Clerk'in sayfa yenilemeleri arasında oturumu hatırlamasına yardımcı olur
                try {
                  const authToken = localStorage.getItem('clerk-auth-token');
                  if (authToken) {
                    window.__clerk_frontend_api = window.__clerk_frontend_api || {};
                    window.__clerk_frontend_api.tokenCache = {
                      core: { token: authToken, expiresAt: (new Date().getTime() + 3600000) }
                    };
                  }
                } catch (e) {
                  console.warn('Token cache initialization failed', e);
                }
              `
            }}
          />
          <AuthProvider>
            <Toaster position="top-center" />
            <LoadingTransition />
            <Providers>
              <main className="min-h-screen">
                {children}
              </main>
            </Providers>
            <Footer />
            <Analytics />
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  )
} 