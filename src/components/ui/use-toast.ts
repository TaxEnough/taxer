import * as React from "react";

interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  id?: string;
}

interface ToastContextType {
  toast: (props: ToastProps) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  
  return context;
};

export type { ToastProps, ToastContextType };
export { ToastContext }; 