"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserButton, SignInButton, useUser } from '@clerk/nextjs';

// Kullanıcı arayüzünü doğrudan Navbar içinde tanımlayarak tip uyumluluğunu sağlıyoruz
interface User {
  id: string;
  email: string;
  name: string;
  accountStatus?: 'free' | 'basic' | 'premium';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser();
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
  
  // Premium veya basic hesap durumu kontrolü
  const hasPermission = () => {
    // Context'ten alınan kullanıcı bilgilerine göre kontrol et
    if (user?.accountStatus === 'basic' || user?.accountStatus === 'premium') {
      return true;
    }
    
    // Clerk'ten doğrudan kontrol
    if (isClerkLoaded && isClerkSignedIn && clerkUser) {
      const userWithMetadata = clerkUser as any;
      const subscription = userWithMetadata?.privateMetadata?.subscription || userWithMetadata?.publicMetadata?.subscription;
      return subscription?.status === 'active';
    }
    
    return false;
  };

  // Check if user has an active subscription
  useEffect(() => {
    const checkSubscription = async () => {
      // Clerk entegrasyonu için
      if (isClerkLoaded && isClerkSignedIn && clerkUser) {
        // Clerk'teki kullanıcı bilgilerini kullan
        const userWithMetadata = clerkUser as any;
        const clerkHasSubscription = !!(userWithMetadata?.publicMetadata?.subscription || userWithMetadata?.privateMetadata?.subscription);
        setHasSubscription(clerkHasSubscription);
        subscriptionCheckedRef.current = true;
        return;
      }
      
      // Kullanıcı girişi olmadığında veya kontrol edilemediğinde
      setHasSubscription(false);
      subscriptionCheckedRef.current = false;
    };
    
    checkSubscription();
  }, [user, isClerkLoaded, isClerkSignedIn, clerkUser]);

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
    // Önce Clerk'ten bilgileri kontrol et
    if (isClerkLoaded && isClerkSignedIn && clerkUser) {
      const clerkName = clerkUser.firstName || clerkUser.username;
      if (clerkName) {
        setDisplayName(clerkName);
        return;
      }
    }
    
