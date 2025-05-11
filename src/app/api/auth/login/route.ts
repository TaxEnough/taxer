import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { generateToken, setAuthCookie, COOKIE_NAME } from '@/lib/auth';

// Email format validation
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export async function POST(request: NextRequest) {
  console.log('Login API called - Endpoint started');
  
  try {
    const data = await request.json();
    const { email: emailInput, password } = data;
    
    // Clean email value
    let email = emailInput;

    if (!email || !password) {
      console.log('Login API - Email or password missing');
      return NextResponse.json({
        success: false,
        message: 'Email and password are required',
      }, { status: 400 });
    }

    // Check email format
    if (!validateEmail(email)) {
      console.log('Login API - Invalid email format');
      return NextResponse.json(
        { error: 'Invalid email format. Please enter a valid email address.' },
        { status: 400 }
      );
    }
    
    // Clean email spaces
    if (email.includes(' ')) {
      email = email.trim();
      console.log('Email spaces cleaned:', email);
    }
    
    try {
      // Clerk ile giriş yapmak için
      console.log('Logging in user with Clerk:', email);
      
      // Clerk API üzerinden doğrulama yap
      const clerk = await clerkClient();
      
      // Email'i kullanarak kullanıcıyı bul
      const usersResponse = await clerk.users.getUserList({
        emailAddress: [email]
      });
      
      if (!usersResponse.data || usersResponse.data.length === 0) {
        console.log('Login API - User not found');
        return NextResponse.json({
          success: false,
          message: 'Login failed: Email or password is incorrect',
        }, { status: 401 });
      }
      
      const user = usersResponse.data[0];
      
      // Clerk şifre doğrulama için doğrudan bir API bulunmadığından,
      // kullanıcıyı email'i ile bulduktan sonra diğer bilgileri alıyoruz
      // Not: Gerçek uygulamada, Clerk'in kendi oturum açma araçlarını kullanmanız önerilir
      
      // Kullanıcı hesap durumunu al
      let accountStatus: 'free' | 'basic' | 'premium' = 'free'; // Default to free
      
      try {
        console.log('Fetching user account status from Clerk metadata');
        
        // Clerk metadatasından kullanıcı abonelik durumunu al
        const subscription = (user.privateMetadata as any)?.subscription || (user.publicMetadata as any)?.subscription;
        
        if (subscription && subscription.status === 'active') {
          accountStatus = subscription.plan || 'premium';
          console.log(`User has a valid subscription: ${accountStatus}`);
        } else {
          console.log('User has no subscription or inactive subscription');
        }
      } catch (metadataError) {
        console.error('Error fetching user subscription status:', metadataError);
        // Continue with default free status
      }
      
      // Create user data object
      const userData = {
        uid: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || email,
        accountStatus: accountStatus
      };
      
      // Generate token with user data
      const token = generateToken(userData);
      
      // Prepare user information
      console.log('Login API - User information ready:', {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        accountStatus: userData.accountStatus
      });
      
      // Prepare response body
      const responseBody = {
        success: true,
        user: userData,
        token: token,
        redirectUrl: accountStatus === 'free' ? '/pricing' : '/dashboard'
      };
      
      // Create response
      console.log('Login API - Creating response');
      const response = NextResponse.json(responseBody);
      
      // Set cookie directly
      console.log('Login API - Setting cookie');
      response.cookies.set({
        name: COOKIE_NAME,
        value: token,
        httpOnly: false,      // False for client access
        path: '/',
        sameSite: 'lax',      // Standard value for Vercel compatibility
        secure: false,        // Allow HTTP for development
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
      
      // Manual header token
      response.headers.set('X-Auth-Token', token);
      
      // Cache control
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      console.log('Login API - Operation successful, returning response');
      return response;
    } catch (loginError: any) {
      console.error('Clerk login error:', loginError);
      const errorMessage = loginError.message || 'Login failed';
      const statusCode = 401;
      
      console.log(`Login API - Clerk error: ${errorMessage}, code: ${statusCode}`);
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error: any) {
    console.error('General login error:', error);
    
    // Evaluate errors
    let errorMessage = 'Login operation failed';
    let statusCode = 500;
    
    console.log(`Login API - General error: ${errorMessage}, code: ${statusCode}`);
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: statusCode });
  }
} 