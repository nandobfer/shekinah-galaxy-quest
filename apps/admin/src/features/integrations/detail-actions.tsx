import { Loader2, Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DetailActions({ dirty, pending, onUndo }: { dirty: boolean; pending: boolean; onUndo: () => void }) {
  return <div className="flex justify-end gap-2 border-t border-gray-200 pt-6 dark:border-gray-700">
    <Button type="button" variant="outline" onClick={onUndo} disabled={!dirty || pending}><Undo2 className="mr-2 h-4 w-4" />Desfazer</Button>
    <Button type="submit" disabled={!dirty || pending}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar</Button>
  </div>;
}
