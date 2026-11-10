import { describe, expect, it } from 'vitest';

import { assertNodeEnvDoServidor } from './node-env-servidor.js';

describe('assertNodeEnvDoServidor', () => {
  it.each(['development', 'production'])('aceita %s', (valor) => {
    expect(() => assertNodeEnvDoServidor(valor)).not.toThrow();
  });

  it('recusa test com mensagem acionável (recebido e esperado)', () => {
    expect(() => assertNodeEnvDoServidor('test')).toThrow(
      'NODE_ENV inválido para o servidor: recebido "test", esperado development|production',
    );
  });
});
