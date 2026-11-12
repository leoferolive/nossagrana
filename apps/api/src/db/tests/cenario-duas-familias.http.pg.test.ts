import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { DrizzleVerificadorAcessoFamilia } from '../../shared/familia-access/verificador-acesso-familia.js';

import { criarCenarioDuasFamilias, type CenarioDuasFamilias } from './cenario-duas-familias.js';
import { cabecalhosAutenticados, type UsuarioDeTeste } from './credenciais-teste.js';

/**
 * Caminho real de posse (#79/#80): o `DrizzleVerificadorAcessoFamilia` real lê
 * `usuario_familia` na conexão do cenário. Com NODE_ENV=test as rotas HTTP usam
 * repositórios InMemory, então o 200 prova a posse (o prehandler), não os dados.
 */
type App = ReturnType<typeof buildApp>;

let cenario: CenarioDuasFamilias;
let app: App;

beforeAll(async () => {
  cenario = await criarCenarioDuasFamilias();
  const verificadorAcessoFamilia = new DrizzleVerificadorAcessoFamilia(drizzle(cenario.banco.sql));
  app = buildApp({ verificadorAcessoFamilia });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  await cenario?.descartar();
});

function listarCategorias(usuario: UsuarioDeTeste, familiaId: string) {
  return app.inject({
    method: 'GET',
    url: '/api/categorias',
    headers: cabecalhosAutenticados(app, usuario, familiaId),
  });
}

describe('posse de família via verificador Drizzle contra o banco da fixture', () => {
  it('admin e membro acessam a própria família', async () => {
    const { familiaA } = cenario;

    expect((await listarCategorias(familiaA.admin, familiaA.familiaId)).statusCode).toBe(200);
    expect((await listarCategorias(familiaA.membro, familiaA.familiaId)).statusCode).toBe(200);
  });

  it('usuário de A forjando x-familia-id de B recebe 403 FAMILIA_SEM_ACESSO', async () => {
    const { familiaA, familiaB } = cenario;

    const resposta = await listarCategorias(familiaA.admin, familiaB.familiaId);

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().error.code).toBe('FAMILIA_SEM_ACESSO');
  });

  it('usuário de B é recusado em A (simetria)', async () => {
    const { familiaA, familiaB } = cenario;

    const resposta = await listarCategorias(familiaB.membro, familiaA.familiaId);

    expect(resposta.statusCode).toBe(403);
  });
});
