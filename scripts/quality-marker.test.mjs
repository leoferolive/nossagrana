// Testes dos scripts de marcador do quality gate.
// Rodar: pnpm test:scripts (ou node --test scripts/*.test.mjs)
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dentro de um hook do git (ex.: pre-commit) essas variáveis apontam para o
// repositório real; removê-las mantém os repos temporários isolados.
const INHERITED_GIT_VARS = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE', 'GIT_PREFIX'];
for (const name of INHERITED_GIT_VARS) delete process.env[name];
delete process.env.CLAUDECODE;

const {
  captureIndexState,
  checkQualityMarker,
  finalizeGateMarker,
  markerPathFor,
  recordQualityMarker,
} = await import('./quality-marker.mjs');

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const huskyPreCommit = resolve(scriptsDir, '..', '.husky', 'pre-commit');
const checkScript = join(scriptsDir, 'check-quality-marker.mjs');
const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function spawnIn(cwd, cmd, args, extraEnv = {}) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...extraEnv } });
}

function git(cwd, ...args) {
  const result = spawnIn(cwd, 'git', args);
  assert.equal(result.status, 0, `git ${args.join(' ')} falhou: ${result.stderr}`);
  return result.stdout.trim();
}

function write(cwd, relativePath, content) {
  mkdirSync(dirname(join(cwd, relativePath)), { recursive: true });
  writeFileSync(join(cwd, relativePath), content);
}

function createTempRepo() {
  const cwd = makeTempDir('quality-marker-');
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.name', 'Teste');
  git(cwd, 'config', 'user.email', 'teste@example.com');
  git(cwd, 'config', 'commit.gpgsign', 'false');
  write(cwd, 'a.txt', 'versao 1\n');
  git(cwd, 'add', 'a.txt');
  return cwd;
}

function stageNewContent(cwd, content) {
  write(cwd, 'a.txt', content);
  git(cwd, 'add', 'a.txt');
}

function createConflict(cwd) {
  git(cwd, 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'base');
  git(cwd, 'checkout', '-q', '-b', 'outro');
  stageNewContent(cwd, 'lado outro\n');
  git(cwd, 'commit', '-q', '--no-verify', '-m', 'outro');
  git(cwd, 'checkout', '-q', '-');
  stageNewContent(cwd, 'lado principal\n');
  git(cwd, 'commit', '-q', '--no-verify', '-m', 'principal');
  assert.notEqual(spawnIn(cwd, 'git', ['merge', 'outro']).status, 0);
}

function runCheck(cwd) {
  return spawnIn(cwd, process.execPath, [checkScript]);
}

let repo;
beforeEach(() => {
  repo = createTempRepo();
});

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('recordQualityMarker', () => {
  test('grava marcador com o hash da árvore do índice', () => {
    const outcome = recordQualityMarker(repo);

    assert.equal(outcome.recorded, true);
    assert.equal(outcome.treeHash, git(repo, 'write-tree'));
    assert.ok(existsSync(markerPathFor(repo, outcome.treeHash)));
  });

  test('marcador fica no git-path do repositório', () => {
    const outcome = recordQualityMarker(repo);
    const expectedDir = resolve(repo, git(repo, 'rev-parse', '--git-path', 'quality-gate'));

    assert.equal(markerPathFor(repo, outcome.treeHash), join(expectedDir, outcome.treeHash));
  });

  test('não grava marcador quando há mudanças não staged', () => {
    write(repo, 'a.txt', 'versao 2 nao staged\n');

    const outcome = recordQualityMarker(repo);

    assert.equal(outcome.recorded, false);
    assert.match(outcome.reason, /git add/);
    assert.equal(existsSync(markerPathFor(repo, git(repo, 'write-tree'))), false);
  });

  test('não grava marcador com arquivo não rastreado em apps/ e lista o arquivo', () => {
    write(repo, 'apps/web/src/novo.ts', 'export const x = 1;\n');

    const outcome = recordQualityMarker(repo);

    assert.equal(outcome.recorded, false);
    assert.match(outcome.reason, /apps\/web\/src\/novo\.ts/);
    assert.match(outcome.reason, /git add/);
  });

  test('arquivo não rastreado fora de apps/packages/scripts só gera aviso', () => {
    write(repo, 'docs/rascunho.md', '# rascunho\n');

    const outcome = recordQualityMarker(repo);

    assert.equal(outcome.recorded, true);
    assert.ok(outcome.warnings.some((line) => line.includes('docs/rascunho.md')));
  });

  test('não grava quando o índice mudou entre o início e o fim do gate', () => {
    const initialState = captureIndexState(repo);
    stageNewContent(repo, 'versao 2\n');

    const outcome = recordQualityMarker(repo, initialState);

    assert.equal(outcome.recorded, false);
    assert.match(outcome.reason, /índice mudou durante o gate/);
    assert.equal(existsSync(markerPathFor(repo, initialState.treeHash)), false);
    assert.equal(existsSync(markerPathFor(repo, git(repo, 'write-tree'))), false);
  });
});

