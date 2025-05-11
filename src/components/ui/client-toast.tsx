'use client';

import { useToast } from '@/components/ui/use-toast';
import { ToastProvider } from '@/components/ui/toast';
import React, { ReactNode, createContext, useContext } from 'react';

// Toast'u başlatabilmek için istemci tarafından kullanılacak bağlam
const ClientToastContext = createContext({
  toast: (props: any) => {}
});

// Toast hook'unu kolayca erişilebilir hale getiren bağlam sağlayıcı
export function ClientToastProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  return (
    <ClientToastContext.Provider value={{ toast }}>
      {children}
    </ClientToastContext.Provider>
  );
}

// Client tarafında toast fonksiyonunu kullanmak için güvenli hook
export function useClientToast() {
  const context = useContext(ClientToastContext);
  if (context === undefined) {
    return {
      toast: () => {
        console.warn('useClientToast, ToastProvider içinde kullanılmıyor. Toast gösterilmeyecek.');
      }
    };
  }
  return context;
}

// ToastProvider'ı içeren ve children'ı saran komponent
export default function ClientToastWrapper({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ClientToastProvider>
        {children}
      </ClientToastProvider>
    </ToastProvider>
  );
} 