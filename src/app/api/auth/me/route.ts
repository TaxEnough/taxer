import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { headers } from 'next/headers';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic'; // Prevent static optimization of endpoint

export async function GET(request: NextRequest) {
  console.log('GET /api/auth/me endpoint called');
  
  try {
    // Get HTTP headers
    const headersList = headers();
    const authHeader = headersList.get('authorization');
    console.log('Token obtained from Authorization header');
    
    // Return error if token is missing
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token not found');
      return NextResponse.json({ error: 'Authentication token not found' }, { status: 401 });
    }
    
    // Extract token
    const token = authHeader.substring(7);
    console.log('Token found, verifying');
    
    try {
      // Verify token
      const decodedToken = await verifyAuthToken(token);
      
      // Check user ID
      if (!decodedToken || !decodedToken.uid) {
        console.log('Token valid but user ID not found');
        // Log token structure (redacting sensitive info)
        console.log('Token content:', JSON.stringify({
          ...decodedToken,
          email: decodedToken?.email ? '[REDACTED]' : undefined,
          sub: decodedToken?.sub ? '[EXISTS]' : undefined,
          user_id: decodedToken?.user_id ? '[EXISTS]' : undefined,
          userId: decodedToken?.userId ? '[EXISTS]' : undefined
        }));
        
        return NextResponse.json(
          { error: 'Invalid token: User ID not found' },
          { status: 401 }
        );
      }
      
      console.log('Token verified, user ID:', decodedToken.uid);
      
      // Get user info from Clerk
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(decodedToken.uid);
        
        if (user) {
          console.log('User information retrieved from Clerk');
          
          // Add Cache-Control header (short 10-second cache)
          return NextResponse.json(
            {
              id: decodedToken.uid,
              email: user.emailAddresses[0]?.emailAddress || decodedToken.email,
              name: user.firstName || decodedToken.email?.split('@')[0] || '',
            },
            {
              status: 200,
              headers: {
                'Cache-Control': 'private, max-age=10', // Can be cached on client side for 10 seconds
              },
            }
          );
        } else {
          console.log('User data not found, continuing with token information');
          
          // Use token information if user data not available
          return NextResponse.json(
            {
              id: decodedToken.uid,
              email: decodedToken.email,
              name: decodedToken.email?.split('@')[0] || '',
            },
            {
              status: 200,
              headers: {
                'Cache-Control': 'private, max-age=10', // Can be cached on client side for 10 seconds
              },
            }
          );
        }
      } catch (clerkError: any) {
        console.error('User information error:', clerkError);
        
        // Use token information directly in case of Clerk permission error
        console.log('User data not found, continuing with token information');
        
        // Use token information if user data not available
        return NextResponse.json(
          {
            id: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split('@')[0] || '',
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=10', // Can be cached on client side for 10 seconds
            },
          }
        );
      }
    } catch (tokenError) {
      console.error('Token verification error:', tokenError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  } catch (error) {
    console.error('/api/auth/me endpoint error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 