import { House, Plug, ShieldCheck, Users } from 'lucide-react';
export const APP_NAV = [
  { href: '/', label: 'Início', icon: House },
  { href: '/usuarios', label: 'Usuários', icon: Users },
  { href: '/perfis', label: 'Perfis', icon: ShieldCheck },
  { href: '/integracoes', label: 'Integrações', icon: Plug },
] as const;
export function isActiveHref(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
