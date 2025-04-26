import { NextRequest, NextResponse } from 'next/server';
import { sendResetPasswordEmail } from '@/lib/auth-firebase';

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
      // Send Firebase password reset email
      await sendResetPasswordEmail(body.email);
      
      // Successful response
      return NextResponse.json({ 
        success: true,
        message: 'Password reset link has been sent to your email address'
      });
    } catch (resetError: any) {
      console.error('Password reset error:', resetError);
      
      // Always return successful response for user experience
      // This prevents leaking whether the email address exists
      return NextResponse.json({ 
        success: true,
        message: 'If this email address is registered in our system, a password reset link will be sent'
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