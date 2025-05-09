import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth-firebase';
import { generateToken } from '@/lib/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
      // User login
      console.log('Logging in user:', email);
      const userCredential = await loginUser(email, password);
      
      if (!userCredential) {
        console.log('Login API - User login failed');
        return NextResponse.json({
          success: false,
          message: 'Login failed',
        }, { status: 401 });
      }

      // Get user account status from Firestore
      let accountStatus: 'free' | 'basic' | 'premium' = 'free'; // Default to free
      
      try {
        console.log('Fetching user account status from Firestore');
        // Get user document from Firestore
        const userDocRef = doc(db, 'users', userCredential.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Check if user has a valid subscription status
          if (userData.accountStatus && 
             (userData.accountStatus === 'basic' || 
              userData.accountStatus === 'premium')) {
            accountStatus = userData.accountStatus;
            console.log(`User has a valid subscription: ${accountStatus}`);
          } else {
            console.log('User has no subscription or invalid subscription type');
          }
        } else {
          console.log('User document not found in Firestore');
        }
      } catch (firestoreError) {
        console.error('Error fetching user subscription status:', firestoreError);
        // Continue with default free status
      }
      
      // Create user data object
      const userData = {
        uid: userCredential.uid,
        email: userCredential.email,
        name: userCredential.displayName || email,
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
        name: 'auth-token',
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
      console.error('Firebase login error:', loginError);
      const errorMessage = loginError.message || 'Login failed';
      const statusCode = loginError.code?.includes('auth/') ? 401 : 500;
      
      console.log(`Login API - Firebase error: ${errorMessage}, code: ${statusCode}`);
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error: any) {
    console.error('General login error:', error);
    
    // Evaluate Firebase auth errors
    let errorMessage = 'Login operation failed';
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMessage = 'Email or password is incorrect';
      statusCode = 401;
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed login attempts. Please try again later';
      statusCode = 429;
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled';
      statusCode = 403;
    }
    
    console.log(`Login API - General error: ${errorMessage}, code: ${statusCode}`);
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: statusCode });
  }
} 