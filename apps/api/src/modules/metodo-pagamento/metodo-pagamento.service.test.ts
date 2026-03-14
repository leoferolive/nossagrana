import { describe, expect, it } from 'vitest';

import { InMemoryMetodoPagamentoRepository } from './metodo-pagamento.repository.js';
import {
  MetodoPagamentoNotFoundError,
  MetodoPagamentoService,
} from './metodo-pagamento.service.js';

const buildService = () => {
  const repository = new InMemoryMetodoPagamentoRepository();
  const service = new MetodoPagamentoService(repository);
  return { repository, service };
};

describe('MetodoPagamentoService', () => {
  it('cria e lista métodos de pagamento por família', async () => {
    const { service } = buildService();

    await service.create({
      familiaId: 'f1',
      nome: 'Cartão Nubank',
      tipo: 'credito',
      dataFechamento: 15,
      dataVencimento: 22,
      usuarioDonoId: 'u1',
    });

    await service.create({
      familiaId: 'f2',
      nome: 'Pix pessoal',
      tipo: 'pix',
      dataFechamento: null,
      dataVencimento: null,
      usuarioDonoId: 'u2',
    });

    const result = await service.listByFamiliaId({ familiaId: 'f1' });
    expect(result).toHaveLength(1);
    expect(result[0]?.nome).toBe('Cartão Nubank');
  });

  it('edita um método de pagamento', async () => {
    const { repository, service } = buildService();

    const created = await repository.create({
      familiaId: 'f1',
      nome: 'Nubank',
      tipo: 'credito',
      dataFechamento: 10,
      dataVencimento: 17,
      usuarioDonoId: 'u1',
    });

    const updated = await service.update({
      id: created.id,
      familiaId: 'f1',
      nome: 'Nubank Atualizado',
      tipo: 'credito',
      dataFechamento: 15,
      dataVencimento: 22,
    });

    expect(updated.nome).toBe('Nubank Atualizado');
    expect(updated.dataFechamento).toBe(15);
  });

  it('lança MetodoPagamentoNotFoundError ao editar inexistente', async () => {
    const { service } = buildService();

    await expect(
      service.update({
        id: 'nao-existe',
        familiaId: 'f1',
        nome: 'X',
        tipo: 'debito',
        dataFechamento: null,
        dataVencimento: null,
      }),
    ).rejects.toThrow(MetodoPagamentoNotFoundError);
  });

  it('desativa (soft delete) um método de pagamento', async () => {
    const { repository, service } = buildService();

    const created = await repository.create({
      familiaId: 'f1',
      nome: 'Pix',
      tipo: 'pix',
      dataFechamento: null,
      dataVencimento: null,
      usuarioDonoId: 'u1',
    });

    const deactivated = await service.deactivate({ id: created.id, familiaId: 'f1' });
    expect(deactivated.ativo).toBe(false);

    const listed = await service.listByFamiliaId({ familiaId: 'f1' });
    expect(listed).toHaveLength(0);
  });

  it('lança MetodoPagamentoNotFoundError ao desativar inexistente', async () => {
    const { service } = buildService();

    await expect(service.deactivate({ id: 'nao-existe', familiaId: 'f1' })).rejects.toThrow(
      MetodoPagamentoNotFoundError,
    );
  });

  it('não permite acesso entre famílias diferentes', async () => {
    const { repository, service } = buildService();

    const created = await repository.create({
      familiaId: 'f1',
      nome: 'Débito',
      tipo: 'debito',
      dataFechamento: null,
      dataVencimento: null,
      usuarioDonoId: 'u1',
    });

    await expect(
      service.deactivate({ id: created.id, familiaId: 'outra-familia' }),
    ).rejects.toThrow(MetodoPagamentoNotFoundError);
  });
});
