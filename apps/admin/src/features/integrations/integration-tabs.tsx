import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface IntegrationTab { id: string; label: string; icon: LucideIcon; }
export function IntegrationTabs({ tabs, active, onSelect, label, children }: {
  tabs: readonly IntegrationTab[]; active: string; onSelect: (value: string) => void; label: string; children: ReactNode;
}) {
  return <div className="flex flex-col gap-6">
    <div role="tablist" aria-label={label} className="flex w-full flex-wrap justify-start gap-1 rounded-xl bg-muted p-1">
      {tabs.map(({ id, label: title, icon: Icon }, index) => <button type="button" role="tab" id={`integration-tab-${id}`} key={id}
        aria-selected={active === id} aria-controls={`integration-panel-${id}`} tabIndex={active === id ? 0 : -1}
        onClick={() => onSelect(id)} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : -1;
          if (next < 0) return;
          event.preventDefault(); onSelect(tabs[next]!.id);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:shadow-sm aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground">
        <Icon className="h-4 w-4" aria-hidden />{title}
      </button>)}
    </div>
    <AnimatePresence mode="wait" initial={false}><motion.div key={active} role="tabpanel" id={`integration-panel-${active}`} aria-labelledby={`integration-tab-${active}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="flex min-w-0 flex-col gap-6">{children}</motion.div></AnimatePresence>
  </div>;
}
