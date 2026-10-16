import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props extends Omit<ComponentProps<typeof Button>, 'children' | 'size'> {
  label: string;
  icon: ReactNode;
}

/** Port do IconAction do Opex: somente ícone, tooltip e rótulo acessível. */
export function IconAction({ label, icon, className, variant = 'ghost', ...props }: Props) {
  return (
    <TooltipProvider><Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant={variant} size="icon" className={cn('h-8 w-8', className)} aria-label={label} {...props}>{icon}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip></TooltipProvider>
  );
}
