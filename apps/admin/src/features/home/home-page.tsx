import { Link } from 'react-router-dom';
import { ArrowRight, Plug } from 'lucide-react';
import { CadastroHeader } from '@/components/list/CadastroHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function HomePage({ name }: { name: string }) {
  return <div className="flex flex-col gap-6">
    <CadastroHeader title="Início" description={`Olá, ${name}. Bem-vindo ao administrativo Shekinah Galaxy Quest.`} />
    <Link to="/integracoes" className="w-full max-w-xl rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="transition-colors hover:bg-muted/50"><CardHeader><CardTitle className="flex items-center gap-3"><Plug className="h-5 w-5 text-primary" />Integrações<ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" /></CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Configure serviços, acompanhe conexões e gerencie as rotinas do backend.</CardContent></Card></Link>
  </div>;
}
