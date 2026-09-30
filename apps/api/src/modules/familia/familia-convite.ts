import { randomBytes } from 'node:crypto';

import type {
  ConsumoConviteResultado,
  CreatedFamilia,
  CreatedFamiliaInvite,
} from './familia.types.js';

const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Código (12 hex maiúsculos, 48 bits) e validade (7 dias) de um convite novo.
 * Fonte única para o adapter Drizzle e o InMemory.
 */
export function montarNovoConvite(agora: Date): { codigo: string; expiraEm: Date } {
  return {
    codigo: randomBytes(6).toString('hex').toUpperCase(),
    expiraEm: new Date(agora.getTime() + VALIDADE_CONVITE_MS),
  };
}

type EstadoConvite = 'elegivel' | 'usado' | 'expirado' | 'invalido';

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

interface VinculoEmMemoria {
  role: 'admin' | 'membro';
  dataEntrada: Date;
}

/** Estado do InMemoryFamiliaRepository que o consumo de convite lê e altera. */
interface BaseConvitesEmMemoria {
  convites: Map<string, ConviteEmMemoria>;
  familias: Map<string, CreatedFamilia>;
  vinculos: Map<string, Map<string, VinculoEmMemoria>>;
}

/**
 * Repetição segura: o convite já foi consumido por ESTE usuário. Se ele ainda
 * é membro, o pedido repetido (resposta perdida, falha no `alternar`) vira
 * `ja_membro`; se foi removido depois, o convite continua "usado". Fonte única
 * da regra para o adapter Drizzle e o InMemory.
 */
export function ehRepeticaoDoConsumidor(
  estado: EstadoConvite,
  usadoPor: string | null | undefined,
  usuarioId: string,
): boolean {
  return estado === 'usado' && usadoPor === usuarioId;
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

  const usadoPor = convite.usadoPor ?? null;
  const estado = classificarConvite({ usadoPor, expiraEm: convite.expiraEm }, agora);
  const vinculos = base.vinculos.get(familia.id) ?? new Map<string, VinculoEmMemoria>();
  const jaMembro = vinculos.has(input.usuarioId);
  const repeticao = ehRepeticaoDoConsumidor(estado, usadoPor, input.usuarioId);
  if (jaMembro && (estado === 'elegivel' || repeticao)) return { status: 'ja_membro', familia };
  if (estado !== 'elegivel') return { status: estado };

  vinculos.set(input.usuarioId, { role: 'membro', dataEntrada: agora });
  base.vinculos.set(familia.id, vinculos);
  base.convites.set(convite.id, { ...convite, usadoPor: input.usuarioId, usadoEm: agora });
  return { status: 'entrou', familia };
}
