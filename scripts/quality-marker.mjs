// Marcador de "pnpm quality passou para este conteúdo staged".
// O hash vem de `git write-tree` (árvore do índice), então qualquer mudança
// staged depois do gate invalida o marcador. O diretório vem de
// `git rev-parse --git-path`, que é por worktree.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Não rastreados aqui podem ser importados pelo código testado e ficar fora
// do commit; em outros caminhos (docs/, planilha/) apenas avisamos.
const BLOCKING_UNTRACKED_PREFIXES = ['apps/', 'packages/', 'scripts/'];
const MAX_LISTED_FILES = 5;
const CONFLICT_REASON =
  'o índice tem conflitos não resolvidos (git write-tree falhou); resolva o conflito e dê `git add`';

function runGit(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function gitOutput(cwd, args) {
  const result = runGit(cwd, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} falhou em ${cwd}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/** Hash da árvore do índice, ou null se o índice estiver em conflito. */
function currentTreeHash(cwd) {
  const result = runGit(cwd, ['write-tree']);
  return result.status === 0 ? result.stdout.trim() : null;
}

function markerDir(cwd) {
  return resolve(cwd, gitOutput(cwd, ['rev-parse', '--git-path', 'quality-gate']));
}

function hasUnstagedChanges(cwd) {
  return runGit(cwd, ['diff', '--quiet']).status !== 0;
}

function listUntracked(cwd) {
  const output = gitOutput(cwd, ['ls-files', '--others', '--exclude-standard']);
  return output ? output.split('\n') : [];
}

function formatFileList(files) {
  const listed = files.slice(0, MAX_LISTED_FILES).join(', ');
  const rest = files.length - MAX_LISTED_FILES;
  return rest > 0 ? `${listed} (+${rest})` : listed;
}

function splitUntracked(cwd) {
  const untracked = listUntracked(cwd);
  const isBlocking = (file) => BLOCKING_UNTRACKED_PREFIXES.some((p) => file.startsWith(p));
  return {
    blocking: untracked.filter(isBlocking),
    other: untracked.filter((file) => !isBlocking(file)),
  };
}

function untrackedWarnings(files) {
  if (files.length === 0) return [];
  return [`arquivos não rastreados fora do commit (não bloqueia): ${formatFileList(files)}`];
}

function blockingReason(cwd, blockingUntracked) {
  if (hasUnstagedChanges(cwd)) {
    return (
      'há mudanças não staged em arquivos rastreados; rode `git add` antes do `pnpm quality` ' +
      'para que o marcador corresponda ao conteúdo testado'
    );
  }
  if (blockingUntracked.length > 0) {
    return (
      `há arquivos não rastreados em ${BLOCKING_UNTRACKED_PREFIXES.join(', ')} que o gate pode ` +
      `ter usado mas ficariam fora do commit: ${formatFileList(blockingUntracked)}; ` +
      'dê `git add` neles (ou remova-os) e rode `pnpm quality` de novo'
    );
  }
  return undefined;
}

/**
 * Fotografa o índice: hash da árvore, motivo que impede o marcador (se houver)
 * e avisos. Nunca lança — erros viram `reason`.
 * Ex.: const inicio = captureIndexState(process.cwd()); // antes das etapas do gate
 */
export function captureIndexState(cwd) {
  try {
    const treeHash = currentTreeHash(cwd);
    if (treeHash === null) return { treeHash, reason: CONFLICT_REASON, warnings: [] };
    const { blocking, other } = splitUntracked(cwd);
    return { treeHash, reason: blockingReason(cwd, blocking), warnings: untrackedWarnings(other) };
  } catch (error) {
    return { treeHash: null, reason: error.message, warnings: [] };
  }
}

/**
 * Caminho do marcador para uma árvore do índice.
 * Ex.: markerPathFor(process.cwd(), 'abc123') → '<git-dir>/quality-gate/abc123'
 */
export function markerPathFor(cwd, treeHash) {
  return join(markerDir(cwd), treeHash);
}

function refusalFor(initialState, finalState) {
  if (initialState.reason) return initialState.reason;
  if (finalState.treeHash !== initialState.treeHash) {
    return 'o índice mudou durante o gate; rode `pnpm quality` de novo com o conteúdo final staged';
  }
  return finalState.reason;
}

/**
 * Grava o marcador se o índice estava limpo no início do gate e continua
 * igual no fim. Sem `initialState`, usa o estado atual.
 * Retorna { recorded, treeHash, reason?, warnings }.
 */
export function recordQualityMarker(cwd, initialState = captureIndexState(cwd)) {
  const finalState = captureIndexState(cwd);
  const reason = refusalFor(initialState, finalState);
  const base = { treeHash: finalState.treeHash, warnings: finalState.warnings };
  if (reason) return { ...base, recorded: false, reason };
  mkdirSync(markerDir(cwd), { recursive: true });
  writeFileSync(markerPathFor(cwd, finalState.treeHash), `${new Date().toISOString()}\n`);
  return { ...base, recorded: true };
}

function describeOutcome(outcome) {
  const warnings = outcome.warnings.map((line) => `⚠ ${line}.`);
  if (!outcome.recorded) {
    return [...warnings, `⚠ Marcador do quality gate NÃO gravado: ${outcome.reason}.`];
  }
  return [...warnings, `Marcador do quality gate gravado para a árvore ${outcome.treeHash}.`];
}

/**
 * Passo final do `pnpm quality`: grava o marcador fora do CI e devolve as
 * linhas a imprimir. Nunca lança — o gate não pode falhar por causa disso.
 */
export function finalizeGateMarker({ cwd, isCI, initialState }) {
  // No CI não há commit e os testes Web não rodam.
  if (isCI) return { recorded: false, messages: [] };
  try {
    const outcome = recordQualityMarker(cwd, initialState);
    return { recorded: outcome.recorded, messages: describeOutcome(outcome) };
  } catch (error) {
    return {
      recorded: false,
      messages: [`⚠ Marcador do quality gate NÃO gravado: ${error.message}.`],
    };
  }
}

/**
 * Verifica se `pnpm quality` passou para o conteúdo staged atual.
 * Retorna { ok, reason? }; nunca lança.
 */
export function checkQualityMarker(cwd) {
  try {
    const treeHash = currentTreeHash(cwd);
    if (treeHash === null) return { ok: false, reason: CONFLICT_REASON };
    if (existsSync(markerPathFor(cwd, treeHash))) return { ok: true };
    return { ok: false, reason: '`pnpm quality` não passou para o conteúdo staged atual' };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}
