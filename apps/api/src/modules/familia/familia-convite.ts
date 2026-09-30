import type {
  ConsumoConviteResultado,
  CreatedFamilia,
  CreatedFamiliaInvite,
} from './familia.types.js';

export type EstadoConvite = 'elegivel' | 'usado' | 'expirado' | 'invalido';

interface ConviteClassificavel {
  usadoPor: string | null;
  expiraEm: Date;
}

/**
 * Estado de um convite num instante. Fonte única da regra, usada pelo adapter
 * Drizzle (ao explicar por que o UPDATE condicional não casou) e pelo
 * InMemory. `null` = código inexistente. "Usado" vence "expirado" para que a
 * requisição perdedora receba sempre o mesmo motivo.
 */
export function classificarConvite(
  convite: ConviteClassificavel | null,
  agora: Date,
): EstadoConvite {
  if (!convite) return 'invalido';
  if (convite.usadoPor) return 'usado';
  if (convite.expiraEm <= agora) return 'expirado';
  return 'elegivel';
}

export interface ConviteEmMemoria extends CreatedFamiliaInvite {
  usadoPor?: string;
  usadoEm?: Date;
}

export interface VinculoEmMemoria {
  role: 'admin' | 'membro';
  dataEntrada: Date;
}

/** Estado do InMemoryFamiliaRepository que o consumo de convite lê e altera. */
export interface BaseConvitesEmMemoria {
  convites: Map<string, ConviteEmMemoria>;
  familias: Map<string, CreatedFamilia>;
  vinculos: Map<string, Map<string, VinculoEmMemoria>>;
}

/**
 * Espelho do consumo atômico do Drizzle para o InMemory: checagem e escrita
 * acontecem sem `await` entre elas, então duas chamadas concorrentes nunca
 * observam o convite livre ao mesmo tempo (JS é single-thread).
 */
export function consumirConviteEmMemoria(
  base: BaseConvitesEmMemoria,
  input: { codigo: string; usuarioId: string },
  agora: Date,
): ConsumoConviteResultado {
  const convite = [...base.convites.values()].find((c) => c.codigo === input.codigo);
  const familia = convite ? base.familias.get(convite.familiaId) : undefined;
  if (!convite || !familia) return { status: 'invalido' };

  const estado = classificarConvite(
    { usadoPor: convite.usadoPor ?? null, expiraEm: convite.expiraEm },
    agora,
  );
  if (estado !== 'elegivel') return { status: estado };

  const vinculos = base.vinculos.get(familia.id) ?? new Map<string, VinculoEmMemoria>();
  if (vinculos.has(input.usuarioId)) return { status: 'ja_membro', familia };

  vinculos.set(input.usuarioId, { role: 'membro', dataEntrada: agora });
  base.vinculos.set(familia.id, vinculos);
  base.convites.set(convite.id, { ...convite, usadoPor: input.usuarioId, usadoEm: agora });
  return { status: 'entrou', familia };
}
