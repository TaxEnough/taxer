import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';

// User profile interface
interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  accountStatus?: 'free' | 'basic' | 'premium';
  createdAt?: string;
  updatedAt?: string;
}

// API rotasını dinamik olarak işaretliyoruz
export const dynamic = 'force-dynamic';

// GET user profile endpoint
export async function GET(request: NextRequest) {
  try {
    // Get and validate token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    
    try {
      // Get user from Clerk API
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Check subscription status from metadata
      let accountStatus: 'free' | 'basic' | 'premium' = 'free';
      const subscription = (user.privateMetadata as any)?.subscription || (user.publicMetadata as any)?.subscription;
      
      if (subscription && subscription.status === 'active') {
        accountStatus = (subscription.plan as 'basic' | 'premium') || 'premium';
      }
      
      // Create user profile response
      const userProfile: UserProfile = {
        id: userId,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
        email: user.emailAddresses[0]?.emailAddress,
        accountStatus,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return NextResponse.json(userProfile);
    } catch (apiError) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: 'An error occurred while retrieving user profile' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving user profile' },
      { status: 500 }
    );
  }
}

// Update user profile endpoint
export async function PUT(request: NextRequest) {
  try {
    // Get and validate token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    
    // Get request body
    const { name } = await request.json();
    
    try {
      // Get user from Clerk API
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Update user profile with Clerk API
      // Parse first and last name
      let firstName = name;
      let lastName = '';
      
      if (name && name.includes(' ')) {
        const nameParts = name.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      }
      
      await clerk.users.updateUser(userId, {
        firstName,
        lastName
      });
      
      // Create updated user profile response
      const userProfile: UserProfile = {
        id: userId,
        name,
        email: user.emailAddresses[0]?.emailAddress,
        accountStatus: ((user.privateMetadata as any)?.subscription?.status === 'active') ? 
                       (user.privateMetadata as any)?.subscription?.plan || 'premium' : 'free',
        updatedAt: new Date().toISOString()
      };
      
      return NextResponse.json({
        message: 'User profile updated successfully',
        user: userProfile
      });
    } catch (apiError) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: 'An error occurred while updating user profile' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating user profile' },
      { status: 500 }
    );
  }
} 