'use client';

import React from 'react';
import PremiumGuard from '@/components/PremiumGuard';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <PremiumGuard featureName="dashboard">
      {children}
    </PremiumGuard>
  );
} 