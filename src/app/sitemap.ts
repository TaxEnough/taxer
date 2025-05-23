import { MetadataRoute } from 'next';
import { getAllBlogPosts } from '@/lib/blog-firebase';

// Geçerli değişim sıklığı türleri
type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

// Ana sitemap fonksiyonu
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Ana sayfaları tanımla
  const staticPages = [
    {
      url: 'https://taxenough.com',
      lastModified: new Date(),
      changeFrequency: 'monthly' as ChangeFrequency,
      priority: 1.0,
    },
    {
      url: 'https://taxenough.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly' as ChangeFrequency,
      priority: 0.9,
    },
    {
      url: 'https://taxenough.com/transactions',
      lastModified: new Date(),
      changeFrequency: 'monthly' as ChangeFrequency,
      priority: 0.8,
    },
    {
      url: 'https://taxenough.com/calculator',
      lastModified: new Date(),
      changeFrequency: 'monthly' as ChangeFrequency,
      priority: 0.8,
    },
  ];

  try {
    // Blog yazılarını getir
    const blogPosts = await getAllBlogPosts();

    // Blog yazıları için sitemap oluştur
    const blogSitemapEntries = blogPosts.map((post) => {
      // Firebase timestamp'i Date'e dönüştür
      let lastModified;
      if (post.updatedAt) {
        if (typeof post.updatedAt === 'object' && 'toDate' in post.updatedAt) {
          lastModified = post.updatedAt.toDate();
        } else if (post.updatedAt instanceof Date) {
          lastModified = post.updatedAt;
        } else {
          lastModified = new Date(post.updatedAt);
        }
      } else {
        lastModified = new Date();
      }

      return {
        url: `https://taxenough.com/blog/${post.slug}`,
        lastModified,
        changeFrequency: 'monthly' as ChangeFrequency,
        priority: 0.7,
      };
    });

    // Tüm sayfaları birleştir
    return [...staticPages, ...blogSitemapEntries];
  } catch (error) {
    console.error('Sitemap oluşturulurken hata:', error);
    return staticPages; // Hata durumunda en azından statik sayfaları göster
  }
} 