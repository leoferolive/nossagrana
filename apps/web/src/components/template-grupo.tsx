import type { TemplateTransacaoListItem } from '@nossagrana/types';

import { TemplateValorInput } from './template-valor-input';

interface TemplateGrupoProps {
  titulo: string;
  templates: TemplateTransacaoListItem[];
  valores: Record<string, string>;
  onSetValor: (id: string, valor: string) => void;
}

export function TemplateGrupo({ titulo, templates, valores, onSetValor }: TemplateGrupoProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{titulo}</h2>
      <div className="flex flex-col gap-1.5">
        {templates.map((template) => (
          <TemplateValorInput
            key={template.id}
            nome={template.nome}
            valor={valores[template.id] ?? ''}
            onChange={(valor) => onSetValor(template.id, valor)}
            cofrinhoEmoji={template.cofrinhoEmoji}
          />
        ))}
      </div>
    </div>
  );
}
