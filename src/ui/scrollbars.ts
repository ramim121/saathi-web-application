import { useEffect } from 'react';

/**
 * Auto-hiding scrollbars, part two (the CSS is in src/styles/ui.css).
 *
 * Marks whatever is scrolling — the page or any panel — with `data-scrolling`
 * for a moment after each scroll event, so its scrollbar shows while it moves
 * and fades out shortly after. One passive capture listener for the document.
 */
export function useAutoHideScrollbars(hideAfterMs = 900) {
    useEffect(() => {
        const timers = new Map<Element, number>();
        const onScroll = (event: Event) => {
            const target = event.target;
            const el = target === document ? document.documentElement : target instanceof Element ? target : null;
            if (!el) return;
            if (!el.hasAttribute('data-scrolling')) el.setAttribute('data-scrolling', '');
            window.clearTimeout(timers.get(el));
            timers.set(
                el,
                window.setTimeout(() => {
                    el.removeAttribute('data-scrolling');
                    timers.delete(el);
                }, hideAfterMs),
            );
        };
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => {
            document.removeEventListener('scroll', onScroll, { capture: true });
            timers.forEach((timer, el) => {
                window.clearTimeout(timer);
                el.removeAttribute('data-scrolling');
            });
        };
    }, [hideAfterMs]);
}
