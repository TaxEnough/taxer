import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, setDoc, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { verifyToken } from '@/lib/auth-firebase';

// API rotasını dinamik olarak işaretliyoruz
export const dynamic = 'force-dynamic';

// Kullanıcı profili için GET endpoint'i
export async function GET(request: NextRequest) {
  try {
    // Authorization header'dan token'ı al
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization failed' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decodedToken = await verifyToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    
    // Kullanıcı profilini getir
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    
    // Kullanıcı verisini döndür (hassas bilgileri hariç tutarak)
    return NextResponse.json({
      id: userId,
      email: userData.email,
      name: userData.name || '',
      createdAt: userData.createdAt?.toDate() || null,
      updatedAt: userData.updatedAt?.toDate() || null,
      // Burada profile_image, preferences gibi diğer alanlar da eklenebilir
    });
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving the user profile' },
      { status: 500 }
    );
  }
}

// Kullanıcı profili güncelleme için PUT endpoint'i
export async function PUT(request: NextRequest) {
  try {
    // İstek gövdesini al
    const requestData = await request.json();
    
    // Authorization header'dan token'ı al
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization failed' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decodedToken = await verifyToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    
    // Güncellenecek alanları doğrula ve hazırla
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    // İstek verilerinden güncellenecek alanları ekle
    if (requestData.name !== undefined) {
      updateData.name = requestData.name;
    }
    
    // Email güncelleme işlemi burada yapılmaz, Firebase Authentication üzerinden yapılmalıdır
    // Burada kullanıcı tercihleri, profil resmi vb. diğer alanlar güncellenebilir
    
    // Kullanıcı dokümanını güncelle
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, updateData);
    
    // Güncellenen profili döndür
    const updatedUserDoc = await getDoc(userDocRef);
    const userData = updatedUserDoc.data();
    
    return NextResponse.json({
      id: userId,
      email: userData?.email,
      name: userData?.name || '',
      createdAt: userData?.createdAt?.toDate() || null,
      updatedAt: new Date(), // yeni güncelleme zamanı
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating the user profile' },
      { status: 500 }
    );
  }
} 