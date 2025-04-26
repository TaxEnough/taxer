import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth-firebase';
import { generateToken, setAuthCookieOnServer, getConstants } from '@/lib/auth-server';

// E-posta formatı doğrulama
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export async function POST(request: NextRequest) {
  console.log('Register API called');
  
  try {
    // Get request body
    const body = await request.json();
    console.log('Request body:', { 
      name: body.name,
      email: body.email, 
      password: body.password ? '***' : undefined 
    });
    
    // Check required fields
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
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
    
    // Check password length
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }
    
    // Register user
    console.log('Registering user:', body.email);
    
    try {
      const user = await registerUser(body.name, body.email, body.password);
      console.log('User registration successful:', user.uid);
      
      // Generate token
      console.log('Generating token');
      const userData = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || body.name
      };
      console.log('Token created, content:', userData);
      
      const token = await generateToken(user.uid);
      const { COOKIE_NAME } = await getConstants();
      
      // Create response
      const response = NextResponse.json({
        success: true,
        user: {
          id: user.uid,
          email: user.email,
          name: user.displayName || body.name
        },
        token: token, // Send token to client side too
        redirectUrl: '/dashboard'
      });
      
      // Set cookie - Use response.cookies directly
      console.log('Setting cookie');
      
      // Cookie settings
      await setAuthCookieOnServer(token, response);
      
      // Set response headers
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      console.log('Returning successful response, user:', {
        id: user.uid,
        email: user.email,
        name: user.displayName || body.name
      });
      
      return response;
    } catch (registerError: any) {
      console.error('Firebase registration error:', registerError);
      return NextResponse.json(
        { error: registerError.message || 'Registration failed' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('General registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 400 }
    );
  }
} 