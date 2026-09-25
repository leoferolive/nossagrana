/**
 * Idempotency-Key (#90): o ponto de submit gera UMA chave por envio e a
 * repassa ao service. O servidor deduplica a MESMA requisição reenviada com a
 * mesma chave (retentativa de infraestrutura/proxy ou cliente que reusa a
 * chave). Hoje os modais fecham antes do resultado, então um novo clique do
 * usuário após falha gera chave nova — a deduplicação ponta a ponta desse
 * reenvio depende da #96 (modal aguarda o resultado e reusa a chave até o
 * sucesso). O `ApiClient` só repete após 401, barrado antes de reservar a chave.
 */
export function novaChaveIdempotencia(): string {
  // randomUUID só existe em contexto seguro (HTTPS/localhost); em HTTP puro lançaria TypeError.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return uuidV4ComGetRandomValues();
}

/** UUID v4 (RFC 9562) a partir de 16 bytes aleatórios: versão 4 e variante 10xx. */
function uuidV4ComGetRandomValues(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Header a mesclar no request; sem chave, nada (o servidor não deduplica). */
export function cabecalhoIdempotencia(chave: string | undefined): Record<string, string> {
  return chave ? { 'Idempotency-Key': chave } : {};
}
