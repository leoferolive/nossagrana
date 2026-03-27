import type { TemplateTransacaoAplicarResponse, TemplateTransacaoListItem } from '@nossagrana/types';
import { create } from 'zustand';

import { templateTransacaoService } from '../services/template-transacao.service';

interface TemplateTransacaoStore {
  templates: TemplateTransacaoListItem[];
  valores: Record<string, string>;
  mesReferencia: string;
  carregando: boolean;
  salvando: boolean;
  erro: string | null;

  fetchTemplates: (familiaId: string) => Promise<void>;
  setValor: (templateId: string, valor: string) => void;
  setMesReferencia: (mes: string) => void;
  limparValores: () => void;
  aplicar: (familiaId: string) => Promise<TemplateTransacaoAplicarResponse>;
}

const getMesAtual = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const useTemplateTransacaoStore = create<TemplateTransacaoStore>((set, get) => ({
  templates: [],
  valores: {},
  mesReferencia: getMesAtual(),
  carregando: false,
  salvando: false,
  erro: null,

  async fetchTemplates(familiaId: string) {
    set({ carregando: true, erro: null });
    try {
      const data = await templateTransacaoService.listar(familiaId);
      const valores: Record<string, string> = {};
      for (const t of data.templates) {
        if (t.valorPadrao) {
          valores[t.id] = t.valorPadrao;
        }
      }
      set({ templates: data.templates, valores, carregando: false });
    } catch {
      set({ erro: 'Erro ao carregar templates', carregando: false });
    }
  },

  setValor(templateId: string, valor: string) {
    set((state) => ({ valores: { ...state.valores, [templateId]: valor } }));
  },

  setMesReferencia(mes: string) {
    set({ mesReferencia: mes });
  },

  limparValores() {
    const { templates } = get();
    const valores: Record<string, string> = {};
    for (const t of templates) {
      if (t.valorPadrao) valores[t.id] = t.valorPadrao;
    }
    set({ valores });
  },

  async aplicar(familiaId: string) {
    const { mesReferencia, valores } = get();
    const itens = Object.entries(valores)
      .filter(([, valor]) => parseFloat(valor) > 0)
      .map(([templateId, valor]) => ({ templateId, valor }));

    if (itens.length === 0) throw new Error('Preencha ao menos um valor');

    set({ salvando: true, erro: null });
    try {
      const result = await templateTransacaoService.aplicar(familiaId, { mesReferencia, itens });
      set({ salvando: false });
      return result;
    } catch {
      set({ erro: 'Erro ao salvar lançamentos', salvando: false });
      throw new Error('Erro ao salvar lançamentos');
    }
  },
}));
