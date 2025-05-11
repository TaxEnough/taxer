import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';

// Define the tax summary interface
interface TaxSummary {
  year: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  longTermGains: number;
  shortTermGains: number;
  estimatedTax: number;
  transactions: number;
  lastUpdated: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
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
    
    // Check premium status from token and cookies
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Try to get premium status from cookie if not in token
    if ((accountStatus === 'free' || !accountStatus) && premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData.accountStatus && 
            (premiumData.accountStatus === 'basic' || 
            premiumData.accountStatus === 'premium')) {
          accountStatus = premiumData.accountStatus;
        }
      } catch (e) {
        console.error('Failed to parse premium cookie:', e);
      }
    }
    
    // Check subscription status
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
    
    try {
      // Verify user with Clerk
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Generate dummy tax summary data
      // In a real app, fetch this from your database
      const taxSummary: TaxSummary = {
        year,
        totalProfit: 15250.75,
        totalLoss: 3750.25,
        netProfit: 11500.50,
        longTermGains: 8200.00,
        shortTermGains: 3300.50,
        estimatedTax: 1725.08,
        transactions: 24,
        lastUpdated: new Date().toISOString()
      };
      
      return NextResponse.json(taxSummary);
    } catch (apiError) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: 'An error occurred while retrieving tax summary' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting tax summary:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving tax summary' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
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
    
    // Check premium status from token and cookies
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Try to get premium status from cookie if not in token
    if ((accountStatus === 'free' || !accountStatus) && premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData.accountStatus && 
            (premiumData.accountStatus === 'basic' || 
            premiumData.accountStatus === 'premium')) {
          accountStatus = premiumData.accountStatus;
        }
      } catch (e) {
        console.error('Failed to parse premium cookie:', e);
      }
    }
    
    // Check subscription status
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    
    // Get request body
    const { year } = await request.json();
    
    if (!year || isNaN(parseInt(year))) {
      return NextResponse.json({ error: 'Valid year is required' }, { status: 400 });
    }
    
    try {
      // Verify user with Clerk
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Dummy tax calculation - In a real app, calculate this based on transactions
      const taxSummary: TaxSummary = {
        year: parseInt(year),
        totalProfit: 15250.75,
        totalLoss: 3750.25,
        netProfit: 11500.50,
        longTermGains: 8200.00,
        shortTermGains: 3300.50,
        estimatedTax: 1725.08,
        transactions: 24,
        lastUpdated: new Date().toISOString()
      };
      
      return NextResponse.json({
        message: 'Tax summary successfully calculated',
        data: taxSummary
      });
    } catch (apiError) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: 'An error occurred while calculating tax summary' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error calculating tax summary:', error);
    return NextResponse.json(
      { error: 'An error occurred while calculating tax summary' },
      { status: 500 }
    );
  }
} 