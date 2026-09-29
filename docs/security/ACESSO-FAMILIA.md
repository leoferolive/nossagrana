# Acesso à família em HTTP e WebSocket

O `familiaId` enviado pelo cliente só é aceito quando o usuário autenticado tem
vínculo em `usuario_familia` e `familias.deleted_at` é nulo. O prehandler
`requireFamiliaScope` e a conexão `/api/ws` usam a mesma consulta de acesso.

| Situação                          | HTTP com `x-familia-id`                                                                                     | WebSocket `/api/ws`                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Membro de família ativa           | Acesso permitido                                                                                            | Conexão entra na sala da família                        |
| Membro de família excluída        | `403`, `{ "error": { "message": "Familia excluida", "code": "FAMILIA_EXCLUIDA" } }`                         | Fechamento `4004`, razão `Familia excluida`             |
| Usuário sem vínculo com a família | `403`, `{ "error": { "message": "Usuario sem acesso a familia informada", "code": "FAMILIA_SEM_ACESSO" } }` | Fechamento `4003`, razão `Usuario sem acesso a familia` |

`4001` continua indicando parâmetros ou token inválidos. O cliente não tenta
reconectar após `4003` ou `4004`.
