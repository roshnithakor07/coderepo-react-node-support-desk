import { useEffect, useRef } from "react";
import { AlertCircleIcon, CheckCircleIcon, CloseIcon, InfoIcon } from "./Icon.jsx";

const ICONS = {
    success: CheckCircleIcon,
    error: AlertCircleIcon,
    info: InfoIcon,
};

export function ToastStack({ toasts, onDismiss }) {
    if (toasts.length === 0) return null;
    return (
        <div className="toast-stack">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }) {
    const timerRef = useRef(null);

    useEffect(() => {
        // Intentionally keyed on toast.id only: this toast is dismissed and unmounted by id,
        // so the auto-dismiss timer should not reset if onDismiss's identity changes.
        timerRef.current = setTimeout(() => onDismiss(toast.id), toast.duration || 5000);
        return () => clearTimeout(timerRef.current);
    }, [toast.id]);

    const Icon = ICONS[toast.type] || InfoIcon;

    return (
        <div
            className={`toast toast-${toast.type}`}
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            onMouseEnter={() => clearTimeout(timerRef.current)}
            onMouseLeave={() => {
                timerRef.current = setTimeout(() => onDismiss(toast.id), 2000);
            }}
        >
            <Icon className="toast-icon" />
            <p className="toast-message">{toast.message}</p>
            <button type="button" className="toast-dismiss" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
                <CloseIcon />
            </button>
        </div>
    );
}
