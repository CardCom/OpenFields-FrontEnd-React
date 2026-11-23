import { useEffect, useState } from 'react';

/**
 * Name of the iframe that currently holds keyboard focus, or null.
 *
 * CSS can't tell: focus inside a cross-origin iframe makes the <iframe> the parent's activeElement,
 * but neither :focus nor :focus-within matches it (Chromium, WebKit). The parent window does get a
 * `blur` when focus moves into an iframe and a `focus` when it comes back; moving between two
 * iframes fires nothing, so while the window is blurred activeElement is polled briefly.
 */
export function useFocusedIframe(): string | null {
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const read = () => {
      const el = document.activeElement;
      setFocused(el instanceof HTMLIFrameElement ? el.name || null : null);
    };
    const onBlur = () => {
      // activeElement is updated right after the blur event
      window.setTimeout(read, 0);
      window.clearInterval(timer);
      timer = window.setInterval(read, 150);
    };
    const onFocus = () => {
      window.clearInterval(timer);
      setFocused(null);
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, []);

  return focused;
}
