'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useClerkAuthCache } from '@/lib/clerk-utils';
import { getClientPremiumStatus } from '@/lib/auth-client';

// Lazy load edilmiş bileşenler için
import dynamic from 'next/dynamic';

// StockTaxCalculator bileşenini doğrudan import et
import StockTaxCalculatorComponent from '@/components/dashboard/StockTaxCalculator';
// Import CSV upload component
import CsvDragDropUploader from '@/components/dashboard/CsvDragDropUploader';

// StockTaxCalculator bileşeni için wrapper
const StockTaxCalculator = (props: any) => {
  return <StockTaxCalculatorComponent {...props} />;
};

// Trade veri tipi tanımı
interface TradeData {
  ticker: string;
  transactionType: 'Buy' | 'Sell';
  numberOfShares: number;
  pricePerShare: number;
  transactionDate: string;
  totalAmount: number;
  commissionFees: number;
  buyPrice?: number;  // Purchase price added
  buyDate?: string;   // Purchase date added
  sellPrice?: number; // Selling price added
  sellDate?: string;  // Selling date added
}

// Stock tipini buraya da ekle
interface Stock {
  id: string;
  symbol: string;
  purchasePrice: number;
  sellingPrice: number;
  sharesSold: number;
  tradingFees: number;
  holdingPeriod: number;
  gainLoss?: number;
  isShortTerm?: boolean;
}

// Yükleniyor bileşeni
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
    </div>
  );
}