describe('finalizeGateMarker', () => {
  test('em modo CI não grava marcador', () => {
    const initialState = captureIndexState(repo);

    const outcome = finalizeGateMarker({ cwd: repo, isCI: true, initialState });

    assert.equal(outcome.recorded, false);
    assert.equal(existsSync(markerPathFor(repo, initialState.treeHash)), false);
  });

  test('com índice em conflito não lança e devolve aviso legível', () => {
    createConflict(repo);
    const initialState = captureIndexState(repo);

    const outcome = finalizeGateMarker({ cwd: repo, isCI: false, initialState });

    assert.equal(outcome.recorded, false);
    assert.ok(outcome.messages.some((line) => /⚠/.test(line) && /conflito/.test(line)));
  });

  test('fora do CI grava e informa o hash', () => {
    const initialState = captureIndexState(repo);

    const outcome = finalizeGateMarker({ cwd: repo, isCI: false, initialState });

    assert.equal(outcome.recorded, true);
    assert.ok(outcome.messages.some((line) => line.includes(initialState.treeHash)));
  });
});

describe('checkQualityMarker', () => {
  test('é falso sem marcador e verdadeiro depois de gravar', () => {
    assert.equal(checkQualityMarker(repo).ok, false);
    recordQualityMarker(repo);
    assert.equal(checkQualityMarker(repo).ok, true);
  });

  test('mudar o conteúdo staged invalida o marcador', () => {
    recordQualityMarker(repo);
    stageNewContent(repo, 'versao 2\n');

    assert.equal(checkQualityMarker(repo).ok, false);
  });
});

describe('check-quality-marker.mjs', () => {
  test('sai 1 com instrução em português quando não há marcador', () => {
    const result = runCheck(repo);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /pnpm quality/);
    assert.match(result.stderr, /git add/);
    assert.match(result.stderr, /Web/);
  });

  test('sai 0 quando existe marcador para o índice atual', () => {
    recordQualityMarker(repo);

    assert.equal(runCheck(repo).status, 0);
  });

  test('sai 1 quando o conteúdo staged mudou após o marcador', () => {
    recordQualityMarker(repo);
    stageNewContent(repo, 'versao 2\n');

    assert.equal(runCheck(repo).status, 1);
  });

  test('sai 1 com mensagem legível, sem stack trace, com índice em conflito', () => {
    createConflict(repo);

    const result = runCheck(repo);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /conflito/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  });
});

