import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, setDoc, doc, Timestamp, DocumentData } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    console.log('Manual Test API: Tüm blogları getiriyorum...');
    
    // Direkt olarak blogPosts koleksiyonundan tüm belgeleri al
    const querySnapshot = await getDocs(collection(db, 'blogPosts'));
    
    const allPosts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      docExists: true
    }));
    
    console.log(`Manual Test API: ${allPosts.length} blog yazısı bulundu`);
    
    // İlk blogu güncelle
    if (allPosts.length > 0) {
      const firstPostId = allPosts[0].id;
      console.log(`Manual Test API: İlk blog (${firstPostId}) güncelleniyor...`);
      
      try {
        const docRef = doc(db, 'blogPosts', firstPostId);
        await setDoc(docRef, {
          ...allPosts[0],
          isPublished: true,
          updatedAt: Timestamp.now()
        }, { merge: true });
        
        console.log('Manual Test API: Blog yazısı güncellendi!');
      } catch (error) {
        console.error('Blog güncellenirken hata:', error);
      }
    } else {
      console.log('Manual Test API: Güncellenecek blog yazısı bulunamadı');
    }
    
    return NextResponse.json({
      totalPosts: allPosts.length,
      posts: allPosts.map((post: any) => ({
        id: post.id,
        title: post.title || 'Başlık yok',
        isPublished: post.isPublished !== undefined ? post.isPublished : 'undefined',
        createdAt: post.createdAt ? 'exists' : 'missing',
        slug: post.slug || 'Slug yok'
      }))
    });
  } catch (error) {
    console.error('Manual Test API hatası:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
} 