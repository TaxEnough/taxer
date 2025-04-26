import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth-firebase';
import { generateToken, COOKIE_NAME } from '@/lib/auth';
import { getUserData } from '@/lib/auth-firebase';

// E-posta formatı doğrulama
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export async function POST(request: NextRequest) {
  console.log('Login API called');
  
  try {
    // Get request body
    const body = await request.json();
    
    // Log with sensitive info hidden
    console.log('Request body:', { 
      email: body.email, 
      password: body.password ? '***' : undefined 
    });
    
    // Check required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Check email format
    if (!validateEmail(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format. Please enter a valid email address.' },
        { status: 400 }
      );
    }
    
    // Clean email spaces
    if (body.email.includes(' ')) {
      body.email = body.email.trim();
      console.log('Email spaces cleaned:', body.email);
    }
    
    try {
      // User login
      console.log('Logging in user:', body.email);
      const user = await loginUser(body.email, body.password);
      console.log('User login successful:', user.uid);
      
      // Get user data
      const userData = await getUserData(user.uid);
      const name = userData?.name || user.email?.split('@')[0] || 'User';
      
      // Generate token
      console.log('Generating token');
      const token = generateToken({
        uid: user.uid,
        email: user.email || '',
        name: name
      });
      
      // Create response
      const response = NextResponse.json({
        success: true,
        user: {
          id: user.uid,
          email: user.email,
          name: name
        },
        token: token, // Send token to client side too
        redirectUrl: '/dashboard'
      });
      
      // Set cookie - Use response.cookies directly
      console.log('Setting cookie');
      
      // Cookie settings
      response.cookies.set({
        name: COOKIE_NAME,
        value: token,
        httpOnly: false, // Allow access from client side
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        priority: 'high'
      });
      
      // Set response headers
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      console.log('Returning successful response, user:', {
        id: user.uid,
        email: user.email,
        name: name
      });
      
      return response;
    } catch (loginError: any) {
      console.error('Firebase login error:', loginError);
      return NextResponse.json(
        { error: loginError.message || 'Login failed' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('General login error:', error);
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
} 