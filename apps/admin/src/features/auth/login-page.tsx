import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { LoginForm } from './login-form';
import { OptionalVisualEffect } from '@/components/feedback/OptionalVisualEffect';

const LoginParticleBackground = lazy(() => import('./login-particle-background').then(module => ({ default: module.LoginParticleBackground })));

/** Opex login composition; only identity text and authentication belong to Shekinah. */
export function LoginPage() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" aria-hidden="true" />
      <OptionalVisualEffect><Suspense fallback={null}><LoginParticleBackground /></Suspense></OptionalVisualEffect>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Shekinah</h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">Galaxy Quest · Administrativo</p>
        <div className="mt-8 w-full rounded-xl border border-border/70 bg-card/80 p-6 shadow-[0_0_50px_-18px_hsl(var(--primary))] backdrop-blur-md">
          <LoginForm />
        </div>
      </motion.div>
    </main>
  );
}
