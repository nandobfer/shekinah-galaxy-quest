import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from '@shekinah/contracts';
import { Eye, EyeOff, ArrowRight, LoaderCircle, ShieldCheck, Orbit } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { api, queryClient, sessionKey } from './session';

export function LoginPage() {
  const [visible, setVisible] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const login = useMutation({ mutationFn: (data: LoginInput) => api.login(data), onSuccess: session => {
    queryClient.setQueryData(sessionKey, session);
  } });
  return <main className="page-shell">
    <section className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-3 text-sm font-semibold tracking-widest text-primary"><Orbit aria-hidden="true" size={28} /> SHEKINAH</div>
        <p className="text-sm uppercase tracking-[0.22em] text-muted">Galaxy Quest · Administrativo</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Uma jornada extraordinária começa com cuidado.</h1>
        <p className="max-w-md text-base leading-relaxed text-muted">Acesse o ambiente de administração do Clube Shekinah.</p>
        <div className="flex items-center gap-2 text-sm text-muted"><ShieldCheck size={18} aria-hidden="true" /> Acesso exclusivo para administradores</div>
      </div>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-3xl border border-border bg-card p-7 shadow-2xl sm:p-10" aria-labelledby="login-title">
        <h2 id="login-title" className="text-2xl font-semibold">Boas-vindas</h2>
        <p className="mt-2 text-sm text-muted">Entre com suas credenciais para continuar.</p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit(data => login.mutate(data))} noValidate aria-busy={login.isPending}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="username" inputMode="email" placeholder="seu@email.com" disabled={login.isPending} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
            {errors.email && <p id="email-error" role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" disabled={login.isPending} className="pr-14" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} {...register('password')} />
              <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} className="absolute inset-y-0 right-1 flex w-12 items-center justify-center rounded-lg text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </div>
            {errors.password && <p id="password-error" role="alert" className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {login.error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{login.error.message}</p>}
          <Button type="submit" className="w-full" disabled={login.isPending}>{login.isPending ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Entrando…</> : <>Entrar <ArrowRight size={18} aria-hidden="true" /></>}</Button>
        </form>
        <p className="mt-6 text-xs leading-relaxed text-muted">Precisa de acesso? Solicite o cadastro ao responsável pelo sistema.</p>
      </motion.section>
    </section>
  </main>;
}
