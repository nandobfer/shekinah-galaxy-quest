import { House, Plug } from 'lucide-react';
export const APP_NAV = [
  { href: '/', label: 'Início', icon: House },
  { href: '/integracoes', label: 'Integrações', icon: Plug },
] as const;
export function isActiveHref(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