    // Clerk'ten bilgi alınamazsa Auth Context'ten dön
    if (user && user.name) {
      setDisplayName(user.name);
    } else if (user && user.email) {
      const emailName = user.email.split('@')[0];
      setDisplayName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
    } else {
      setDisplayName("User");
    }
  }, [user, isClerkLoaded, isClerkSignedIn, clerkUser]);
  
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
    
    // Clerk kullanıcı bilgilerinden kontrol et
    if (isClerkLoaded && isClerkSignedIn && clerkUser) {
      return clerkUser.firstName || clerkUser.username || 'User';
    }
    
    // Fallback
    if (user && user.name) return user.name;
    if (user && user.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'User';
  };

  // Kullanıcının premium durumunu kontrol eden fonksiyon
  const isPremiumUser = () => {
    // Clerk üzerinden premium durumu kontrolü
    if (isClerkLoaded && isClerkSignedIn && clerkUser) {
      const userWithMetadata = clerkUser as any;
      // Subscription statüsü kontrol edilir
      const subscription = userWithMetadata?.publicMetadata?.subscription;
      if (subscription && subscription.status === 'active') {
        return true;
      }
      
      // isPremium alanı da kontrol edilir
      if (userWithMetadata?.publicMetadata?.isPremium === true) {
        return true;
      }
    }
    
    // Kullanıcının abonelik durumunu eski yöntemle kontrol et
    return hasSubscription;
  };
  
  // Premium durumunu hesapla
  const isPremium = isPremiumUser();
  
  // Mobil menü için link dizisi oluştur
  const mobileMenuLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    // Koşullu bağlantılar
    ...(hasPermission() ? [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Transactions', href: '/transactions' },
      { name: 'Reports', href: '/reports' }
    ] : []),
    { name: 'Blog', href: '/blog' },
    { name: 'Support', href: '/support' },
    // Ücretsiz kullanıcılar için ücretlendirme
    ...(!hasPermission() ? [{ name: 'Pricing', href: '/pricing' }] : [])
  ];

  // User hesap durumunu gösteren bir fonksiyon
  const getUserAccountStatus = () => {
    // Clerk'ten kontrol et
    if (isClerkLoaded && isClerkSignedIn && clerkUser) {
      const userWithMetadata = clerkUser as any;
      const subscription = userWithMetadata?.privateMetadata?.subscription || userWithMetadata?.publicMetadata?.subscription;
      if (subscription?.status === 'active') {
        return subscription.plan || 'Premium';
      }
      return 'Free Plan';
    }
    
    // Fallback kontrol
    if (user && (user as any).accountStatus === 'basic') return 'Basic';
    if (user && (user as any).accountStatus === 'premium') return 'Premium';
    return 'Free Plan';
  };
  
  return (
    <nav className={`bg-white fixed w-full z-20 top-0 left-0 shadow-sm ${scrolled ? 'shadow-md' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and main nav links */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <a href="/" className="flex items-center" onClick={handleLinkClick}>
                <img src="/images/logo_text.png" alt="Logo" width={32} height={32} className="h-8 w-auto" />
                <span className="ml-2 text-xl font-bold text-gray-800"></span>
              </a>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <a href="/" 
                className={`${
                  isLinkActive('/') 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                Home
              </a>
              <a href="/about"
                className={`${
                  isLinkActive('/about') 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                About
              </a>
              
              {/* Premium linkler için koşullu gösterim */}
              {hasPermission() && (
                <>
                  <a href="/dashboard"
                    className={`${
                      isLinkActive('/dashboard') 
                        ? 'border-primary-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={handleLinkClick}
                  >
                    Dashboard
                  </a>
                  <a href="/transactions"
                    className={`${
                      isLinkActive('/transactions') 
                        ? 'border-primary-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={handleLinkClick}
                  >
                    Transactions
                  </a>
                  <a href="/reports"
                    className={`${
                      isLinkActive('/reports') 
                        ? 'border-primary-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={handleLinkClick}
                  >
                    Reports
                  </a>
                </>
              )}
              
              {/* Blog ve Support butonları */}
              <a href="/blog"
                className={`${
                  pathName.startsWith('/blog')
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                Blog
              </a>
              
              <a href="/support"
                className={`${
                  pathName.startsWith('/support')
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                onClick={handleLinkClick}
              >
                Support
              </a>
              
              {!isPremium && (
                <a href="/pricing"
                  className={`${
                    isLinkActive('/pricing') 
                      ? 'border-primary-500 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  onClick={handleLinkClick}
                >
                  Pricing
                </a>
              )}
            </div>
          </div>

          {/* User section */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {isClerkLoaded ? (
              isClerkSignedIn ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700 font-medium">
                    {getUserAccountStatus()}
                  </span>
                  
                  {/* Profil dropdown menüsü */}
                  <div className="relative">
                    <button 
                      onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                      className="flex items-center space-x-2 focus:outline-none"
                    >
                      {clerkUser?.imageUrl ? (
                        <img 
                          src={clerkUser.imageUrl} 
                          alt="Profile" 
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 font-medium text-sm">
                            {getDisplayName().charAt(0) || 'U'}
                          </span>
                        </div>
                      )}
                      <span className="hidden md:block text-sm font-medium text-gray-700">
                        {getDisplayName() || 'User'}
                      </span>
                      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Dropdown menu */}
                    {profileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5">
                        <a 
                          href="/profile" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          Profile Settings
                        </a>
                        <a 
                          href="/settings" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          Account Settings
                        </a>
                        <a 
                          href="/subscription" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          Subscription
                        </a>
                        <button 
                          onClick={() => {
                            logout();
                            setProfileMenuOpen(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-100"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                    Sign In
                  </button>
                </SignInButton>
              )
            ) : (
              // Yükleme göstergesi
              <div className="flex items-center space-x-2">
                <div className="animate-pulse bg-gray-200 h-8 w-20 rounded-md"></div>
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
          {mobileMenuLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`${
                isLinkActive(link.href) 
                  ? 'bg-primary-50 border-primary-500 text-primary-700' 
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
              onClick={handleLinkClick}
            >
              {link.name}
            </a>
          ))}
        </div>
        
        {/* Mobile menu user section */}
        <div className="pt-4 pb-3 border-t border-gray-200">
          {isClerkLoaded ? (
            isClerkSignedIn ? (
              <div>
                <div className="flex items-center px-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-800 font-medium">
                        {getDisplayName().charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">{getDisplayName()}</div>
                    <div className="text-sm font-medium text-gray-500">
                      {isClerkSignedIn ? clerkUser.primaryEmailAddress?.emailAddress : ''}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <a
                    href="/profile"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    onClick={handleLinkClick}
                  >
                    Profile
                  </a>
                  <a
                    href="/settings"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    onClick={handleLinkClick}
                  >
                    Settings
                  </a>
                  <button
                    onClick={() => {
                      handleLinkClick();
                      logout();
                    }}
                    className="w-full text-left block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 flex justify-center">
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                    Sign In
                  </button>
                </SignInButton>
              </div>
            )
          ) : (
            <div className="px-4 py-4 flex justify-center">
              <div className="animate-pulse bg-gray-200 h-8 w-20 rounded-md"></div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 
