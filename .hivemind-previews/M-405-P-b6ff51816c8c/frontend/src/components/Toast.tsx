import { createContext, ReactNode, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface ToastState {
  id: number;
  message: string;
  type: "success" | "error";
}

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToast({ id, message, type });
    window.setTimeout(() => {
      setToast((current) => (current && current.id === id ? null : current));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-lg text-sm border backdrop-blur bg-white/90 dark:bg-slate-900/90 ${
              toast.type === "success"
                ? "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                : "border-red-200 text-red-700 dark:border-red-800 dark:text-red-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
