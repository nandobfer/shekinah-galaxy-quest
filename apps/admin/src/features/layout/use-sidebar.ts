import { useCallback, useEffect, useRef, useState } from 'react';

export function useSidebar() {
  const [isDesktop, setDesktop] = useState(() => window.innerWidth >= 1024);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => buttonRef.current?.focus()); }, []);
  useEffect(() => {
    const resize = () => { setDesktop(window.innerWidth >= 1024); setOpen(false); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (!open || isDesktop) return;
    const frame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('nav a')?.focus());
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const elements = [...(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex="0"]') ?? [])];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', key); };
  }, [open, isDesktop, close]);
  return { isDesktop, open, setOpen, close, drawerRef, buttonRef };
}
