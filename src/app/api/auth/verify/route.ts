import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieFromRequest, verifyTokenServer } from '@/lib/auth-server';

// GET method for token verification (used by client-side)
export async function GET(request: NextRequest) {
  try {
    // Get token from either Authorization header or cookies
    const authHeader = request.headers.get('Authorization');
    let token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = await getAuthCookieFromRequest(request) || '';
    }
    
    if (!token) {
      console.log('GET /api/auth/verify - No token found');
      return NextResponse.json({ 
        success: false, 
        message: 'Authentication token not found' 
      }, { status: 401 });
    }
    
    console.log('GET /api/auth/verify - Verifying token');
    
    // Verify token with Firebase Admin SDK or fallback to JWT
    const decodedToken = await verifyTokenServer(token);
    
    if (!decodedToken) {
      console.log('GET /api/auth/verify - Invalid token');
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid or expired token' 
      }, { status: 401 });
    }
    
    console.log('GET /api/auth/verify - Token verified successfully');
    
    // Return user information in a consistent format
    return NextResponse.json({ 
      success: true, 
      user: {
        id: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || decodedToken.email?.split('@')[0] || '',
        accountStatus: decodedToken.accountStatus || 'free',
      }
    });
  } catch (error: any) {
    console.error('GET /api/auth/verify - Error:', error?.message || error);
    
    // Better error handling with descriptive messages
    const errorMessage = error?.code === 'auth/id-token-expired' 
      ? 'Authentication token has expired' 
      : 'Authentication verification failed';
    
    return NextResponse.json({ 
      success: false, 
      message: errorMessage,
      error: error?.message
    }, { status: 500 });
  }
}

// POST method (for backward compatibility)
export async function POST(request: NextRequest) {
  try {
    // Extract token from request body, header, or cookie
    let token = '';
    
    try {
      const body = await request.json();
      if (body && body.token) {
        token = body.token;
      }
    } catch (e) {
      // If JSON parsing fails, try other methods
    }
    
    // Try Authorization header if body doesn't have token
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // Finally, try cookie
    if (!token) {
      token = await getAuthCookieFromRequest(request) || '';
    }
    
    if (!token) {
      console.log('POST /api/auth/verify - No token found');
      return NextResponse.json({ 
        success: false, 
        message: 'Authentication token not found' 
      }, { status: 401 });
    }
    
    console.log('POST /api/auth/verify - Verifying token');
    
    // Server-side verification with Firebase Admin SDK or fallback to JWT
    const decodedToken = await verifyTokenServer(token);
    
    if (!decodedToken) {
      console.log('POST /api/auth/verify - Invalid token');
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid or expired token' 
      }, { status: 401 });
    }
    
    console.log('POST /api/auth/verify - Token verified successfully');
    
    // Return user information in a consistent format
    return NextResponse.json({ 
      success: true, 
      user: {
        id: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || decodedToken.email?.split('@')[0] || '',
        accountStatus: decodedToken.accountStatus || 'free',
      }
    });
  } catch (error: any) {
    console.error('POST /api/auth/verify - Error:', error?.message || error);
    
    // Better error handling with descriptive messages
    const errorMessage = error?.code === 'auth/id-token-expired' 
      ? 'Authentication token has expired' 
      : 'Authentication verification failed';
    
    return NextResponse.json({ 
      success: false, 
      message: errorMessage,
      error: error?.message
    }, { status: 500 });
  }
} 