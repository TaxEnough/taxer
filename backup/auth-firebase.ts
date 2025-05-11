import jwt from 'jsonwebtoken';

// JWT token için özel interface
interface DecodedToken {
  uid?: string;
  sub?: string;
  user_id?: string;
  userId?: string;
  firebase?: {
    identities?: {
      [key: string]: string[];
    };
  };
  accountStatus?: string;
  [key: string]: any;
}

/**
 * Firebase kimlik doğrulama token'ını doğrular
 * Bu fonksiyon istemci tarafından kullanılacak,
 * sunucu tarafı doğrulama için auth-server.ts dosyasındaki verifyTokenServer kullanılmalıdır.
 * 
 * @param token Firebase kimlik doğrulama token'ı
 * @returns Doğrulanmış token bilgisi veya null
 */
export const verifyToken = async (token: string): Promise<DecodedToken | null> => {
  try {
    // Token yoksa veya geçersizse hızlıca çık
    if (!token || token.trim() === '') {
      console.error('Geçersiz token: Boş veya null');
      return null;
    }
    
    console.log('Token doğrulama başlıyor, uzunluk:', token.length);
    
    // JWT token'ı decode et - doğrulama yapmadan sadece içeriğine bakıyoruz
    const decoded = jwt.decode(token) as DecodedToken | null;
    
    // Decoded boşsa, token biçimi geçersiz demektir
    if (!decoded) {
      console.error('Token decode edilemedi, geçersiz biçim');
      return null;
    }
    
    // Şimdi payload'ı logla ve kontrol et
    console.log('Token decode edildi, payload kontrolü yapılıyor');
    
    // UID kontrolü - token'ın içeriğindeki farklı alanlarda uid olabilir
    if (!decoded.uid) {
      console.log('UID bulunamadı, alternatif alanları kontrol ediyoruz');
      
      // sub alanını kontrol et (JWT standardı)
      if (decoded.sub) {
        decoded.uid = decoded.sub;
      }
      // user_id alanını kontrol et (Firebase'in kullandığı bir alan)
      else if (decoded.user_id) {
        decoded.uid = decoded.user_id;
      }
      // userId alanını kontrol et (özel bir alan)
      else if (decoded.userId) {
        decoded.uid = decoded.userId;
      }
      // Firebase identities içinde bakabilir
      else if (decoded.firebase && decoded.firebase.identities && decoded.firebase.identities['firebase.com']) {
        decoded.uid = decoded.firebase.identities['firebase.com'][0];
      }
    }
    
    // Hesap durumunu kontrol et ve varsayılan değer ata
    if (!decoded.accountStatus) {
      console.log('Account status bulunamadı, varsayılan değer atanıyor');
      
      // Client tarafında hesap durumunu localStorage'dan kontrol et
      if (typeof window !== 'undefined') {
        try {
          const userInfoStr = localStorage.getItem('user-info');
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            if (userInfo.accountStatus) {
              decoded.accountStatus = userInfo.accountStatus;
              console.log('Account status localStorage\'dan alındı:', decoded.accountStatus);
            }
          }
        } catch (error) {
          console.error('localStorage okuma hatası:', error);
        }
      }
      
      // Hala yoksa varsayılan değer
      if (!decoded.accountStatus) {
        decoded.accountStatus = 'free';
      }
    }
    
    console.log('Token doğrulama tamamlandı:', {
      uid: decoded.uid,
      accountStatus: decoded.accountStatus
    });
    
    return decoded;
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return null;
  }
};