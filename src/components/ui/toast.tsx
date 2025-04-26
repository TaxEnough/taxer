import * as React from "react";
import { cn } from "@/lib/utils";
import { ToastProps, ToastContext } from "./use-toast";

export function Toast({
  title,
  description,
  variant = "default",
  children,
  className,
  ...props
}: ToastProps & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-md rounded-lg p-4 shadow-lg",
        variant === "default" 
          ? "bg-white border-gray-200 text-gray-900 border" 
          : "bg-red-50 border-red-200 text-red-900 border",
        className
      )}
      {...props}
    >
      {children ? (
        children
      ) : (
        <>
          {title && <h3 className="font-medium">{title}</h3>}
          {description && <p className="text-sm mt-1">{description}</p>}
        </>
      )}
    </div>
  );
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const toast = React.useCallback((props: ToastProps) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...props, id };
    
    setToasts((prev) => [...prev, newToast]);
    
    // 3 saniye sonra toast'ı kaldır
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => (t as any).id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 p-4 flex flex-col gap-2">
        {toasts.map((t, i) => (
          <Toast key={i} {...t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
} 