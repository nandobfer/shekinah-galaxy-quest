import { motion } from 'framer-motion';
import { Bug } from 'lucide-react';
import type { IntegrationPatch } from '@shekinah/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FORM_GRID_WIDE } from '@/components/ui/form-grid';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cardMotion } from './public-fields-card';

export function GeneralCard({ environment, debugMode, onEnvironment, onDebug, disabled }: {
  environment: IntegrationPatch['environment']; debugMode: boolean;
  onEnvironment: (value: IntegrationPatch['environment']) => void; onDebug: (value: boolean) => void; disabled: boolean;
}) {
  return <motion.div {...cardMotion}><Card>
    <CardHeader><CardTitle className="text-base">Geral</CardTitle></CardHeader>
    <CardContent className={FORM_GRID_WIDE}>
      <div className="space-y-1.5"><Label htmlFor="environment">Ambiente</Label>
        <Select value={environment} onValueChange={value => onEnvironment(value as IntegrationPatch['environment'])} disabled={disabled}>
          <SelectTrigger id="environment" aria-label="Ambiente"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="interno">Interno</SelectItem><SelectItem value="externo">Externo</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="debug" className="flex items-center gap-1.5"><Bug className="h-3.5 w-3.5 text-amber-600" />Modo debug</Label>
        <div className="flex h-10 items-center gap-3"><Switch id="debug" checked={debugMode} onCheckedChange={onDebug} disabled={disabled} aria-label="Modo debug" />
          <span className="text-xs text-muted-foreground">Registra chamadas, eventos e etapas (retidos por 48h)</span>
        </div>
      </div>
    </CardContent>
  </Card></motion.div>;
}
