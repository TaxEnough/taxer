import { NextRequest, NextResponse } from "next/server";
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { verifyToken } from '@/lib/auth-firebase';

export async function POST(request: NextRequest) {
  try {
    // Authorization header'dan token'ı al
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Yetkilendirme başarısız' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decodedToken = await verifyToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
    }
    
    // Kullanıcının abonelik durumunu kontrol et
    if (!decodedToken.accountStatus || decodedToken.accountStatus === 'free') {
      return NextResponse.json({ error: 'Bu işlem için premium abonelik gereklidir' }, { status: 403 });
    }
    
    const userId = decodedToken.uid;
    
    // İstek gövdesini al
    const { transactions } = await request.json();
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "Geçerli işlem verileri bulunamadı" },
        { status: 400 }
      );
    }
    
    // Başarıyla eklenen işlem sayısı
    let successCount = 0;
    
    // Her bir işlemi tek tek ekle (Firestore batch işlemleri sınırlı olduğu için)
    for (const transaction of transactions) {
      try {
        // İşlemi standardize et
        const newTransaction = {
          stock: transaction.ticker?.toUpperCase() || '',
          buyDate: transaction.date || new Date().toISOString().split('T')[0],
          buyPrice: parseFloat(transaction.price) || 0,
          sellDate: transaction.date || new Date().toISOString().split('T')[0],
          sellPrice: parseFloat(transaction.price) || 0,
          quantity: parseFloat(transaction.shares) || 0,
          type: transaction.type?.toLowerCase() === 'sell' ? 'Satış' : 'Alış',
          tradingFees: parseFloat(transaction.fee) || 0,
          note: transaction.notes || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        // Firestore koleksiyonuna ekle
        const transactionsRef = collection(db, 'users', userId, 'transactions');
        await addDoc(transactionsRef, newTransaction);
        successCount++;
      } catch (err) {
        console.error('İşlem eklenirken hata:', err);
        // Hata olsa bile diğer işlemleri eklemeye devam et
      }
    }
    
    return NextResponse.json({ 
      message: "İşlemler başarıyla kaydedildi", 
      count: successCount 
    }, { status: 201 });
    
  } catch (error) {
    console.error("İşlem kaydetme hatası:", error);
    return NextResponse.json(
      { error: "İşlemler kaydedilirken bir sorun oluştu" },
      { status: 500 }
    );
  }
} 