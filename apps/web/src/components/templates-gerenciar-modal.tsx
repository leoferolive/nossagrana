import { useEffect, useState } from 'react';

import type { TemplateTransacaoListItem } from '@nossagrana/types';

import { templateTransacaoService } from '@/services/template-transacao.service';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useCofrinhoStore } from '@/stores/cofrinho.store';
import { useTemplateTransacaoStore } from '@/stores/template-transacao.store';

import {
  IconAdicionar,
  IconEditar,
  IconExcluir,
  IconFechar,
  IconSalvar,
} from './icons';

interface TemplatesGerenciarModalProps {
  open: boolean;
  onClose: () => void;
  familiaId: string;
}

interface FormState {
  nome: string;
  tipo: 'receita' | 'despesa';
  categoriaId: string;
  valorPadrao: string;
  cofrinhoId: string;
}

const FORM_VAZIO: FormState = {
  nome: '',
  tipo: 'despesa',
  categoriaId: '',
  valorPadrao: '',
  cofrinhoId: '',
};

function useFormTemplate(initial: FormState = FORM_VAZIO) {
  const [form, setForm] = useState<FormState>(initial);
  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const reset = () => setForm(FORM_VAZIO);
  return { form, setField, reset, setForm };
}

export function TemplatesGerenciarModal({ open, onClose, familiaId }: TemplatesGerenciarModalProps) {
  const { templates, fetchTemplates } = useTemplateTransacaoStore();
  const { categorias } = useCategoriaStore();
  const { cofrinhos } = useCofrinhoStore();

  const [mostraCriar, setMostraCriar] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmandoExcluirId, setConfirmandoExcluirId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criar = useFormTemplate();
  const editar = useFormTemplate();

  useEffect(() => {
    if (open) {
      void fetchTemplates(familiaId);
      setMostraCriar(false);
      setEditandoId(null);
      setConfirmandoExcluirId(null);
      setErro(null);
      criar.reset();
      editar.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familiaId]);

  if (!open) return null;

  const receitas = templates.filter((t) => t.tipo === 'receita');
  const despesas = templates.filter((t) => t.tipo === 'despesa');

  const handleCriar = async () => {
    if (!criar.form.nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await templateTransacaoService.criar(familiaId, {
        nome: criar.form.nome.trim(),
        tipo: criar.form.tipo,
        categoriaId: criar.form.categoriaId || null,
        valorPadrao: criar.form.valorPadrao || null,
        cofrinhoId: criar.form.cofrinhoId || null,
      });
      await fetchTemplates(familiaId);
      criar.reset();
      setMostraCriar(false);
    } catch {
      setErro('Erro ao criar template');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = async (id: string) => {
    if (!editar.form.nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await templateTransacaoService.editar(familiaId, id, {
        nome: editar.form.nome.trim(),
        categoriaId: editar.form.categoriaId || null,
        valorPadrao: editar.form.valorPadrao || null,
        cofrinhoId: editar.form.cofrinhoId || null,
      });
      await fetchTemplates(familiaId);
      setEditandoId(null);
      editar.reset();
    } catch {
      setErro('Erro ao editar template');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string) => {
    setSalvando(true);
    setErro(null);
    try {
      await templateTransacaoService.excluir(familiaId, id);
      await fetchTemplates(familiaId);
      setConfirmandoExcluirId(null);
    } catch {
      setErro('Erro ao excluir template');
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (template: TemplateTransacaoListItem) => {
    setEditandoId(template.id);
    editar.setForm({
      nome: template.nome,
      tipo: template.tipo,
      categoriaId: template.categoriaId ?? '',
      valorPadrao: template.valorPadrao ?? '',
      cofrinhoId: template.cofrinhoId ?? '',
    });
  };

  const renderTemplate = (template: TemplateTransacaoListItem) => {
    const isEditando = editandoId === template.id;
    const isConfirmando = confirmandoExcluirId === template.id;

    if (isEditando) {
      return (
        <div key={template.id} className="rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-col gap-2">
            <input
              aria-label="Nome do template"
              type="text"
              value={editar.form.nome}
              onChange={(e) => editar.setField('nome', e.target.value)}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <select
              aria-label="Categoria"
              value={editar.form.categoriaId}
              onChange={(e) => editar.setField('categoriaId', e.target.value)}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <input
              aria-label="Valor padrão"
              type="number"
              min="0"
              step="0.01"
              value={editar.form.valorPadrao}
              onChange={(e) => editar.setField('valorPadrao', e.target.value)}
              placeholder="Valor padrão (opcional)"
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {template.tipo === 'despesa' && (
              <select
                aria-label="Cofrinho"
                value={editar.form.cofrinhoId}
                onChange={(e) => editar.setField('cofrinhoId', e.target.value)}
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">Sem cofrinho</option>
                {cofrinhos.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji ?? ''} {c.nome}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Cancelar edição"
                onClick={() => { setEditandoId(null); editar.reset(); }}
                className="flex-1 rounded border border-border py-1.5 text-xs text-text-muted transition hover:text-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                aria-label="Salvar edição"
                onClick={() => void handleEditar(template.id)}
                disabled={!editar.form.nome.trim() || salvando}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-primary py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                <IconSalvar size={12} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isConfirmando) {
      return (
        <div key={template.id} className="rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="mb-2 text-xs text-text">
            Desativar <strong>{template.nome}</strong>?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Cancelar exclusão"
              onClick={() => setConfirmandoExcluirId(null)}
              className="flex-1 rounded border border-border py-1.5 text-xs text-text-muted transition hover:text-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              aria-label="Confirmar exclusão"
              onClick={() => void handleExcluir(template.id)}
              disabled={salvando}
              className="flex-1 rounded bg-danger py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={template.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-text">{template.nome}</span>
          {(template.categoriaNome ?? template.cofrinhoNome) && (
            <span className="text-xs text-text-muted">
              {template.cofrinhoNome
                ? `${template.cofrinhoEmoji ?? ''} ${template.cofrinhoNome}`.trim()
                : (template.categoriaNome ?? '')}
            </span>
          )}
        </div>
        <div className="ml-2 flex items-center gap-1">
          {template.valorPadrao && (
            <span className="text-xs text-text-muted">R$ {template.valorPadrao}</span>
          )}
          <button
            type="button"
            aria-label={`Editar ${template.nome}`}
            onClick={() => iniciarEdicao(template)}
            className="p-1 text-text-muted transition hover:text-text"
          >
            <IconEditar size={14} />
          </button>
          <button
            type="button"
            aria-label={`Excluir ${template.nome}`}
            onClick={() => setConfirmandoExcluirId(template.id)}
            className="p-1 text-text-muted transition hover:text-danger"
          >
            <IconExcluir size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gerenciar Templates"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto rounded-t-2xl bg-bg p-5 shadow-soft md:rounded-2xl md:border md:border-border">
        {/* Handle bar mobile */}
        <div className="mb-4 flex justify-center md:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text">Gerenciar Templates</h2>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="text-text-muted transition hover:text-text"
          >
            <IconFechar size={18} />
          </button>
        </div>

        {/* Error */}
        {erro && (
          <p className="mb-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {erro}
          </p>
        )}

        {/* Receitas */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Receitas
          </h3>
          {receitas.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhuma receita cadastrada.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {receitas.map(renderTemplate)}
            </div>
          )}
        </section>

        {/* Despesas */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Despesas
          </h3>
          {despesas.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhuma despesa cadastrada.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {despesas.map(renderTemplate)}
            </div>
          )}
        </section>

        {/* Add form */}
        {mostraCriar ? (
          <div className="rounded-lg border border-border bg-surface p-3">
            <h4 className="mb-2 text-xs font-semibold text-text">Novo Template</h4>
            <div className="flex flex-col gap-2">
              <input
                aria-label="Nome"
                type="text"
                value={criar.form.nome}
                onChange={(e) => criar.setField('nome', e.target.value)}
                placeholder="Nome do template"
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <select
                aria-label="Tipo"
                value={criar.form.tipo}
                onChange={(e) => criar.setField('tipo', e.target.value as 'receita' | 'despesa')}
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
              <select
                aria-label="Categoria"
                value={criar.form.categoriaId}
                onChange={(e) => criar.setField('categoriaId', e.target.value)}
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <input
                aria-label="Valor padrão"
                type="number"
                min="0"
                step="0.01"
                value={criar.form.valorPadrao}
                onChange={(e) => criar.setField('valorPadrao', e.target.value)}
                placeholder="Valor padrão (opcional)"
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              {criar.form.tipo === 'despesa' && (
                <select
                  aria-label="Cofrinho"
                  value={criar.form.cofrinhoId}
                  onChange={(e) => criar.setField('cofrinhoId', e.target.value)}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">Sem cofrinho</option>
                  {cofrinhos.map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji ?? ''} {c.nome}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Cancelar criação"
                  onClick={() => { setMostraCriar(false); criar.reset(); }}
                  className="flex-1 rounded border border-border py-1.5 text-xs text-text-muted transition hover:text-text"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  aria-label="Salvar template"
                  onClick={() => void handleCriar()}
                  disabled={!criar.form.nome.trim() || salvando}
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-primary py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  <IconSalvar size={12} />
                  Criar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Adicionar template"
            onClick={() => setMostraCriar(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-text-muted transition hover:border-primary hover:text-text"
          >
            <IconAdicionar size={16} />
            Adicionar
          </button>
        )}
      </div>
    </div>
  );
}
