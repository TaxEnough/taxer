"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Kullanıcı arayüzünü doğrudan Navbar içinde tanımlayarak tip uyumluluğunu sağlıyoruz
interface User {
  id: string;
  email: string;
  name: string;
  accountStatus?: 'free' | 'basic' | 'premium';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathName = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [hasSubscription, setHasSubscription] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  
  // Abonelik kontrolü için ref kullanarak tekrarlanan kontrolleri önle
  const subscriptionCheckedRef = useRef(false);

  // Check if user has an active subscription
  useEffect(() => {
    const checkSubscription = async () => {
      // Eğer zaten kontrol edilmişse ve kullanıcı değişmediyse tekrar kontrol etme
      if (subscriptionCheckedRef.current && user?.id) return;
      
      if (user && user.id) {
        try {
          // Kullanıcının abonelik durumunu kontrol et
          // 1. Önce user nesnesindeki accountStatus'e bakıyoruz (token'dan gelir)
          if (user?.accountStatus === 'basic' || user?.accountStatus === 'premium') {
            setHasSubscription(true);
            subscriptionCheckedRef.current = true;
            return;
          }

          // 2. Firestore'dan kontrol et (sadece token'da accountStatus bulunamazsa)
          // Bu işlemi sadece bir kez yapmak için, sonucu sessionStorage'a kaydediyoruz
          const sessionKey = `subscription-${user.id}`;
          const cachedStatus = sessionStorage.getItem(sessionKey);
          
          if (cachedStatus) {
            setHasSubscription(cachedStatus === 'true');
            subscriptionCheckedRef.current = true;
            return;
          }
          
          // Önbellek bulunamadı, Firestore'dan kontrol et
          const userRef = doc(db, 'users', user.id);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Firestore'da subscriptionStatus veya accountStatus kontrolü
            const isPremium = userData.subscriptionStatus === 'active' || 
                              userData.accountStatus === 'basic' || 
                              userData.accountStatus === 'premium';
                              
            // Sonucu sessionStorage'a kaydet (10 dakika geçerli)
            sessionStorage.setItem(sessionKey, isPremium ? 'true' : 'false');
            
            // Cache süresini ayarla (10 dakika)
            const expiry = Date.now() + 600000; // 10 dakika
            sessionStorage.setItem(`${sessionKey}-expiry`, expiry.toString());
            
            setHasSubscription(isPremium);
            subscriptionCheckedRef.current = true;
            return;
          }
          
          // Hiçbir premium üyelik özelliği bulunamadı
          sessionStorage.setItem(sessionKey, 'false');
          setHasSubscription(false);
          subscriptionCheckedRef.current = true;
        } catch (error) {
          console.error("Error checking subscription:", error);
          setHasSubscription(false);
        }
      } else {
        setHasSubscription(false);
        subscriptionCheckedRef.current = false; // Kullanıcı çıkış yapmış, referansı sıfırla
      }
    };
    
    // Periyodik önbellek kontrolü (10 dakikada bir)
    const checkCache = () => {
      if (!user?.id) return;
      
      const sessionKey = `subscription-${user.id}`;
      const expiryStr = sessionStorage.getItem(`${sessionKey}-expiry`);
      
      if (expiryStr) {
        const expiry = parseInt(expiryStr);
        const now = Date.now();
        
        // Önbellek süresi dolduysa, temizle ve yeniden kontrol et
        if (now > expiry) {
          sessionStorage.removeItem(sessionKey);
          sessionStorage.removeItem(`${sessionKey}-expiry`);
          subscriptionCheckedRef.current = false; // Yeniden kontrol etmeyi zorla
          checkSubscription();
        }
      }
    };
  
    checkSubscription();
    
    // 10 dakikada bir önbelleği kontrol et
    const cacheInterval = setInterval(checkCache, 600000); // 10 dakika
    
    return () => {
      clearInterval(cacheInterval);
    };
  }, [user]);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
    
  // Get display name when user changes
  useEffect(() => {
    if (user && user.name) {
      setDisplayName(user.name);
    } else if (user && user.email) {
      const emailName = user.email.split('@')[0];
      setDisplayName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
    } else {
      setDisplayName("User");
    }
  }, [user]);
  
  // Function to toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Function to toggle profile menu
  const toggleProfileMenu = () => {
    setProfileMenuOpen(!profileMenuOpen);
  };
  
  // Function to handle link click (closing menus)
  const handleLinkClick = () => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };
  
  // Function to check if a link is active
  const isLinkActive = (href: string) => {
    return pathName === href;
  };
  
  // Function to handle logout
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // Function to get display name
  const getDisplayName = () => {
    if (displayName) return displayName;
    if (user && user.name) return user.name;
    if (user && user.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'User';
  };

  // Modify the mobile menu links to conditionally show premium links
  const mobileMenuLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    // Premium sayfaları sadece aboneliği olan kullanıcılara göster
    ...(hasSubscription ? [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Transactions', href: '/transactions' },
      { name: 'Reports', href: '/reports' }
    ] : []),
    { name: 'Blog', href: '/blog' },
    // Fiyatlandırma sayfasını herkese göster, abonelere bile faydalı olabilir (upgrade seçenekleri için)
    { name: 'Pricing', href: '/pricing' },
    { name: 'Support', href: '/support' },
  ];
  
  return (
    <nav className={`bg-white fixed w-full z-20 top-0 left-0 shadow-sm ${scrolled ? 'shadow-md' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and main nav links */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center" onClick={handleLinkClick}>
                <img src="/images/logo_text.png" alt="Logo" width={32} height={32} className="h-8 w-auto" />
                <span className="ml-2 text-xl font-bold text-gray-800"></span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className={`${
                  isLinkActive('/') 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                Home
              </Link>
              <Link
                href="/about"
                className={`${
                  isLinkActive('/about') 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                About
              </Link>
              {/* Premium sayfaları sadece aboneliği olan kullanıcılara göster */}
              {user && hasSubscription && (
                <>
                  <Link
                    href="/dashboard"
                    className={`${
                      isLinkActive('/dashboard') 
                        ? 'border-primary-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={handleLinkClick}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/transactions"
                    className={`${
                      isLinkActive('/transactions') 
                        ? 'border-primary-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={handleLinkClick}
                  >
                    Transactions
                  </Link>
                  <Link
                    href="/reports"
                    className={`${
                      isLinkActive('/reports') 
                        ? 'border-primary-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={handleLinkClick}
                  >
                    Reports
                  </Link>
                </>
              )}
              <Link
                  href="/blog"
                className={`${
                  isLinkActive('/blog') 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                Blog
              </Link>
              {/* Pricing linkini herkese göster */}
              <Link
                href="/pricing"
                className={`${
                  isLinkActive('/pricing') 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                Pricing
              </Link>
              <Link
                href="/support"
                className={`${
                  isLinkActive('/support') 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                Support
              </Link>
            </div>
          </div>
          
          {/* User menu or login/register buttons */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {user ? (
              <div className="ml-3 relative">
                <div>
                  <button
                    onClick={toggleProfileMenu}
                    className="bg-white flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    id="user-menu-button"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                      {getDisplayName().charAt(0).toUpperCase()}
                    </div>
                  </button>
                </div>
                {profileMenuOpen && (
                  <div 
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    tabIndex={-1}
                  >
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      tabIndex={-1}
                      id="user-menu-item-0"
                      onClick={handleLinkClick}
                    >
                      Profile
                    </Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      tabIndex={-1}
                      id="user-menu-item-2"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex space-x-4">
                <Link
                  href="/login"
                  className="text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium"
                  onClick={handleLinkClick}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-primary-600 text-white hover:bg-primary-700 px-3 py-2 rounded-md text-sm font-medium"
                  onClick={handleLinkClick}
                >
                  Register
                </Link>
              </div>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Icon when menu is closed */}
              <svg
                className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {/* Icon when menu is open */}
              <svg
                className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu, show/hide based on menu state */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} sm:hidden`}>
        <div className="pt-2 pb-3 space-y-1">
          <Link
            href="/"
            className={`${
              isLinkActive('/') 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={handleLinkClick}
          >
            Home
          </Link>
          <Link
            href="/about"
            className={`${
              isLinkActive('/about') 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={handleLinkClick}
          >
            About
          </Link>
          {/* Premium sayfaları sadece aboneliği olan kullanıcılara göster */}
          {user && hasSubscription && (
            <>
              <Link
                href="/dashboard"
                className={`${
                  isLinkActive('/dashboard') 
                    ? 'bg-primary-50 border-primary-500 text-primary-700' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={handleLinkClick}
              >
                Dashboard
              </Link>
              <Link
                href="/transactions"
                className={`${
                  isLinkActive('/transactions') 
                    ? 'bg-primary-50 border-primary-500 text-primary-700' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={handleLinkClick}
              >
                Transactions
              </Link>
              <Link
                href="/reports"
                className={`${
                  isLinkActive('/reports') 
                    ? 'bg-primary-50 border-primary-500 text-primary-700' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={handleLinkClick}
              >
                Reports
              </Link>
            </>
          )}
          <Link
            href="/blog"
            className={`${
              isLinkActive('/blog') 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={handleLinkClick}
          >
            Blog
          </Link>
          {/* Pricing linkini herkese göster */}
          <Link
            href="/pricing"
            className={`${
              isLinkActive('/pricing') 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
              : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={handleLinkClick}
          >
            Pricing
          </Link>
          <Link
            href="/support"
            className={`${
              isLinkActive('/support') 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={handleLinkClick}
          >
            Support
          </Link>
        </div>
        <div className="pt-4 pb-3 border-t border-gray-200">
        {user ? (
            <>
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                  {getDisplayName().charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{getDisplayName()}</div>
                  <div className="text-sm font-medium text-gray-500">{user.email || 'No email available'}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
                <Link
                href="/profile"
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  onClick={handleLinkClick}
              >
                  Profile
                </Link>
                <button
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                onClick={handleLogout}
              >
                Logout
                </button>
            </div>
            </>
        ) : (
            <div className="mt-3 space-y-1">
              <Link
                href="/login"
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                onClick={handleLinkClick}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                onClick={handleLinkClick}
              >
                Register
              </Link>
            </div>
          )}
          </div>
      </div>
    </nav>
  );
} 
