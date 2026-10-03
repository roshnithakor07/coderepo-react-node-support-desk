import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./Icon.jsx";

const DEBOUNCE_MS = 300;

// A search box that types freely and only asks the server once typing pauses, so a word is one
// request instead of one per keystroke. The clear button empties it immediately.
export function SearchField({ value, onChange, label, placeholder, id }) {
    const [draft, setDraft] = useState(value);
    const inputRef = useRef(null);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    });

    // Follow the committed value when it changes elsewhere (Clear filters, a new page, a reset).
    useEffect(() => {
        setDraft(value);
    }, [value]);

    useEffect(() => {
        if (draft === value) return undefined;
        const timer = setTimeout(() => onChangeRef.current(draft), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [draft, value]);

    function clear() {
        setDraft("");
        onChangeRef.current("");
        inputRef.current?.focus();
    }

    return (
        <div className="search-input">
            <SearchIcon />
            <input
                id={id}
                ref={inputRef}
                type="search"
                placeholder={placeholder}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={label}
            />
            {draft && (
                <button type="button" className="search-clear" onClick={clear} aria-label={`Clear ${label.toLowerCase()}`}>
                    <CloseIcon />
                </button>
            )}
        </div>
    );
}
