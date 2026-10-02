import { useEffect, useState } from "react";

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

// Phones get a menu drawer, tablets a labeled icon rail, and wider screens the full sidebar.
export function useNavigationMode() {
    const isPhone = useMediaQuery("(max-width: 599px)");
    const isTablet = useMediaQuery("(min-width: 600px) and (max-width: 1024px)");
    if (isPhone) return "drawer";
    if (isTablet) return "rail";
    return "sidebar";
}
