import { useCallback, useEffect, useState } from 'react';
import { useBlocker, useBeforeUnload } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { BrainCircuit, CalendarClock, Settings2 } from 'lucide-react';
import { integrationDefinition, integrationPatchSchema, integrationValuesSchema, type Integration, type IntegrationPatch } from '@shekinah/contracts';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FORM_GRID_WIDE } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SecretField } from './secret-field';
import { cardMotion, PublicFieldsCard } from './public-fields-card';
import { CronJobsCard } from './cron-jobs-card';
import { DetailHeader } from './detail-header';
import { DetailActions } from './detail-actions';
import { GeneralCard } from './general-card';
import { AiProvidersCard } from './ai-providers-card';
import { IntegrationTabs } from './integration-tabs';
import { IntegrationLogsPanel } from './integration-logs-panel';
import { useSaveIntegration } from './hooks';
import { usePermissions } from '../users/hooks/usePermissions';

function draft(data: Integration): IntegrationPatch {
  return { version: data.version, publicValues: data.publicValues, secrets: {}, environment: data.environment, debugMode: data.debugMode };
}

export function IntegrationEditor({ data }: { data: Integration }) {
  const { can } = usePermissions();
  const readOnly = !can(`integrations.${data.id}.edit`);
  const showLogs = data.debugMode && can(`integrations.${data.id}.explore`);
  const definition = integrationDefinition(data.id);
  const save = useSaveIntegration(data.id);
  const form = useForm<IntegrationPatch>({ defaultValues: draft(data), resolver: zodResolver(integrationPatchSchema) });
  const values = useWatch({ control: form.control });
  const dirty = form.formState.isDirty;
  const blocked = useBlocker(dirty && !save.isPending);
  const [tab, setTab] = useState(data.id === 'ai' ? 'provedores' : data.parent ? 'configuracao' : 'geral');
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }, [dirty]));
  useEffect(() => {
    // Polling updates health but cannot replace a draft or roll back a successful save.
    if (!dirty && data.version > form.getValues('version')) form.reset(draft(data));
  }, [data, dirty, form]);

  const setPublic = (key: string, value: IntegrationPatch['publicValues'][string]) => form.setValue(`publicValues.${key}`, value, { shouldDirty: true });
  const general = <GeneralCard environment={values.environment ?? data.environment} debugMode={Boolean(values.debugMode)}
    onEnvironment={value => form.setValue('environment', value, { shouldDirty: true })} onDebug={value => form.setValue('debugMode', value, { shouldDirty: true })} disabled={readOnly || save.isPending} />;
  const publicFields = <PublicFieldsCard definition={data.id === 'crons' ? { ...definition, fields: definition.fields.filter(field => field.key === 'schedulerEnabled') } : definition}
    values={values.publicValues as IntegrationPatch['publicValues']} setValue={setPublic} disabled={readOnly || save.isPending} />;
  const privateFields = !!definition.secrets.length && <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.1 }}><Card>
    <CardHeader><CardTitle className="text-base">Campos privados</CardTitle><CardDescription>Criptografados no servidor. O valor salvo nunca é exibido.</CardDescription></CardHeader>
    <CardContent className={FORM_GRID_WIDE}>{definition.secrets.map(field => <SecretField key={`${field.key}-${form.getValues('version')}-${resetKey}`}
      field={field} state={data.secrets[field.key] ?? { configured: false, unreadable: false }}
      action={values.secrets?.[field.key] as IntegrationPatch['secrets'][string] | undefined} enabled={data.encryptionKeyConfigured} disabled={readOnly || save.isPending}
      onChange={action => {
        const secrets = { ...form.getValues('secrets') };
        if (action) secrets[field.key] = action; else delete secrets[field.key];
        form.setValue('secrets', secrets, { shouldDirty: true });
      }} />)}</CardContent>
  </Card></motion.div>;
  const actions = !readOnly && <DetailActions dirty={dirty} pending={save.isPending} onUndo={() => { form.reset(draft(data)); setResetKey(key => key + 1); }} />;
  const regular = <>{general}{data.parent ? <>{privateFields}{publicFields}</> : <>{publicFields}{privateFields}</>}{actions}</>;
  const tabs = data.id === 'ai' ? [{ id: 'provedores', label: 'Provedores', icon: BrainCircuit }]
    : data.parent ? [{ id: 'configuracao', label: 'Configuração', icon: Settings2 }]
    : [{ id: 'geral', label: 'Geral', icon: Settings2 }, { id: 'rotinas', label: 'Rotinas', icon: CalendarClock }];

  return <>
    <div className={cn('grid items-start gap-6', showLogs && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')} data-testid="integration-editor-grid">
      <motion.form initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22, ease: 'easeOut' }}
        className="flex min-w-0 flex-col gap-6" aria-label={`Configuração de ${definition.name}`} onSubmit={form.handleSubmit(async input => {
          if (readOnly) return;
          const valid = integrationValuesSchema(data.id).safeParse(input.publicValues);
          if (!valid.success) { form.setError('root', { message: valid.error.issues[0]?.message ?? 'Confira os campos.' }); return; }
          try { const saved = await save.mutateAsync(input); form.reset(draft(saved)); } catch { /* Mutation displays the safe error. */ }
        })}>
        <DetailHeader data={data} />
        {readOnly && <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Você tem acesso de visualização. A configuração está em modo de leitura.</p>}
        {data.version > form.getValues('version') && dirty && <p role="alert" className="text-sm text-destructive">Esta configuração foi alterada em outra sessão. Desfaça suas alterações para recarregar a versão atual.</p>}
        {data.id === 'ai' || data.parent || data.id === 'crons' ? <IntegrationTabs tabs={tabs} active={tab} label={data.id === 'ai' ? 'Seções de Provedores de IA' : data.parent ? 'Seções do provedor de IA' : 'Seções da integração Crons'} onSelect={next => {
          if (next === tab) return;
          if (dirty) setPendingTab(next); else setTab(next);
        }}>
          {data.id === 'ai' ? <><AiProvidersCard />{general}{actions}</>
            : data.id === 'crons' && tab === 'rotinas' ? <><CronJobsCard state={data.cronState} dirty={dirty} disabled={save.isPending} values={values.publicValues as IntegrationPatch['publicValues']} setValue={setPublic} />{actions}</>
            : regular}
        </IntegrationTabs> : <>
          {general}
          {data.id === 'internal_api' && <motion.div {...cardMotion}><Card>
            <CardHeader><CardTitle className="text-base">Documentação da API</CardTitle><CardDescription>A documentação e os endpoints administrativos usam sua sessão autenticada.</CardDescription></CardHeader>
            <CardContent><div className="space-y-1.5"><Label htmlFor="swagger-url">Documentação Swagger (OpenAPI)</Label>
              <div className="flex flex-wrap gap-2"><Input id="swagger-url" readOnly value="/api/v1/openapi.json" className="min-w-0 flex-1 font-mono text-xs" />
                <Button asChild type="button" variant="outline"><a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">Abrir documentação</a></Button></div>
              <p className="text-xs text-muted-foreground">Documentação gerenciada pelo app; não pode ser alterada.</p>
            </div></CardContent>
          </Card></motion.div>}
          {publicFields}{privateFields}{actions}
        </>}
        {(form.formState.errors.root || form.formState.errors.secrets) && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root?.message ?? 'Preencha os novos segredos antes de salvar.'}</p>}
        {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
      </motion.form>
      {showLogs && <IntegrationLogsPanel id={data.id} />}
    </div>
    <AlertDialog open={blocked.state === 'blocked' || pendingTab !== null}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>{pendingTab ? 'Esta aba tem alterações não salvas. Ao trocar de aba, elas serão descartadas.' : 'Existem alterações não salvas nesta configuração.'}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel onClick={() => { if (blocked.state === 'blocked') blocked.reset(); setPendingTab(null); }}>Continuar editando</AlertDialogCancel>
        <AlertDialogAction onClick={() => { if (blocked.state === 'blocked') blocked.proceed(); if (pendingTab) { form.reset(draft(data)); setTab(pendingTab); setPendingTab(null); } }}>Descartar</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </>;
}
