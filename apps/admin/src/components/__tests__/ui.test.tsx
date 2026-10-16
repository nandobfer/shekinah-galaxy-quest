import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Field } from '../ui/field';
import { Textarea } from '../ui/textarea';
import { OptionTabs } from '../ui/option-tabs';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog';
import { TooltipIconButton } from '../ui/tooltip-icon-button';
import { IconAction } from '../ui/icon-action';
import { ErrorState } from '../feedback/ErrorState';
import { OptionalVisualEffect } from '../feedback/OptionalVisualEffect';
import { Markdown } from '../ui/markdown';
import { Calendar } from '../ui/calendar';
import { TimeSlotList } from '../ui/time-slot-list';
import { ShieldCheck } from 'lucide-react';

describe('componentes portados do Opex', () => {
  it('carrega o catálogo inteiro sem imports Next ou features do Opex', () => {
    const modules = import.meta.glob(['../ui/*.tsx', '../list/*.tsx', '../motion/*.{ts,tsx}', '../feedback/*.tsx', '../wizard/*.tsx'], { eager: true });
    expect(Object.keys(modules).length).toBeGreaterThan(60);
    for (const module of Object.values(modules)) expect(Object.keys(module as object).length).toBeGreaterThan(0);
  });
  it('suporta variantes, ref e composição de botão sem elemento aninhado', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<><Button ref={ref} variant="secondary" size="sm">Salvar</Button><Button asChild variant="link"><a href="/ajuda">Ajuda</a></Button></>);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('link', { name: 'Ajuda' }).parentElement?.tagName).not.toBe('BUTTON');
  });
  it('encaminha ref, disabled e associação do erro nos campos', () => {
    const ref = createRef<HTMLInputElement>();
    render(<><Field id="name" label="Nome" error="Obrigatório"><Input ref={ref} id="name" disabled aria-describedby="name-error" /></Field><Textarea aria-label="Observações" /></>);
    expect(ref.current?.disabled).toBe(true);
    expect(screen.getByLabelText('Nome')).toBe(ref.current);
    expect(screen.getByRole('alert').id).toBe('name-error');
    expect(screen.getByLabelText('Observações').tagName).toBe('TEXTAREA');
  });
  it('navega opções por teclado ignorando opções bloqueadas', async () => {
    function Example() { const [value, setValue] = useState('one'); return <OptionTabs aria-label="Estado" options={[{ value: 'one', label: 'Um' }, { value: 'two', label: 'Dois', disabled: true }, { value: 'three', label: 'Três' }]} value={value} onChange={setValue} />; }
    render(<Example />);
    const user = userEvent.setup();
    screen.getByRole('radio', { name: 'Um' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Três' }).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Três' }));
  });
  it('abre diálogo por portal, fecha com Esc e restaura foco', async () => {
    render(<Dialog><DialogTrigger asChild><Button>Abrir</Button></DialogTrigger><DialogContent><DialogTitle>Detalhes</DialogTitle><DialogDescription>Descrição acessível</DialogDescription></DialogContent></Dialog>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog', { name: 'Detalhes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir' }));
  });
  it('adapta links internos e não executa ação bloqueada', async () => {
    const onClick = vi.fn();
    render(<MemoryRouter><TooltipIconButton label="Ajuda" href="/ajuda"><ShieldCheck /></TooltipIconButton><IconAction label="Excluir" icon={ShieldCheck} disabledReason="Sem acesso" onClick={onClick} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Ajuda' }).getAttribute('href')).toBe('/ajuda');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onClick).not.toHaveBeenCalled();
  });
  it('oferece recuperação em estado de erro', async () => {
    const retry = vi.fn(); render(<ErrorState onRetry={retry} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('uma falha decorativa não remove o formulário', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never { throw new Error('canvas indisponível'); }
    try {
      render(<><OptionalVisualEffect><Broken /></OptionalVisualEffect><Input aria-label="E-mail" /></>);
      expect(screen.getByRole('textbox', { name: 'E-mail' })).toBeTruthy();
    } finally { error.mockRestore(); }
  });
  it('renderiza GFM sem executar HTML ou JavaScript', () => {
    const { container } = render(<Markdown>{'**Texto**\n\n<script>alert(1)</script>\n\n[Link](javascript:alert(1))'}</Markdown>);
    expect(screen.getByText('Texto').tagName).toBe('STRONG');
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Link').getAttribute('href')).not.toContain('javascript:');
  });
  it('renderiza calendário pt-BR com seleção compatível', async () => {
    const select = vi.fn();
    render(<Calendar mode="single" month={new Date(2026, 9, 1)} onSelect={select} />);
    expect(screen.getByText(/outubro/i)).toBeTruthy();
    const day = screen.getAllByRole('button').find(button => button.textContent === '15');
    expect(day).toBeTruthy();
    await userEvent.setup().click(day!);
    expect(select).toHaveBeenCalled();
  });
  it('seleciona horários por teclado, sem escolher os indisponíveis', async () => {
    const onChange = vi.fn();
    render(<TimeSlotList aria-label="Horário" min="09:00" max="10:00" value="09:00" onChange={onChange} isDisabled={value => value === '09:30'} />);
    const user = userEvent.setup();
    screen.getByRole('option', { name: '09:00' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledWith('10:00');
  });
});