export default function DashboardPage() {
  const { user: firebaseUser, loading: firebaseLoading } = useAuth();
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, user: clerkUser } = useUser();
  const clerkAuth = useClerkAuthCache();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  
  // Stock tipini buraya da ekle
  const [calculatorStocks, setCalculatorStocks] = useState<Stock[]>([]);
  
  // Add this new state for the collapsible panel
  const [isTradeHistoryOpen, setIsTradeHistoryOpen] = useState(false);

  // Kullanıcı adını saklamak için bir state ekleyelim
  const [displayName, setDisplayName] = useState('');
  
  // Clerk verilerini kullanıcı adına çevirelim
  useEffect(() => {
    // Clerk verilerini kontrol et
    if (clerkLoaded && clerkSignedIn && clerkUser) {
      // Kullanıcı adını öncelik sırasına göre belirle
      if (clerkUser.firstName) {
        setDisplayName(clerkUser.firstName);
      } else if (clerkUser.username) {
        setDisplayName(clerkUser.username);
      } else if (clerkUser.fullName) {
        setDisplayName(clerkUser.fullName);
      } else if (clerkUser.primaryEmailAddress) {
        // E-posta adresinin @ işaretinden önceki kısmını al
        const emailName = clerkUser.primaryEmailAddress.emailAddress.split('@')[0];
        setDisplayName(emailName);
      } else {
        setDisplayName(''); // Boş bırak
      }
      
      console.log("Clerk user info updated:", {
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        username: clerkUser.username,
        fullName: clerkUser.fullName,
        setDisplayName: displayName
      });
    } else if (firebaseUser && firebaseUser.name) {
      setDisplayName(firebaseUser.name);
    }
  }, [clerkLoaded, clerkSignedIn, clerkUser, firebaseUser]);
  
  // Debug için kullanıcı bilgilerini logla
  useEffect(() => {
    console.log("Clerk user info:", {
      firstName: clerkUser?.firstName,
      username: clerkUser?.username,
      fullName: clerkUser?.fullName,
      emailAddress: clerkUser?.primaryEmailAddress?.emailAddress,
      isLoaded: clerkLoaded,
      isSignedIn: clerkSignedIn
    });
    console.log("Firebase user info:", firebaseUser);
    console.log("Display name being used:", displayName);
  }, [clerkUser, firebaseUser, displayName, clerkLoaded, clerkSignedIn]);

  // Handle CSV sample download
  const handleDownloadSample = () => {
    const sampleCSVContent = `Symbol,Buy Price,Sell Price,Shares Sold,Fee/Commissions,Buy Date,Sell Date
AAPL,150.25,180.75,10,7.99,2023-01-15,2023-06-20
MSFT,270.50,320.45,8,7.99,2023-02-10,2023-08-15
GOOGL,2450.75,2750.50,2,7.99,2023-03-10,2023-07-10
TSLA,200.50,235.75,15,7.99,2023-03-01,2023-07-15`;

    const blob = new Blob([sampleCSVContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-trading-history.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // İlk render'da bir kez çalışması için ref kullan
  const initRef = useRef(false);

  useEffect(() => {
    const checkAuthAndRoute = async () => {
      setPageLoading(true);
      
      try {
        // Önce Clerk ile kontrol et
        if (clerkLoaded) {
          if (clerkSignedIn && clerkUser) {
            console.log('Clerk user found');
            setPageLoading(false);
          } else {
            console.log('Clerk user not found, redirecting...');
            router.push('/login');
          }
          return;
        }
        
        // Alternatif olarak Auth Context kontrol et
        if (firebaseUser && !firebaseLoading) {
          console.log('Auth Context user found');
          setPageLoading(false);
          return;
        }
        
        // Token kontrolü yap
        const token = await getAuthTokenFromClient();
        if (token) {
          console.log('Token found');
          setPageLoading(false);
        } else {
          console.log('Session not started, redirecting...');
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      }
    };
    
    checkAuthAndRoute();
  }, [router, firebaseUser, firebaseLoading, clerkLoaded, clerkSignedIn, clerkUser]);

  // Premium kontrolü için fonksiyon eklendi
  useEffect(() => {
    const checkPremiumStatus = async () => {
      // Kullanıcının premium durumunu kontrol et
      const premiumStatus = getClientPremiumStatus();
      
      if (!premiumStatus.isPremium) {
        console.log('Premium account not found, redirecting...');
        router.push('/pricing?premium=required');
      }
    };
    
    // Kullanıcı oturum açtıysa premium durumunu kontrol et
    if (firebaseUser && !firebaseLoading || (clerkLoaded && clerkSignedIn)) {
      checkPremiumStatus();
    }
  }, [router, firebaseUser, firebaseLoading, clerkLoaded, clerkSignedIn]);

  // Yükleniyor durumu göster
  if ((!clerkLoaded && firebaseLoading) || (pageLoading && !getAuthTokenFromClient() && !clerkSignedIn)) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
              </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sol Panel - Daha hafif yükleme */}
            <div className="w-full lg:w-1/3 bg-white shadow-sm rounded-lg p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Dashboard</h1>
              
              {/* Daha modern ve gelişmiş karşılama mesajı */}
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-lg p-6 mb-6 shadow-lg text-white">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {clerkUser?.imageUrl ? (
                      <img 
                        src={clerkUser.imageUrl} 
                        alt="Profile" 
                        className="h-16 w-16 rounded-full object-cover border-4 border-white/30 shadow-xl" 
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                        <span className="text-indigo-700 text-2xl font-bold">
                          {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-1">
                      Hello, {displayName || (clerkUser ? (
                        clerkUser.firstName || 
                        clerkUser.username || 
                        clerkUser.fullName || 
                        (clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0]) || 
                        'User'
                      ) : 'User')}!
                    </h2>
                    <p className="text-white/80 text-sm">
                      Your financial tools are ready. Start managing your transactions now.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
                
                <div className="grid grid-cols-1 gap-3">
                  <a
                    href="/transactions/new" 
                    className="flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-primary-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-sm">Add New Transaction</span>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                  
                  <a
                    href="/reports" 
                    className="flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-primary-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm">View Reports</span>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Right Panel - Calculator and CSV Upload */}
            <div className="w-full lg:w-2/3">
              <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Tax Calculator</h2>
                
                {/* Always show the calculator */}
                <StockTaxCalculator initialStocks={calculatorStocks.length > 0 ? calculatorStocks : []} />
              </div>
              
              {/* CSV Upload Section - Replace with new component */}
              <CsvDragDropUploader onDataProcessed={(stocks) => {
                setCalculatorStocks(stocks);
              }} />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 
 