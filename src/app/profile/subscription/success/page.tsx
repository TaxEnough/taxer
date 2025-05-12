'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { setPremiumCookies } from '@/lib/clerk-utils';

export default function SuccessPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ödeme sonrası süreci başlat
    async function processPayment() {
      try {
        if (!isLoaded || !user) return;

        const searchParams = window.location.search;
        const params = new URLSearchParams(searchParams);
        const sessionId = params.get('session_id');
        
        if (!sessionId) {
          setError('Ödeme bilgisi bulunamadı.');
          setLoading(false);
          return;
        }

        console.log('Ödeme bilgisi doğrulanıyor:', sessionId);
        
        // Ödeme bilgisini doğrula ve aboneliği etkinleştir
        const response = await fetch('/api/subscription/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Ödeme doğrulanamadı');
        }

        const data = await response.json();
        console.log('Ödeme durumu:', data);

        if (data.success) {
          // Kullanıcı meta verilerini güncelle
          console.log('Kullanıcı meta verileri güncelleniyor...');
          
          try {
            // Clerk'in metadata API'sini kullanarak güncelle
            await updateUserMetadata({
              subscriptionStatus: 'active',
              subscriptionPlan: data.plan || 'premium',
              isPremium: true,
              subscriptionPeriodEnd: data.periodEnd,
              stripeCustomerId: data.customerId,
              stripeSubscriptionId: data.subscriptionId,
            });
            
            console.log('Kullanıcı meta verileri güncellendi!');
          } catch (updateError) {
            console.error('Meta veri güncelleme hatası:', updateError);
            setError('Kullanıcı bilgileri güncellenirken bir sorun oluştu.');
            setLoading(false);
            return;
          }
          
          // Premium çerezlerini ayarla
          console.log('Premium çerezleri ayarlanıyor...');
          await setPremiumCookies();
          
          // Son bir API çağrısı ile premium durumunu ve çerezleri senkronize et
          await fetch('/api/subscription/check-premium', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          // Başarılı ödeme sonrası premium içeriğe yönlendir
          setLoading(false);
          router.push('/transactions');
          return;
        } else {
          setError('Ödeme doğrulanamadı veya abonelik etkinleştirilemedi.');
        }
      } catch (err) {
        console.error('Ödeme işleme hatası:', err);
        setError('Ödeme işlenirken bir sorun oluştu. Lütfen destek ekibiyle iletişime geçin.');
      }

      setLoading(false);
    }

    processPayment();
  }, [isLoaded, user, router]);

  // Clerk kullanıcı meta verilerini güncellemek için yardımcı fonksiyon
  async function updateUserMetadata(metadata: any) {
    if (!user) return;
    
    // API çağrısı ile kullanıcı meta verilerini güncelle
    const response = await fetch('/api/subscription/update-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        metadata
      }),
    });
    
    if (!response.ok) {
      throw new Error('Kullanıcı meta verileri güncellenemedi');
    }
    
    return response.json();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      {loading ? (
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold mb-2">Ödemeniz İşleniyor</h2>
          <p className="text-gray-600">Lütfen bekleyin, ödemeniz doğrulanıyor...</p>
        </div>
      ) : error ? (
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-2">Bir sorun oluştu</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/pricing')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Fiyatlandırma Sayfasına Dön
          </button>
        </div>
      ) : (
        <div className="text-center max-w-md">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-semibold mb-2">Ödemeniz Tamamlandı!</h2>
          <p className="text-gray-600 mb-4">
            Teşekkürler! Premium aboneliğiniz aktifleştirildi. Premium içeriğe erişiminiz sağlandı.
          </p>
          <button
            onClick={() => router.push('/transactions')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            İşlemlerim Sayfasına Git
          </button>
        </div>
      )}
    </div>
  );
} 