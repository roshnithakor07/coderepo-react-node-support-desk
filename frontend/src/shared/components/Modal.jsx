import { useEffect, useRef } from "react";

export function Modal({ children, className = "", label = "Dialog", labelledBy, onClose }) {
    const reference = useRef(null);

    useEffect(() => {
        const dialog = reference.current;
        dialog.showModal();
        const cancel = (event) => {
            event.preventDefault();
            onClose();
        };
        dialog.addEventListener("cancel", cancel);
        return () => dialog.removeEventListener("cancel", cancel);
    }, [onClose]);

    return (
        <dialog aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} ref={reference} className={`modal ${className}`}>
            {children}
        </dialog>
    );
}
