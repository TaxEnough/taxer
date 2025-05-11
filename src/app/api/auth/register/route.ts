import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
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
    
    // Register user with Clerk
    console.log('Registering user with Clerk:', body.email);
    
    try {
      // Clerk ile kullanıcı oluştur
      const names = body.name.split(' ');
      const firstName = names[0];
      const lastName = names.length > 1 ? names.slice(1).join(' ') : '';
      
      const clerk = await clerkClient();
      const userResponse = await clerk.users.createUser({
        emailAddress: [body.email],
        password: body.password,
        firstName,
        lastName,
      });
      
      console.log('User registration successful with Clerk:', userResponse.id);
      
      // Generate token
      console.log('Generating token');
      const userData = {
        uid: userResponse.id,
        email: body.email,
        name: body.name
      };
      console.log('Token created, content:', userData);
      
      const token = await generateToken(userResponse.id);
      const { COOKIE_NAME } = await getConstants();
      
      // Create response
      const response = NextResponse.json({
        success: true,
        user: {
          id: userResponse.id,
          email: body.email,
          name: body.name
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
        id: userResponse.id,
        email: body.email,
        name: body.name
      });
      
      return response;
    } catch (registerError: any) {
      console.error('Clerk registration error:', registerError);
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