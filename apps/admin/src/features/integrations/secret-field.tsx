import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Eraser, KeyRound, Pencil, Undo2 } from 'lucide-react';
import type { IntegrationDefinition, IntegrationPatch } from '@shekinah/contracts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { IconAction } from './icon-action';

interface Props {
  field: IntegrationDefinition['secrets'][number];
  state: { configured: boolean; unreadable: boolean };
  action?: IntegrationPatch['secrets'][string];
  enabled: boolean; disabled: boolean;
  onChange: (value: IntegrationPatch['secrets'][string] | undefined) => void;
}
export function SecretField({ field, state, action, enabled, disabled, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const id = `secret-${field.key}`;
  const mode = action?.action === 'clear' ? 'clear' : editing || action?.action === 'set' ? 'set' : 'keep';
  const reset = () => { setEditing(false); onChange(undefined); };
  return <div className="space-y-1.5">
    <Label htmlFor={id} className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5 text-muted-foreground" />{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
    <AnimatePresence mode="wait" initial={false}>
      {mode === 'set' ? <motion.div key="set" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18 }} className="flex gap-2">
        <Input id={id} type="password" autoComplete="new-password" autoFocus placeholder={`Novo valor para ${field.label.toLowerCase()}`}
          value={action?.action === 'set' ? action.value : ''} onChange={event => onChange(event.target.value ? { action: 'set', value: event.target.value } : undefined)} disabled={disabled || !enabled} />
        <IconAction label="Desfazer" icon={<Undo2 className="h-4 w-4" />} onClick={reset} className="h-10 w-10" disabled={disabled} />
      </motion.div> : <motion.div key={mode} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18 }}
        className={cn('flex h-10 items-center justify-between gap-2 rounded-md border px-3', mode === 'clear' ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/40')}>
        <span className="flex items-center gap-2 text-sm">{mode === 'clear' ? <span className="text-destructive">Será removido ao salvar</span> : <><span className={state.configured ? 'text-foreground' : 'text-muted-foreground'}>{state.configured ? 'Configurado' : 'Não configurado'}</span>{state.configured && <span className="tracking-widest text-muted-foreground">••••••••</span>}</>}</span>
        <span className="-mr-2 flex items-center">{mode === 'clear' ? <IconAction label="Desfazer" icon={<Undo2 className="h-4 w-4" />} onClick={reset} disabled={disabled} /> : <>
          <IconAction label={!enabled ? 'Chave de criptografia ausente no servidor' : state.configured ? 'Substituir' : 'Definir'} icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)} disabled={disabled || !enabled} />
          {state.configured && <IconAction label="Limpar" icon={<Eraser className="h-4 w-4" />} className="text-destructive hover:text-destructive" onClick={() => onChange({ action: 'clear' })} disabled={disabled} />}
        </>}</span>
      </motion.div>}
    </AnimatePresence>
    {state.unreadable && <p className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> O valor salvo não pôde ser lido com a chave atual; defina-o novamente.</p>}
    {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
  </div>;
}
