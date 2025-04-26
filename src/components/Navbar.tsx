'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  
  // Make sure we're rendering on the client side
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Toggle menu open/close
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    
    // Close profile menu if it's open
    if (isProfileMenuOpen) {
      setIsProfileMenuOpen(false);
    }
  };
  
  // Toggle profile menu open/close
  const toggleProfileMenu = () => {
    setIsProfileMenuOpen(!isProfileMenuOpen);
    
    // Close menu if it's open
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  };
  
  // Close menus
  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
  };
  
  // Link click handler
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    closeMenus();
    router.push(path);
  };
  
  // Check if link is active
  const isActive = (path: string) => {
    return pathname === path;
  };
  
  // Get display name (create from email if name is missing)
  const getDisplayName = () => {
    if (!user) return '';
    return user.name || (user.email ? user.email.split('@')[0] : 'User');
  };
  
  // Logout
  const handleLogout = async () => {
    closeMenus();
    try {
      await logout();
      // Redirection happens inside logout function
    } catch (error) {
      console.error('Error while logging out:', error);
    }
  };
  
  // Function to redirect to external blog page
  const navigateToBlog = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // Redirect to blog subdomain
    window.open('https://blog.siteadi.com', '_blank');
  };
  
  // Don't show anything before client-side rendering
  if (!mounted) {
    return <div className="h-16 bg-white shadow"></div>;
  }
  
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <a 
                href="/" 
                className="flex items-center" 
                onClick={(e) => handleLinkClick(e, '/')}
              >
                <Image
                  src="/images/logo_text.png"
                  alt="Tax Enough"
                  width={150}
                  height={40}
                  className="h-8 w-auto"
                />
              </a>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <a 
                href="/"
                className={`${
                  isActive('/') 
                    ? 'border-blue-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                onClick={(e) => handleLinkClick(e, '/')}
              >
                Home
              </a>
              
              <a
                href="/about"
                className={`${
                  isActive('/about') 
                    ? 'border-blue-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                onClick={(e) => handleLinkClick(e, '/about')}
              >
                About
              </a>
              
              {user && (
                <>
                  <a
                    href="/dashboard"
                    className={`${
                      isActive('/dashboard') 
                        ? 'border-blue-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                    onClick={(e) => handleLinkClick(e, '/dashboard')}
                  >
                    Dashboard
                  </a>
                  
                  <a
                    href="/transactions"
                    className={`${
                      isActive('/transactions') 
                        ? 'border-blue-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                    onClick={(e) => handleLinkClick(e, '/transactions')}
                  >
                    Transactions
                  </a>
                  
                  <a
                    href="/reports"
                    className={`${
                      isActive('/reports') 
                        ? 'border-blue-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                    onClick={(e) => handleLinkClick(e, '/reports')}
                  >
                    Reports
                  </a>
                  
                  <a
                    href="/blog"
                    className={`${
                      isActive('/blog') 
                        ? 'border-blue-500 text-gray-900' 
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                    onClick={(e) => handleLinkClick(e, '/blog')}
                  >
                    Blog
                  </a>
                </>
              )}
              
              {/* Blog link visible for visitors too */}
              {!user && (
                <a
                  href="/blog"
                  className={`${
                    isActive('/blog') 
                      ? 'border-blue-500 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                  onClick={(e) => handleLinkClick(e, '/blog')}
                >
                  Blog
                </a>
              )}
              
              {/* Pricing link - visible to everyone */}
              <a
                href="/pricing"
                className={`${
                  isActive('/pricing') 
                    ? 'border-blue-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                onClick={(e) => handleLinkClick(e, '/pricing')}
              >
                Pricing
              </a>
              
              {/* Support link - visible to everyone */}
              <a
                href="/support"
                className={`${
                  isActive('/support') 
                    ? 'border-blue-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full`}
                onClick={(e) => handleLinkClick(e, '/support')}
              >
                Support
              </a>
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {user ? (
              <div className="ml-3 relative">
                <div>
                  <button
                    type="button"
                    className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    id="user-menu-button"
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="true"
                    onClick={toggleProfileMenu}
                  >
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {getDisplayName().charAt(0).toUpperCase()}
                    </div>
                  </button>
                </div>
                
                {isProfileMenuOpen && (
                  <div 
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    tabIndex={-1}
                  >
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                      <div className="font-medium">{getDisplayName()}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    
                    <a 
                      href="/profile"
                      className={`${
                        isActive('/profile') ? 'bg-gray-100' : ''
                      } block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`}
                      role="menuitem"
                      tabIndex={-1}
                      id="user-menu-item-0"
                      onClick={(e) => handleLinkClick(e, '/profile')}
                    >
                      Profile
                    </a>
                    
                    {/* Blog management link - only visible to admin users */}
                    {user && (user.email === 'info.taxenough@gmail.com') && (
                      <a 
                        href="/admin/blog"
                        className={`${
                          isActive('/admin/blog') ? 'bg-gray-100' : ''
                        } block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`}
                        role="menuitem"
                        tabIndex={-1}
                        id="user-menu-item-1"
                        onClick={(e) => handleLinkClick(e, '/admin/blog')}
                      >
                        Blog Management
                      </a>
                    )}
                    
                    <a 
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-200"
                      role="menuitem"
                      tabIndex={-1}
                      id="user-menu-item-3"
                      onClick={handleLogout}
                    >
                      Logout
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-x-4">
                <a
                  href="/login"
                  className={`${
                    isActive('/login') 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                  } px-4 py-2 rounded-md text-sm font-medium`}
                  onClick={(e) => handleLinkClick(e, '/login')}
                >
                  Login
                </a>
                
                <a
                  href="/register"
                  className={`${
                    isActive('/register') 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } px-4 py-2 rounded-md text-sm font-medium`}
                  onClick={(e) => handleLinkClick(e, '/register')}
                >
                  Register
                </a>
              </div>
            )}
          </div>
          
          <div className="-mr-2 flex items-center sm:hidden">
            {/* Mobile menu button */}
            <button
              type="button"
              className="bg-white inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}
              onClick={toggleMenu}
            >
              <span className="sr-only">Open main menu</span>
              
              {/* Icon when menu is closed */}
              <svg
                className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              
              {/* Icon when menu is open */}
              <svg
                className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu, show/hide based on menu state */}
      <div
        className={`${isMenuOpen ? 'block' : 'hidden'} sm:hidden`}
        id="mobile-menu"
      >
        <div className="pt-2 pb-3 space-y-1">
          <a
            href="/"
            className={`${
              isActive('/') 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={(e) => handleLinkClick(e, '/')}
          >
            Home
          </a>
          
          <a
            href="/about"
            className={`${
              isActive('/about') 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={(e) => handleLinkClick(e, '/about')}
          >
            About
          </a>
          
          {user && (
            <>
              <a
                href="/dashboard"
                className={`${
                  isActive('/dashboard') 
                    ? 'bg-blue-50 border-blue-500 text-blue-700' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={(e) => handleLinkClick(e, '/dashboard')}
              >
                Dashboard
              </a>
              
              <a
                href="/transactions"
                className={`${
                  isActive('/transactions') 
                    ? 'bg-blue-50 border-blue-500 text-blue-700' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={(e) => handleLinkClick(e, '/transactions')}
              >
                Transactions
              </a>
              
              <a
                href="/reports"
                className={`${
                  isActive('/reports') 
                    ? 'bg-blue-50 border-blue-500 text-blue-700' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={(e) => handleLinkClick(e, '/reports')}
              >
                Reports
              </a>
            </>
          )}
          
          <a
            href="/blog"
            className={`${
              isActive('/blog') 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={(e) => handleLinkClick(e, '/blog')}
          >
            Blog
          </a>
          
          {/* Pricing link in mobile menu */}
          <a
            href="/pricing"
            className={`${
              isActive('/pricing') 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={(e) => handleLinkClick(e, '/pricing')}
          >
            Pricing
          </a>
          
          {/* Support link in mobile menu */}
          <a
            href="/support"
            className={`${
              isActive('/support') 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            onClick={(e) => handleLinkClick(e, '/support')}
          >
            Support
          </a>
        </div>
        
        {/* Mobile menu user section */}
        {user ? (
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                  {getDisplayName().charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">
                  {getDisplayName()}
                </div>
                <div className="text-sm font-medium text-gray-500">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <a
                href="/profile"
                className={`${
                  isActive('/profile') 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                } block px-4 py-2 text-base font-medium`}
                onClick={(e) => handleLinkClick(e, '/profile')}
              >
                Profile
              </a>
              
              <a
                href="/settings"
                className={`${
                  isActive('/settings') 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                } block px-4 py-2 text-base font-medium`}
                onClick={(e) => handleLinkClick(e, '/settings')}
              >
                Settings
              </a>
              
              {user && (user.email === 'info.taxenough@gmail.com') && (
                <a
                  href="/admin/blog"
                  className={`${
                    isActive('/admin/blog') 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  } block px-4 py-2 text-base font-medium`}
                  onClick={(e) => handleLinkClick(e, '/admin/blog')}
                >
                  Blog Management
                </a>
              )}
              
              <a
                href="#"
                className="text-gray-600 hover:bg-gray-50 hover:text-gray-800 block px-4 py-2 text-base font-medium"
                onClick={handleLogout}
              >
                Logout
              </a>
            </div>
          </div>
        ) : (
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex justify-around px-4">
              <a
                href="/login"
                className={`${
                  isActive('/login') 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                } px-4 py-2 rounded-md text-sm font-medium w-1/2 text-center mx-2`}
                onClick={(e) => handleLinkClick(e, '/login')}
              >
                Login
              </a>
              
              <a
                href="/register"
                className={`${
                  isActive('/register') 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } px-4 py-2 rounded-md text-sm font-medium w-1/2 text-center mx-2`}
                onClick={(e) => handleLinkClick(e, '/register')}
              >
                Register
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
} 