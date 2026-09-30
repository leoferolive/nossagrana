import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryRevokedTokenRepository } from './revoked-token.repository.js';
import { SessaoRevogacaoService } from './sessao-revogacao.service.js';
import { SessaoLifecyclePublisherFake } from './tests/sessao-lifecycle-publisher-fake.js';

const T0 = new Date('2026-09-30T12:00:00.000Z');
const emSegundos = (data: Date): number => Math.floor(data.getTime() / 1000);

describe('SessaoRevogacaoService (#119)', () => {
  let repo: InMemoryRevokedTokenRepository;
  let ordem: string[];
  let publisher: SessaoLifecyclePublisherFake;
  let service: SessaoRevogacaoService;

  beforeEach(() => {
    repo = new InMemoryRevokedTokenRepository(() => T0);
    ordem = [];
    publisher = new SessaoLifecyclePublisherFake(() => ordem.push('evento'));
    service = new SessaoRevogacaoService(repo, publisher);
  });

  describe('revogarTodas', () => {
    it('grava a revogação e só depois publica o evento (após commit)', async () => {
      const revogarNoRepo = repo.revokeAllByUserId.bind(repo);
      repo.revokeAllByUserId = async (userId) => {
        await revogarNoRepo(userId);
        ordem.push('gravado');
      };

      await service.revogarTodas('user-1');

      expect(ordem).toEqual(['gravado', 'evento']);
      expect(publisher.usuariosRevogados).toEqual(['user-1']);
    });

    it('não publica o evento quando a gravação falha (nada de sockets fechados à toa)', async () => {
      repo.revokeAllByUserId = async () => {
        throw new Error('banco indisponível');
      };

      await expect(service.revogarTodas('user-1')).rejects.toThrow('banco indisponível');

      expect(publisher.usuariosRevogados).toEqual([]);
    });
  });

  describe('estaRevogada', () => {
    it('é false para quem nunca teve revogação global', async () => {
      expect(await service.estaRevogada('user-1', emSegundos(T0))).toBe(false);
    });

    it('é true para token emitido antes da revogação', async () => {
      await service.revogarTodas('user-1');

      expect(await service.estaRevogada('user-1', emSegundos(T0) - 60)).toBe(true);
    });

    it('é true para token emitido no mesmo segundo da revogação (iat só tem precisão de segundos)', async () => {
      await service.revogarTodas('user-1');

      expect(await service.estaRevogada('user-1', emSegundos(T0))).toBe(true);
    });

    it('é false para token emitido depois da revogação (novo login)', async () => {
      await service.revogarTodas('user-1');

      expect(await service.estaRevogada('user-1', emSegundos(T0) + 1)).toBe(false);
    });

    it('trata token sem iat como revogado quando há revogação global (falha fechada)', async () => {
      await service.revogarTodas('user-1');

      expect(await service.estaRevogada('user-1', undefined)).toBe(true);
      expect(await service.estaRevogada('user-2', undefined)).toBe(false);
    });

    it('não afeta outros usuários', async () => {
      await service.revogarTodas('user-1');

      expect(await service.estaRevogada('user-2', emSegundos(T0) - 60)).toBe(false);
    });
  });
});
