import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircleIcon } from './icons';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// --- Individual Toast Component ---
const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, 3000); // Auto-dismiss after 3 seconds

        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    const typeClasses = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
    };

    return (
        <div 
          role="alert"
          aria-live="assertive"
          className={`flex items-center text-white p-3 rounded-md shadow-lg mb-2 animate-fade-in max-w-sm ${typeClasses[toast.type]}`}
        >
            {toast.type === 'success' && <CheckCircleIcon className="w-6 h-6 mr-3 flex-shrink-0" />}
            <span className="flex-grow">{toast.message}</span>
            <button onClick={() => onDismiss(toast.id)} className="ml-4 p-1 rounded-full hover:bg-black/20 flex-shrink-0" aria-label="Dismiss">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
    );
};

// --- Toast Container ---
const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: number) => void }> = ({ toasts, removeToast }) => {
    const portalRoot = document.body;
    return ReactDOM.createPortal(
        <div className="fixed bottom-5 right-5 z-50">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
            ))}
        </div>,
        portalRoot
    );
};

// --- Toast Provider ---
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    const removeToast = useCallback((id: number) => {
        setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
        const id = Date.now();
        setToasts(currentToasts => [...currentToasts, { id, message, type }]);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

// --- useToast Hook ---
export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
