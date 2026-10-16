import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive disabled:opacity-50', className)} {...props} />;
}
