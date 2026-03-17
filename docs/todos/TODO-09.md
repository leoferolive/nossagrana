# TODO-09 — Modal de Transação

**Status:** ✅ Concluído

## Escopo

**Mobile (bottom-sheet):**

- Overlay escuro + painel deslizante da base (borderRadius 20px top)
- Header: "Nova Transação" + ✕ fechar
- Toggle Despesa / Receita (com cores)
- Campos: Valor (fonte grande), Categoria (select), Descrição, Data + Pagamento (2 colunas)
- Toggles Parcelado / Recorrente (mutuamente exclusivos)
- Campo extra ao ativar Parcelado: "Número de Parcelas"
- Campos extras ao ativar Recorrente: Frequência + "Até (opcional)"
- Botão "Salvar Transação" (verde, w-full)

**Desktop (dialog centralizado):**

- Overlay com `backdropFilter: blur(4px)`
- Dialog 520px, centered, `borderRadius 16px`
- Mesmos campos em layout mais compacto (Categoria + Pagamento em 2 colunas)

## Resultado

Implementado em `apps/web/src/components/transacao-modal.tsx`
