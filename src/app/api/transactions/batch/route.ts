import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';

interface Transaction {
  ticker: string;
  type: 'buy' | 'sell' | 'dividend';
  shares: number;
  price: number;
  amount: number;
  date: string;
  fee?: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authorization header'dan token'ı al
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Premium durumunu kontrol et
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Cookie'den premium durumunu almaya çalış
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
    
    // Kullanıcının abonelik durumunu kontrol et
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json({ error: 'Premium subscription required for this operation' }, { status: 403 });
    }
    
    const userId = decodedToken.uid;
    
    // İstek gövdesini al
    const { transactions } = await request.json();
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "No valid transaction data found" },
        { status: 400 }
      );
    }
    
    // Kullanıcı doğrulaması Clerk ile
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Başarı yanıtı - dummy veri olmadan
      return NextResponse.json({
        success: true,
        message: 'Transactions processed',
        count: 0
      });
    } catch (userError) {
      console.error('User verification error:', userError);
      return NextResponse.json({ error: 'Error verifying user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Batch transaction processing error:', error);
    return NextResponse.json({ error: 'Error processing transactions' }, { status: 500 });
  }
} 