describe('.husky/pre-commit real (core.hooksPath)', () => {
  // Stub do pnpm: o lint-staged não existe no repo temporário. Registra cada
  // chamada em FAKE_PNPM_LOG e, se FAKE_LINT_STAGED_APPEND estiver setada,
  // simula o prettier do lint-staged alterando e re-stageando a.txt.
  const FAKE_PNPM_SCRIPT = [
    '#!/bin/sh',
    'echo "$*" >> "$FAKE_PNPM_LOG"',
    'if [ "$1 $2" = "exec lint-staged" ] && [ -n "$FAKE_LINT_STAGED_APPEND" ]; then',
    '  printf \'%s\\n\' "$FAKE_LINT_STAGED_APPEND" >> a.txt && git add a.txt',
    'fi',
    'exit 0',
    '',
  ].join('\n');

  function createFakePnpmBin() {
    const binDir = makeTempDir('fake-pnpm-');
    write(binDir, 'pnpm', FAKE_PNPM_SCRIPT);
    spawnSync('chmod', ['+x', join(binDir, 'pnpm')]);
    return binDir;
  }

  // O husky 9 executa o hook com `sh -e "$s"`; o hooksPath aponta para um
  // wrapper que reproduz isso, em vez de rodar .husky/pre-commit pelo shebang.
  function createShErrexitHooksDir() {
    const hooksDir = makeTempDir('husky-sh-e-');
    write(hooksDir, 'pre-commit', `#!/bin/sh\nexec sh -e "${huskyPreCommit}" "$@"\n`);
    spawnSync('chmod', ['+x', join(hooksDir, 'pre-commit')]);
    return hooksDir;
  }

  function prepareHookRepo() {
    for (const file of ['check-quality-marker.mjs', 'quality-marker.mjs']) {
      mkdirSync(join(repo, 'scripts'), { recursive: true });
      copyFileSync(join(scriptsDir, file), join(repo, 'scripts', file));
    }
    git(repo, 'add', 'scripts');
    git(repo, 'commit', '-q', '--no-verify', '-m', 'base');
    git(repo, 'config', 'core.hooksPath', createShErrexitHooksDir());
  }

  function runWithFakePnpm(cmd, args, { claude = true, lintStagedAppend } = {}) {
    const log = join(makeTempDir('fake-pnpm-log-'), 'pnpm.log');
    const env = { FAKE_PNPM_LOG: log, PATH: `${createFakePnpmBin()}:${process.env.PATH}` };
    if (claude) env.CLAUDECODE = '1';
    if (lintStagedAppend) env.FAKE_LINT_STAGED_APPEND = lintStagedAppend;
    const result = spawnIn(repo, cmd, args, env);
    const pnpmCalls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
    return { ...result, pnpmCalls };
  }

  function hookCommit({ args = [], ...options } = {}) {
    return runWithFakePnpm('git', ['commit', '-q', '-m', 'teste', ...args], options);
  }

  function stageTestedContent() {
    prepareHookRepo();
    stageNewContent(repo, 'versao testada\n');
    assert.equal(recordQualityMarker(repo).recorded, true);
  }

  test('git commit -a com mudança não testada é bloqueado', () => {
    stageTestedContent();
    write(repo, 'a.txt', 'versao NAO testada\n');

    const result = hookCommit({ args: ['-a'] });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Commit bloqueado/);
  });

  test('git commit do conteúdo testado passa quando o lint-staged não muda nada', () => {
    stageTestedContent();

    const result = hookCommit();

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.pnpmCalls, ['exec lint-staged']);
  });

  test('lint-staged que reformata e re-stageia arquivo bloqueia o commit', () => {
    stageTestedContent();
    const testedTree = git(repo, 'write-tree');
    const headBefore = git(repo, 'rev-parse', 'HEAD');

    const result = hookCommit({ lintStagedAppend: 'linha do prettier' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Commit bloqueado/);
    assert.match(result.stderr, /formatados e re-stageados/);
    assert.match(result.stderr, /pnpm quality/);
    assert.equal(git(repo, 'rev-parse', 'HEAD'), headBefore);
    assert.notEqual(git(repo, 'write-tree'), testedTree);
  });

  test('commit humano (sem CLAUDECODE) roda só o lint-staged, sem exigir marcador', () => {
    prepareHookRepo();
    stageNewContent(repo, 'versao sem gate\n');

    const result = hookCommit({ claude: false, lintStagedAppend: 'linha do prettier' });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.pnpmCalls, ['exec lint-staged']);
    assert.doesNotMatch(result.stderr, /Commit bloqueado/);
  });

  test('rodado à mão com `sh -e` e índice em conflito, explica o motivo em vez de abortar mudo', () => {
    prepareHookRepo();
    createConflict(repo);

    const result = runWithFakePnpm('sh', ['-e', huskyPreCommit]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /conflito/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  });
});
