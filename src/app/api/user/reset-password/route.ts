import { NextRequest, NextResponse } from 'next/server';

// Email format validation
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export async function POST(request: NextRequest) {
  console.log('Password reset API called');
  
  try {
    // Get request body
    const body = await request.json();
    
    console.log('Request body:', { 
      email: body.email 
    });
    
    // Email check
    if (!body.email) {
      return NextResponse.json(
        { error: 'Email address is required' }, 
        { status: 400 }
      );
    }
    
    // Email format check
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
      // Doğrudan Clerk'in sağladığı şifre sıfırlama bağlantısına yönlendirme bilgileri
      const redirectUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || 'https://accounts.taxer.com.tr/sign-in';
      
      // Successful response - Kullanıcıyı Clerk'in şifre sıfırlama sayfasına yönlendirme bilgisi
      return NextResponse.json({ 
        success: true,
        message: 'Please use the Clerk sign-in page to reset your password',
        redirectUrl: redirectUrl
      });
    } catch (resetError: any) {
      console.error('Password reset error:', resetError);
      
      // Always return successful response for user experience
      // This prevents leaking whether the email address exists
      return NextResponse.json({ 
        success: true,
        message: 'If this email address is registered in our system, you can reset your password through the sign-in page'
      });
    }
  } catch (error: any) {
    console.error('General error:', error);
    
    return NextResponse.json(
      { error: 'An error occurred during the password reset process' },
      { status: 500 }
    );
  }
} 