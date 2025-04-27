import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { headers } from 'next/headers';
import * as fs from 'fs';
import * as path from 'path';

// Admin e-posta listesi
const ADMIN_EMAILS = ['info.taxenough@gmail.com'];

// Geçici olarak blog verilerini depolamak için yerel dosya
const LOCAL_BLOG_FILE = path.join(process.cwd(), 'local-blogs.json');

// Yerel blog verilerini oku
const readLocalBlogs = () => {
  try {
    if (fs.existsSync(LOCAL_BLOG_FILE)) {
      const data = fs.readFileSync(LOCAL_BLOG_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Yerel blog verileri okunamadı:', error);
    return [];
  }
};

// Yerel blog verilerini yaz
const writeLocalBlogs = (blogs: any[]) => {
  try {
    fs.writeFileSync(LOCAL_BLOG_FILE, JSON.stringify(blogs, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Yerel blog verileri yazılamadı:', error);
    return false;
  }
};

// POST - Yeni blog yazısı eklemek için API
export async function POST(request: NextRequest) {
  console.log('Blog yazısı ekleme API çağrıldı');
  
  try {
    // Token'ı header'dan veya cookie'den al
    const cookieHeader = request.cookies.get('auth-token')?.value;
    const authHeader = headers().get('authorization');
    
    console.log('Cookie token:', cookieHeader ? 'var' : 'yok');
    console.log('Auth header:', authHeader ? 'var' : 'yok');
    
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : cookieHeader;
    
    if (!token) {
      console.log('Token bulunamadı, yetkilendirme gerekli hatası döndürülüyor');
      return NextResponse.json({ error: 'Kimlik doğrulama gerekli' }, { status: 401 });
    }
    
    // Token'ı doğrula
    console.log('Token doğrulanıyor...');
    const decodedToken = await verifyToken(token);
    
    if (!decodedToken) {
      console.log('Token geçerli değil, null değer döndü');
      return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
    }
    
    console.log('Token doğrulandı, email:', decodedToken.email || 'Email bilgisi yok');
    
    if (!decodedToken.email) {
      console.log('Token geçerli ancak email bilgisi yok');
      return NextResponse.json({ error: 'Geçersiz token: Email bilgisi yok' }, { status: 401 });
    }
    
    // Admin kontrolü
    const isAdmin = decodedToken.email && ADMIN_EMAILS.includes(decodedToken.email);
    console.log('Admin e-posta kontrolü:', decodedToken.email, isAdmin ? 'ADMIN' : 'ADMIN DEĞİL');
    
    if (!isAdmin) {
      console.log('Admin yetkisi reddedildi:', decodedToken.email);
      return NextResponse.json({ error: 'Admin yetkisi yok', isAdmin: false }, { status: 403 });
    }
    
    // İstek gövdesinden blog verilerini al
    const blogData = await request.json();
    console.log('Blog verisi alındı:', {...blogData, content: blogData.content.substring(0, 50) + '...'});
    
    // Yerel slug kontrolü
    const localBlogs = readLocalBlogs();
    const slugExists = localBlogs.some((blog: any) => blog.slug === blogData.slug);
    
    if (slugExists) {
      console.error('Slug zaten kullanımda:', blogData.slug);
      return NextResponse.json(
        { error: 'Bu URL (slug) zaten kullanılıyor. Lütfen başka bir URL seçin.' }, 
        { status: 400 }
      );
    }
    
    // Firebase'e yazmayı dene, hata alırsa yerel depolama kullan
    try {
      console.log('Slug kontrolü yapılıyor:', blogData.slug);
      const slugCheck = query(
        collection(db, 'blogPosts'),
        where('slug', '==', blogData.slug)
      );
      
      try {
        const slugSnapshot = await getDocs(slugCheck);
        
        if (!slugSnapshot.empty) {
          console.error('Slug zaten kullanımda:', blogData.slug);
          return NextResponse.json(
            { error: 'Bu URL (slug) zaten kullanılıyor. Lütfen başka bir URL seçin.' }, 
            { status: 400 }
          );
        }
      } catch (slugError: any) {
        console.error('Slug kontrolü sırasında hata:', slugError);
        // Firebase slug kontrolünde hata alınca yerel kontrole geçiliyor - zaten yukarıda yapıldı
      }
      
      // Blog yazısını Firestore'a eklemeyi dene
      const docData = {
        ...blogData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      console.log('Blog yazısı Firestore\'a ekleniyor');
      try {
        const docRef = await addDoc(collection(db, 'blogPosts'), docData);
        console.log('Blog yazısı başarıyla eklendi, ID:', docRef.id);
        
        return NextResponse.json({ 
          success: true, 
          id: docRef.id,
          message: 'Blog yazısı başarıyla eklendi'
        });
      } catch (writeError: any) {
        console.error('Firestore yazma hatası, yerel depolama kullanılacak:', writeError);
        throw writeError; // Yerel depolamaya geç
      }
    } catch (firebaseError: any) {
      // Firebase izin hatası durumunda yerel depolama kullan
      console.log('Firebase izin hatası, yerel depolama kullanılıyor');
      
      // Yeni blog için ID ve tarih oluştur
      const newId = 'local_' + Date.now().toString();
      const now = new Date();
      
      const newBlog = {
        id: newId,
        ...blogData,
        createdAt: now,
        updatedAt: now
      };
      
      // Yerel bloglara ekle
      localBlogs.push(newBlog);
      const saveResult = writeLocalBlogs(localBlogs);
      
      if (saveResult) {
        console.log('Blog yazısı yerel olarak eklendi, ID:', newId);
        return NextResponse.json({ 
          success: true, 
          id: newId,
          message: 'Blog yazısı yerel olarak eklendi (Firebase izin hatası nedeniyle)'
        });
      } else {
        return NextResponse.json(
          { error: 'Blog yazısı yerel olarak kaydedilemedi.' }, 
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Blog API hatası:', error);
    return NextResponse.json(
      { error: 'İşlem sırasında bir hata oluştu: ' + error.message }, 
      { status: 500 }
    );
  }
} 