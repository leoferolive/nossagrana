# PostgreSQL — NossaGrana

## Criar Secret (obrigatório antes do primeiro deploy)

O secret `nossagrana-postgres-secrets` deve ser criado manualmente no cluster.
**Nunca** commitar o secret no repositório.

```bash
kubectl create secret generic nossagrana-postgres-secrets \
  --namespace nossagrana \
  --from-literal=POSTGRES_USER=nossagrana \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  --from-literal=POSTGRES_DB=nossagrana
```

## Verificar secret existente

```bash
kubectl get secret nossagrana-postgres-secrets -n nossagrana -o yaml
```
