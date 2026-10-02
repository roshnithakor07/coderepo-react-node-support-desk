import { useEffect, useState } from "react";

// Same breakpoint as the drawer rules in styles.css.
export const DRAWER_NAV_QUERY = "(max-width: 999px)";

export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const list = window.matchMedia(query);
        const update = () => setMatches(list.matches);
        update();
        list.addEventListener("change", update);
        return () => list.removeEventListener("change", update);
    }, [query]);

    return matches;
}
