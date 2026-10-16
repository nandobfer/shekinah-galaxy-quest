import { AnimatePresence, motion } from 'framer-motion';
import type { IntegrationDefinition, IntegrationField, PublicValue } from '@shekinah/contracts';
import { fieldVisible } from '@shekinah/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FORM_GRID_WIDE } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedField } from './segmented-field';

export const cardMotion = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: 'easeOut' } } as const;
export function PublicField({ field, value, onChange, disabled }: {
  field: IntegrationField; value: PublicValue; onChange: (value: PublicValue) => void; disabled?: boolean;
}) {
  const id = `field-${field.key}`;
  if (field.kind === 'segmented') return <SegmentedField field={field} value={String(value)} onChange={onChange} disabled={disabled} />;
  return <div className="space-y-1.5">
    <Label htmlFor={id}>{field.label}{field.required && <span className="text-destructive"> *</span>}{field.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">({field.unit})</span>}</Label>
    {field.kind === 'boolean' ? <div className="flex h-10 items-center gap-3"><Switch id={id} checked={value === true} onCheckedChange={onChange} disabled={disabled} />{field.description && <span className="text-xs text-muted-foreground">{field.description}</span>}</div>
      : field.kind === 'select' ? <Select value={String(value)} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id} aria-label={field.label}><SelectValue /></SelectTrigger><SelectContent>{field.options?.map(option => <SelectItem key={option} value={option}>{field.optionLabels?.[option] ?? option}</SelectItem>)}</SelectContent></Select>
      : <Input id={id} type={field.kind === 'number' ? 'number' : 'text'} inputMode={field.kind === 'number' ? 'numeric' : undefined}
          min={field.min} max={field.max} placeholder={field.placeholder ?? (field.defaultValue !== undefined ? String(field.defaultValue) : undefined)}
          value={String(value)} onChange={event => onChange(field.kind === 'number' ? Number(event.target.value) : event.target.value)}
          disabled={disabled} className={field.kind === 'url' ? 'font-mono text-xs' : undefined} />}
    {field.kind !== 'boolean' && field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
  </div>;
}

export function PublicFieldsCard({ definition, values, setValue, disabled }: {
  definition: IntegrationDefinition; values: Record<string, PublicValue>; setValue: (key: string, value: PublicValue) => void; disabled: boolean;
}) {
  if (!definition.fields.length) return null;
  return <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.05 }}><Card>
    <CardHeader><CardTitle className="text-base">Campos públicos</CardTitle><CardDescription>Salvos em texto simples; visíveis para quem acessa esta integração.</CardDescription></CardHeader>
    <CardContent className={FORM_GRID_WIDE}><AnimatePresence initial={false}>
      {definition.fields.filter(field => fieldVisible(field, values)).map(field => <motion.div key={field.key}
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
        <PublicField field={field} value={values[field.key] ?? ''} onChange={value => setValue(field.key, value)} disabled={disabled} />
      </motion.div>)}
    </AnimatePresence></CardContent>
  </Card></motion.div>;
}
