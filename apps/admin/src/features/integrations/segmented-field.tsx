import { AnimatePresence, motion } from 'framer-motion';
import type { IntegrationField } from '@shekinah/contracts';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function SegmentedField({ field, value, onChange, disabled }: {
  field: IntegrationField; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const labelId = `field-${field.key}-label`;
  const current = value || String(field.defaultValue ?? '');
  return <div className="space-y-1.5">
    <Label id={labelId}>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
    <div role="radiogroup" aria-labelledby={labelId} className="inline-flex h-10 w-full rounded-md border bg-muted/40 p-1">
      {field.options?.map((option, index) => {
        const selected = option === current;
        return <button key={option} type="button" role="radio" aria-checked={selected} disabled={disabled}
          tabIndex={selected ? 0 : -1} onClick={() => !selected && onChange(option)}
          onKeyDown={event => {
            const options = field.options ?? [];
            const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
            if (!step) return;
            event.preventDefault();
            const next = (index + step + options.length) % options.length;
            onChange(options[next]!);
            (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next])?.focus();
          }}
          className={cn('relative flex-1 rounded-sm px-3 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
            selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          <AnimatePresence initial={false}>{selected && <motion.span key="active" aria-hidden className="absolute inset-0 rounded-sm bg-background shadow-sm"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.18, ease: 'easeOut' }} />}</AnimatePresence>
          <span className="relative">{field.optionLabels?.[option] ?? option}</span>
        </button>;
      })}
    </div>
    {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
  </div>;
}
