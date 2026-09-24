// Fake do executável `pnpm` para testes que rodam o .husky/pre-commit real.
// Contrato substituído: o hook só chama `pnpm exec lint-staged`, que pode
// reformatar (prettier) e re-stagear arquivos staged, e sinaliza falha com
// exit code != 0. O lint-staged de verdade não existe nos repos temporários.
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function lintStagedRewriteLines({ file, appendLine }) {
  const quotedFile = shellQuote(file);
  return [
    'if [ "$1 $2" = "exec lint-staged" ]; then',
    `  printf '%s\\n' ${shellQuote(appendLine)} >> ${quotedFile} && git add ${quotedFile}`,
    'fi',
  ];
}

/**
 * `pnpm` falso num diretório temporário próprio. Registra cada chamada e,
 * com `lintStagedRewrite`, simula o prettier do lint-staged: acrescenta uma
 * linha ao arquivo (relativo ao cwd do hook) e dá `git add` nele.
 * Ex.:
 *   const pnpm = new FakePnpmExecutable({ lintStagedRewrite: { file: 'a.txt', appendLine: 'x' } });
 *   spawnSync('git', ['commit', '-m', 'm'], { env: { ...process.env, PATH: pnpm.pathWithFake() } });
 *   pnpm.calls(); // ['exec lint-staged']
 *   pnpm.cleanup();
 */
export class FakePnpmExecutable {
  #dir;
  #logPath;

  constructor({ lintStagedRewrite, exitCode = 0 } = {}) {
    this.#dir = mkdtempSync(join(tmpdir(), 'fake-pnpm-'));
    this.#logPath = join(this.#dir, 'calls.log');
    const binPath = join(this.#dir, 'pnpm');
    writeFileSync(binPath, this.#script(lintStagedRewrite, exitCode));
    chmodSync(binPath, 0o755);
  }

  #script(lintStagedRewrite, exitCode) {
    const lines = ['#!/bin/sh', `echo "$*" >> ${shellQuote(this.#logPath)}`];
    if (lintStagedRewrite) lines.push(...lintStagedRewriteLines(lintStagedRewrite));
    lines.push(`exit ${Number(exitCode)}`, '');
    return lines.join('\n');
  }

  /** PATH com o fake na frente, para passar no `env` do processo testado. */
  pathWithFake(basePath = process.env.PATH) {
    return `${this.#dir}${delimiter}${basePath}`;
  }

  /** Argumentos de cada chamada, na ordem (ex.: ['exec lint-staged']). */
  calls() {
    if (!existsSync(this.#logPath)) return [];
    return readFileSync(this.#logPath, 'utf8').trim().split('\n');
  }

  cleanup() {
    rmSync(this.#dir, { recursive: true, force: true });
  }
}
