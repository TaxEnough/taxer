import { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Blog | Tax Enough - Tax and Investment Tools',
  description: 'Latest articles, guides and news about taxes, investments, and financial planning for US investors.',
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </>
  );
} 