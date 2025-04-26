import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';

export default function DeleteAccountButton() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      // API'ye istek gönder
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      // Client-side işlem gerekiyor mu?
      if (response.status === 202 && data.shouldUseClientSide) {
        console.log('Client-side hesap silme işlemi yapılıyor');
        
        // Kullanıcı oturum açmış mı?
        if (!auth.currentUser) {
          setError('Güvenlik nedeniyle tekrar giriş yapmanız gerekiyor');
          setLoading(false);
          return;
        }
        
        try {
          // Kullanıcı verileri Firestore'dan siliniyor
          try {
            const userDoc = doc(db, 'users', data.userId);
            await deleteDoc(userDoc);
            console.log('Kullanıcı verileri Firestore\'dan silindi');
          } catch (firestoreError) {
            console.error('Firestore veri silme hatası:', firestoreError);
            // Veri silme başarısız olsa bile devam et
          }
          
          // Firebase Auth'dan kullanıcıyı sil
          await deleteUser(auth.currentUser);
          console.log('Kullanıcı Firebase Auth\'dan silindi');
          
          // Oturumu kapat ve login sayfasına yönlendir
          await logout();
          
        } catch (authError: any) {
          console.error('Authentication hesap silme hatası:', authError);
          
          if (authError.code === 'auth/requires-recent-login') {
            setError('Güvenlik nedeniyle tekrar giriş yapmanız gerekiyor');
          } else {
            setError('Hesap silme hatası: ' + (authError.message || 'Bilinmeyen hata'));
          }
        }
      } else if (response.ok) {
        // API tarafında başarıyla silindi
        await logout();
      } else {
        setError(data.error || 'Hesap silinemedi');
      }
    } catch (error: any) {
      console.error('Hesap silme hatası:', error);
      setError('İşlem sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <h3 className="text-lg font-medium text-red-600">Hesabı Sil</h3>
      <p className="mt-2 text-sm text-gray-500">
        Hesabınızı silmek tüm verilerinizi kalıcı olarak siler. Bu işlem geri alınamaz.
      </p>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {showConfirmation ? (
        <div className="mt-4 p-4 border border-red-200 rounded-md bg-red-50">
          <p className="font-medium text-red-700 mb-4">
            Bu işlem geri alınamaz. Hesabınız ve tüm verileriniz kalıcı olarak silinecek.
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className={`px-4 py-2 text-white rounded-md ${
                loading 
                  ? 'bg-red-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'İşleniyor...' : 'Hesabımı Sil'}
            </button>
            <button
              onClick={() => setShowConfirmation(false)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirmation(true)}
          className="mt-4 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md"
        >
          Hesabı Sil
        </button>
      )}
    </div>
  );
} 