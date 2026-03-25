import { useEffect, useState } from 'react';

import { ErrorBanner } from '@/components/error-banner';
import { categoriaService } from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';

interface CategoriasPageProps {
  familiaId: string;
  onBack: () => void;
}

type FormMode = 'idle' | 'create' | 'edit';

export const CategoriasPage = ({ familiaId, onBack }: CategoriasPageProps) => {
  const { categorias, carregando } = useCategoriaStore();
  const setCategorias = useCategoriaStore((s) => s.setCategorias);
  const addCategoria = useCategoriaStore((s) => s.addCategoria);
  const updateCategoria = useCategoriaStore((s) => s.updateCategoria);
  const removeCategoria = useCategoriaStore((s) => s.removeCategoria);
  const setCarregando = useCategoriaStore((s) => s.setCarregando);

  const [formMode, setFormMode] = useState<FormMode>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!familiaId) return;
    setCarregando(true);
    categoriaService
      .listar(familiaId)
      .then((res) => setCategorias(res.categorias))
      .catch(() => {
        setErro('Erro ao carregar categorias');
      })
      .finally(() => setCarregando(false));
  }, [familiaId, setCategorias, setCarregando]);

  const handleOpenCreate = () => {
    setNome('');
    setTipo('despesa');
    setEditingId(null);
    setFormMode('create');
  };

  const handleOpenEdit = (id: string) => {
    const cat = categorias.find((c) => c.id === id);
    if (!cat) return;
    setNome(cat.nome);
    setTipo(cat.tipo);
    setEditingId(id);
    setFormMode('edit');
  };

  const handleCloseForm = () => {
    setFormMode('idle');
    setEditingId(null);
  };

  const handleSave = async () => {
    setCarregando(true);
    setErro(null);
    try {
      if (formMode === 'create') {
        const res = await categoriaService.criar({ nome, tipo }, familiaId);
        addCategoria(res.categoria);
      } else if (formMode === 'edit' && editingId) {
        const res = await categoriaService.editar(editingId, { nome, tipo }, familiaId);
        updateCategoria(res.categoria);
      }
      handleCloseForm();
    } catch {
      setErro('Erro ao salvar categoria');
    } finally {
      setCarregando(false);
    }
  };

  const handleDesativar = async (id: string) => {
    setErro(null);
    try {
      await categoriaService.desativar(id, familiaId);
      removeCategoria(id);
    } catch {
      setErro('Erro ao desativar categoria');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="text-text-muted transition hover:text-text"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-text">Categorias</h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:bg-success-strong"
        >
          Nova categoria
        </button>
      </header>

      <ErrorBanner error={erro} />

      {/* Formulário inline */}
      {formMode !== 'idle' && (
        <div className="border-b border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-text">
            {formMode === 'create' ? 'Nova categoria' : 'Editar categoria'}
          </p>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Nome</span>
              <input
                id="nome-categoria"
                aria-label="Nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-info/40"
                placeholder="Ex: Alimentação"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Tipo</span>
              <select
                aria-label="Tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'receita' | 'despesa')}
                className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text focus:outline-none"
              >
                <option value="despesa">despesa</option>
                <option value="receita">receita</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCloseForm}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted transition hover:text-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="flex-1 rounded-lg bg-success py-2 text-sm font-semibold text-white transition hover:bg-success-strong"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 p-4">
        {carregando && <p className="text-center text-sm text-text-muted">Carregando...</p>}

        {!carregando && categorias.length === 0 && (
          <p className="text-center text-sm text-text-muted">
            Nenhuma categoria cadastrada. Crie a primeira!
          </p>
        )}

        {/* Desktop: grid 2 colunas */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-4">
          {(['despesa', 'receita'] as const).map((tipoSecao) => (
            <div key={tipoSecao} className="rounded-xl border border-border bg-panel p-4">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-muted">
                {tipoSecao === 'despesa' ? 'Despesas' : 'Receitas'}
              </h2>
              {categorias
                .filter((c) => c.tipo === tipoSecao)
                .map((cat, i, arr) => (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <span className="text-sm text-text">{cat.nome}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat.id)}
                        aria-label={`Editar ${cat.nome}`}
                        className="cursor-pointer text-xs text-text-muted transition hover:text-text"
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDesativar(cat.id)}
                        aria-label="Desativar"
                        className="text-xs text-danger transition hover:text-danger/80"
                      >
                        desativar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* Mobile: lista com seções */}
        <div className="md:hidden">
          {(['despesa', 'receita'] as const).map((tipoSecao) => {
            const items = categorias.filter((c) => c.tipo === tipoSecao);
            if (items.length === 0) return null;
            return (
              <div key={tipoSecao}>
                <h2 className="pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-text-muted">
                  {tipoSecao === 'despesa' ? 'Despesas' : 'Receitas'}
                </h2>
                {items.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between border-b border-border py-3"
                  >
                    <span className="text-sm text-text">{cat.nome}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat.id)}
                        aria-label={`Editar ${cat.nome}`}
                        className="cursor-pointer text-xs text-text-muted transition hover:text-text"
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDesativar(cat.id)}
                        aria-label="Desativar"
                        className="text-xs text-danger transition hover:text-danger/80"
                      >
                        desativar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 w-full py-3 text-center text-sm font-semibold text-success transition hover:text-success-strong"
          >
            + Nova Categoria
          </button>
        </div>
      </div>
    </div>
  );
};
