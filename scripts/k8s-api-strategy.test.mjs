import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// #118: tickets de WebSocket, eventBus e WebSocketManager vivem em memória de um único pod do API.
// Num rolling update o pod velho e o novo ficam atrás do mesmo Service; `Recreate` garante que só
// um pod do API receba tráfego por vez.
for (const ambiente of ['dev', 'prod']) {
  test(`k8s/${ambiente}/api-deployment.yaml usa Recreate (sem sobreposição de pods)`, () => {
    const manifesto = readFileSync(
      new URL(`../k8s/${ambiente}/api-deployment.yaml`, import.meta.url),
      'utf8',
    );

    assert.match(manifesto, /^ {2}strategy:\n {4}type: Recreate$/m);
    // `kubectl apply` falha ao sair de RollingUpdate se o bloco rollingUpdate não for anulado.
    assert.match(manifesto, /^ {4}rollingUpdate: null$/m);
    assert.match(manifesto, /^ {2}replicas: 1$/m);
  });
}
