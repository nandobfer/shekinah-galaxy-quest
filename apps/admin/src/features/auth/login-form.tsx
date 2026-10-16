import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from '@shekinah/contracts';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, queryClient, sessionKey } from './session';

export function LoginForm() {
  const [revealed, setRevealed] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });
  const login = useMutation({
    mutationFn: (data: LoginInput) => api.login(data),
    onSuccess: session => { queryClient.setQueryData(sessionKey, session); },
    onError: error => {
      form.setError('password', { message: error.message });
      toast.error(error.message);
    },
  });
  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <form onSubmit={form.handleSubmit(values => login.mutate(values))} className="space-y-4" noValidate aria-busy={login.isPending} aria-label="Acesso administrativo">
      <Field id="login-email" label="E-mail" error={emailError}>
        <Input id="login-email" type="email" inputMode="email" autoComplete="username" autoFocus disabled={login.isPending} aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? 'login-email-error' : undefined} {...form.register('email')} />
      </Field>
      <Field id="login-password" label="Senha" error={passwordError}>
        <div className="relative">
          <Input id="login-password" type={revealed ? 'text' : 'password'} autoComplete="current-password" disabled={login.isPending} aria-invalid={passwordError ? true : undefined} aria-describedby={passwordError ? 'login-password-error' : undefined} className="pr-10" {...form.register('password')} />
          <button
            type="button" disabled={login.isPending} onClick={() => setRevealed(value => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={revealed ? 'Ocultar senha' : 'Mostrar senha'} title={revealed ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={revealed}
          >
            {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </Field>
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…</> : 'Entrar'}
      </Button>
    </form>
  );
}
