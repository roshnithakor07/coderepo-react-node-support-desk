import { useEffect, useState } from "react";

// A tall column may only be pinned (position: sticky) while all of it fits in the visible area of its
// scroll container. Pinned and taller than the screen, its lower part would be unreachable; unpinned,
// it just scrolls with the page. Re-measured whenever either the column or the container changes size.
export function useFitsInView(columnRef, scrollSelector, reservedHeight) {
    const [fits, setFits] = useState(false);

    useEffect(() => {
        const column = columnRef.current;
        const scroller = column?.closest(scrollSelector);
        if (!column || !scroller) return undefined;
        const measure = () => setFits(column.offsetHeight <= scroller.clientHeight - reservedHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(column);
        observer.observe(scroller);
        return () => observer.disconnect();
    }, [columnRef, scrollSelector, reservedHeight]);

    return fits;
}
