import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { verifyAuthToken } from '@/lib/auth';

// API rotasını dinamik olarak işaretliyoruz
export const dynamic = 'force-dynamic';

// Vergi özeti arayüzü
interface TaxSummary {
  shortTermGains: number;
  shortTermTax: number;
  longTermGains: number;
  longTermTax: number;
  totalGains: number;
  totalTax: number;
  taxRate: number;
  monthlyData: {
    month: string;
    gains: number;
    taxes: number;
  }[];
  lastCalculated?: any;
}

// Transaction arayüzü
interface Transaction {
  id?: string;
  stock: string;
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  quantity: number;
  profit: number;
  type: string;
  tradingFees?: number;
}

// Vergi verilerini hesaplayan yardımcı fonksiyon
const calculateTaxSummary = (transactions: Transaction[], year: string): TaxSummary => {
  // Sadece belirtilen yıl için işlemleri filtrele
  const yearTransactions = transactions.filter(tx => {
    // Satış tarihi belirtilen yıla ait olmalı
    const sellDate = new Date(tx.sellDate);
    return sellDate.getFullYear().toString() === year;
  });
  
  // Hesaplama değişkenleri
  let shortTermGains = 0;
  let longTermGains = 0;
  let shortTermTax = 0;
  let longTermTax = 0;
  
  // Aylık veri takibi
  const monthlyData = Array(12).fill(0).map((_, index) => ({
    month: new Date(2000, index, 1).toLocaleString('tr-TR', { month: 'long' }),
    gains: 0,
    taxes: 0
  }));
  
  // Her işlem için vergi hesapla
  yearTransactions.forEach(tx => {
    const profit = tx.profit || 0;
    const sellDate = new Date(tx.sellDate);
    const month = sellDate.getMonth();
    
    // Kazanç ayrımı (kısa/uzun vadeli)
    if (tx.type === 'Kısa Vadeli') {
      shortTermGains += profit;
      // Kısa vadeli kazançlar için %25 vergi oranı varsayıyoruz
      const tax = profit > 0 ? profit * 0.25 : 0;
      shortTermTax += tax;
      
      // Aylık veri güncelleme
      monthlyData[month].gains += profit;
      monthlyData[month].taxes += tax;
    } else {
      longTermGains += profit;
      // Uzun vadeli kazançlar için %10 vergi oranı varsayıyoruz
      const tax = profit > 0 ? profit * 0.10 : 0;
      longTermTax += tax;
      
      // Aylık veri güncelleme
      monthlyData[month].gains += profit;
      monthlyData[month].taxes += tax;
    }
  });
  
  // Toplam değerler
  const totalGains = shortTermGains + longTermGains;
  const totalTax = shortTermTax + longTermTax;
  
  // Efektif vergi oranı
  const taxRate = totalGains > 0 ? (totalTax / totalGains) * 100 : 0;
  
  return {
    shortTermGains,
    shortTermTax,
    longTermGains,
    longTermTax,
    totalGains,
    totalTax,
    taxRate,
    monthlyData
  };
};

export async function GET(request: NextRequest) {
  try {
    // Query parametrelerini al
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    
    // Authorization header'dan token'ı al
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Yetkilendirme başarısız' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    
    // 1. Önce cache'den tax summary var mı kontrol et
    const taxSummaryRef = doc(db, 'users', userId, 'taxSummaries', year);
    const taxSummarySnap = await getDoc(taxSummaryRef);
    
    // Eğer güncel vergi özeti varsa, direkt onu dön
    if (taxSummarySnap.exists()) {
      const data = taxSummarySnap.data() as TaxSummary;
      
      // 1 günden eski değilse cache'den dön
      const lastCalculated = data.lastCalculated?.toDate() || new Date(0);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      if (lastCalculated > oneDayAgo) {
        console.log(`Cache'den ${year} yılı vergi verilerini döndürüyorum`);
        return NextResponse.json(data);
      }
    }
    
    // 2. Cache'de yok veya güncel değilse, işlemlerden hesapla
    const transactionsRef = collection(db, 'users', userId, 'transactions');
    const transactionsSnap = await getDocs(transactionsRef);
    
    if (transactionsSnap.empty) {
      // İşlem yoksa varsayılan değerlerle dön
      const emptyTaxSummary: TaxSummary = {
        shortTermGains: 0,
        shortTermTax: 0,
        longTermGains: 0,
        longTermTax: 0,
        totalGains: 0,
        totalTax: 0,
        taxRate: 0,
        monthlyData: Array(12).fill(0).map((_, index) => ({
          month: new Date(2000, index, 1).toLocaleString('tr-TR', { month: 'long' }),
          gains: 0,
          taxes: 0
        }))
      };
      
      return NextResponse.json(emptyTaxSummary);
    }
    
    // İşlemleri diziye dönüştür
    const transactions: Transaction[] = [];
    transactionsSnap.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data() as Transaction
      });
    });
    
    // Vergi özetini hesapla
    const taxSummary = calculateTaxSummary(transactions, year);
    
    // Hesaplanan vergi özetini Firebase'e kaydet (cache'leme)
    await setDoc(taxSummaryRef, {
      ...taxSummary,
      lastCalculated: serverTimestamp()
    });
    
    return NextResponse.json(taxSummary);
  } catch (error) {
    console.error('Vergi özeti alınırken hata:', error);
    return NextResponse.json(
      { error: 'Vergi özeti alınırken bir hata oluştu' },
      { status: 500 }
    );
  }
} 