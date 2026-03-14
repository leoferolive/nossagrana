import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryFamiliaRepository } from './familia.repository.js';
import {
  ConviteExpiradoError,
  ConviteInvalidoError,
  FamiliaService,
  MembroJaExisteError,
  NaoAutorizadoError,
  SolicitacaoNaoEncontradaError,
} from './familia.service.js';

const makeUser = () => randomUUID();

describe('FamiliaService', () => {
  let repo: InMemoryFamiliaRepository;
  let service: FamiliaService;

  beforeEach(() => {
    repo = new InMemoryFamiliaRepository();
    service = new FamiliaService(repo);
  });

  // ─── UC05: Criar família ────────────────────────────────────────────────
  describe('criarFamilia', () => {
    it('cria família e associa criador como admin', async () => {
      const adminId = makeUser();
      const result = await service.criarFamilia({ nome: 'Família Silva', adminUserId: adminId });

      expect(result.nome).toBe('Família Silva');
      expect(result.role).toBe('admin');
      expect(result.id).toBeDefined();
    });
  });

  // ─── UC21: Gerar convite ────────────────────────────────────────────────
  describe('gerarConvite', () => {
    it('gera convite com código único e expira em 7 dias', async () => {
      const adminId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });

      const convite = await service.gerarConvite({ familiaId: familia.id, adminUserId: adminId });

      expect(convite.codigo).toBeTruthy();
      const expira = new Date(convite.expiraEm);
      const diffDias = (expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDias).toBeGreaterThan(6.9);
    });

    it('lança NaoAutorizadoError se usuário não é admin', async () => {
      const adminId = makeUser();
      const membroId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      await repo.adicionarMembro({ usuarioId: membroId, familiaId: familia.id, role: 'membro' });

      await expect(service.gerarConvite({ familiaId: familia.id, adminUserId: membroId })).rejects.toThrow(
        NaoAutorizadoError,
      );
    });
  });

  // ─── UC03: Entrar via convite ───────────────────────────────────────────
  describe('entrarViaConvite', () => {
    it('associa usuário à família ao usar convite válido', async () => {
      const adminId = makeUser();
      const novoUserId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      const convite = await service.gerarConvite({ familiaId: familia.id, adminUserId: adminId });

      const result = await service.entrarViaConvite({ codigo: convite.codigo, usuarioId: novoUserId });

      expect(result.familiaId).toBe(familia.id);
      expect(result.role).toBe('membro');
    });

    it('lança ConviteInvalidoError para código inexistente', async () => {
      await expect(service.entrarViaConvite({ codigo: 'INVALIDO', usuarioId: makeUser() })).rejects.toThrow(
        ConviteInvalidoError,
      );
    });

    it('lança ConviteExpiradoError para convite expirado', async () => {
      const adminId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      const expiraEm = new Date(Date.now() - 1000);
      const convite = await repo.criarConvite({ familiaId: familia.id, criadoPor: adminId, expiraEm });

      await expect(service.entrarViaConvite({ codigo: convite.codigo, usuarioId: makeUser() })).rejects.toThrow(
        ConviteExpiradoError,
      );
    });

    it('lança MembroJaExisteError se usuário já é membro', async () => {
      const adminId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      const convite = await service.gerarConvite({ familiaId: familia.id, adminUserId: adminId });

      await expect(service.entrarViaConvite({ codigo: convite.codigo, usuarioId: adminId })).rejects.toThrow(
        MembroJaExisteError,
      );
    });
  });

  // ─── UC04: Solicitar entrada ────────────────────────────────────────────
  describe('solicitarEntrada', () => {
    it('cria solicitação pendente para a família', async () => {
      const adminId = makeUser();
      const solicitanteId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });

      const sol = await service.solicitarEntrada({ familiaId: familia.id, usuarioId: solicitanteId });

      expect(sol.status).toBe('pendente');
      expect(sol.familiaId).toBe(familia.id);
    });

    it('lança MembroJaExisteError se usuário já é membro', async () => {
      const adminId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });

      await expect(service.solicitarEntrada({ familiaId: familia.id, usuarioId: adminId })).rejects.toThrow(
        MembroJaExisteError,
      );
    });
  });

  // ─── UC22: Aprovar/rejeitar solicitação ─────────────────────────────────
  describe('avaliarSolicitacao', () => {
    it('aprova solicitação e adiciona usuário à família', async () => {
      const adminId = makeUser();
      const solicitanteId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      const sol = await service.solicitarEntrada({ familiaId: familia.id, usuarioId: solicitanteId });

      const result = await service.avaliarSolicitacao({
        solicitacaoId: sol.id,
        familiaId: familia.id,
        adminUserId: adminId,
        acao: 'aprovar',
      });

      expect(result.status).toBe('aprovada');
      const membro = await repo.buscarMembro(solicitanteId, familia.id);
      expect(membro).not.toBeNull();
    });

    it('rejeita solicitação sem adicionar membro', async () => {
      const adminId = makeUser();
      const solicitanteId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      const sol = await service.solicitarEntrada({ familiaId: familia.id, usuarioId: solicitanteId });

      const result = await service.avaliarSolicitacao({
        solicitacaoId: sol.id,
        familiaId: familia.id,
        adminUserId: adminId,
        acao: 'rejeitar',
      });

      expect(result.status).toBe('rejeitada');
      const membro = await repo.buscarMembro(solicitanteId, familia.id);
      expect(membro).toBeNull();
    });

    it('lança NaoAutorizadoError se não é admin', async () => {
      const adminId = makeUser();
      const membroId = makeUser();
      const solicitanteId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      await repo.adicionarMembro({ usuarioId: membroId, familiaId: familia.id, role: 'membro' });
      const sol = await service.solicitarEntrada({ familiaId: familia.id, usuarioId: solicitanteId });

      await expect(
        service.avaliarSolicitacao({ solicitacaoId: sol.id, familiaId: familia.id, adminUserId: membroId, acao: 'aprovar' }),
      ).rejects.toThrow(NaoAutorizadoError);
    });

    it('lança SolicitacaoNaoEncontradaError para id inexistente', async () => {
      const adminId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });

      await expect(
        service.avaliarSolicitacao({ solicitacaoId: randomUUID(), familiaId: familia.id, adminUserId: adminId, acao: 'aprovar' }),
      ).rejects.toThrow(SolicitacaoNaoEncontradaError);
    });
  });

  // ─── UC23: Remover membro ───────────────────────────────────────────────
  describe('removerMembro', () => {
    it('remove membro da família', async () => {
      const adminId = makeUser();
      const membroId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      await repo.adicionarMembro({ usuarioId: membroId, familiaId: familia.id, role: 'membro' });

      await service.removerMembro({ familiaId: familia.id, membroId, adminUserId: adminId });

      const membro = await repo.buscarMembro(membroId, familia.id);
      expect(membro).toBeNull();
    });

    it('lança NaoAutorizadoError se não é admin', async () => {
      const adminId = makeUser();
      const membroId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      await repo.adicionarMembro({ usuarioId: membroId, familiaId: familia.id, role: 'membro' });

      await expect(service.removerMembro({ familiaId: familia.id, membroId: adminId, adminUserId: membroId })).rejects.toThrow(
        NaoAutorizadoError,
      );
    });

    it('lança NaoAutorizadoError se admin tenta remover a si mesmo', async () => {
      const adminId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });

      await expect(service.removerMembro({ familiaId: familia.id, membroId: adminId, adminUserId: adminId })).rejects.toThrow(
        NaoAutorizadoError,
      );
    });
  });

  // ─── UC24: Excluir família ──────────────────────────────────────────────
  describe('excluirFamilia', () => {
    it('exclui a família quando solicitado pelo admin', async () => {
      const adminId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });

      await service.excluirFamilia({ familiaId: familia.id, adminUserId: adminId });

      const familias = await repo.buscarFamiliasDoUsuario(adminId);
      expect(familias).toHaveLength(0);
    });

    it('lança NaoAutorizadoError se não é admin', async () => {
      const adminId = makeUser();
      const membroId = makeUser();
      const familia = await service.criarFamilia({ nome: 'Teste', adminUserId: adminId });
      await repo.adicionarMembro({ usuarioId: membroId, familiaId: familia.id, role: 'membro' });

      await expect(service.excluirFamilia({ familiaId: familia.id, adminUserId: membroId })).rejects.toThrow(
        NaoAutorizadoError,
      );
    });
  });

  // ─── UC20: Alternar família ─────────────────────────────────────────────
  describe('listarFamilias', () => {
    it('retorna todas as famílias do usuário com role', async () => {
      const userId = makeUser();
      const familia1 = await service.criarFamilia({ nome: 'F1', adminUserId: userId });
      const adminId2 = makeUser();
      const familia2 = await service.criarFamilia({ nome: 'F2', adminUserId: adminId2 });
      await repo.adicionarMembro({ usuarioId: userId, familiaId: familia2.id, role: 'membro' });

      const familias = await service.listarFamilias(userId);

      expect(familias).toHaveLength(2);
      const f1 = familias.find((f) => f.id === familia1.id);
      expect(f1?.role).toBe('admin');
    });
  });
});
