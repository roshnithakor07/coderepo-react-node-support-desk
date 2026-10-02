import { useEffect, useState } from "react";

export const LOADER_DELAY_MS = 200;

// True only once `flag` has stayed true for `delayMs`, so fast responses never flash a loader.
export function useDelayedFlag(flag, delayMs = LOADER_DELAY_MS) {
    const [isDelayed, setIsDelayed] = useState(false);

    useEffect(() => {
        if (!flag) {
            setIsDelayed(false);
            return undefined;
        }
        const timer = setTimeout(() => setIsDelayed(true), delayMs);
        return () => clearTimeout(timer);
    }, [flag, delayMs]);

    return flag && isDelayed;
}
