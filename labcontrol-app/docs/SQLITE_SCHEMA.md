# SQLite e fila offline

Tarefas: **MOB-03 e MOB-04**. Dependências: MOB-01, MOB-02, MOB-03 e BE-06.

## Fluxo escolhido: ocorrência de máquina

1. Na tela **Máquinas**, o usuário toca numa máquina. A lista vem da API ou, sem conexão, do cache SQLite.
2. Na tela **Nova ocorrência**, ele escolhe o tipo e preenche a descrição e a data.
3. Ao salvar, a ocorrência é gravada **primeiro no SQLite** com um UUID v4 e o status `pending`.
4. Em seguida o app tenta enviar para `POST /api/machine-events`. Sem conexão, a ocorrência continua `pending`.
5. A tela **Ocorrências** mostra o estado real de cada registro. A fila é reenviada ao abrir o app, ao voltar para ele, a cada 30 s e pelo botão **Sincronizar agora**.

## Banco

- Arquivo: `labcontrol.db` (`lib/offline/database.ts`, único ponto que abre o SQLite).
- Versão do schema: `PRAGMA user_version`. As migrações ficam em `lib/offline/schema.ts`, e cada uma leva o banco da versão N para a N + 1 dentro de uma transação.
- Regra: uma migração publicada nunca é editada. Para mudar o schema, crie uma migração nova no fim da lista.
- Se o banco estiver numa versão maior que a conhecida pelo app (downgrade), a abertura falha em vez de corromper os dados.

### Versão 1

#### `occurrences`

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | TEXT PK | sim | UUID v4 gerado no aparelho (`expo-crypto`) |
| `user_id` | TEXT | sim | Dono do registro. Toda consulta filtra por ele. |
| `machine_id` | TEXT | sim | Id da máquina na API |
| `machine_name` | TEXT | sim | Nome exibido, para a lista funcionar offline |
| `sector_id` | TEXT | sim | Setor da máquina |
| `sector_name` | TEXT | não | Nome do setor, quando conhecido |
| `event_type` | TEXT | sim | `failure`, `warning`, `maintenance` ou `note` |
| `description` | TEXT | sim | Texto digitado (5 a 1000 caracteres) |
| `occurred_at` | TEXT | sim | Data e hora da ocorrência, em ISO 8601 UTC |
| `sync_status` | TEXT | sim | `pending`, `syncing`, `synced` ou `failed` (CHECK) |
| `attempts` | INTEGER | sim | Número de tentativas de envio |
| `last_error` | TEXT | não | Última mensagem de erro (até 300 caracteres) |
| `server_id` | TEXT | não | Id devolvido pela API depois do envio |
| `created_at` / `updated_at` | TEXT | sim | Datas de criação e de última mudança (ISO) |
| `synced_at` | TEXT | não | Quando a API confirmou o recebimento |

Índice: `(user_id, sync_status, created_at)`, usado pela fila e pela contagem de pendentes.

#### `cache_entries`

| Coluna | Tipo | Descrição |
|---|---|---|
| `user_id` + `cache_key` | PK | Dono e chave do dado |
| `value_json` | TEXT | Resposta da API em JSON |
| `updated_at` | TEXT | Quando a cópia foi salva (ISO) |
| `expires_at` | INTEGER | Prazo, em milissegundos desde 1970 |

Dados permitidos no cache (`lib/offline/cacheStore.ts` recusa qualquer outra chave):

| Chave | Origem | Prazo |
|---|---|---|
| `plants` | `GET /plants` | 7 dias |
| `machines:<plantId>` | `GET /machines/plant/{id}` | 7 dias |
| `sectors:<plantId>` | `GET /sectors/plant/{id}` | 7 dias |

Ficam fora do cache: usuários, e-mails, token e qualquer dado pessoal (ver `POLITICA_DE_DADOS.md`).

### Versão 2

A migração v2 preserva todos os registros da v1, reconstrói a tabela `occurrences` para aceitar `conflict` e adiciona `retry_after_at` (ISO 8601 UTC). O estado `syncing` continua voltando para `pending` na abertura do app.

| Campo/estado | Regra |
|---|---|
| `retry_after_at` | Próximo instante permitido para retry automático; nulo quando não há backoff. |
| `conflict` | Resposta 409/412. Os dados locais ficam preservados e aguardam revisão explícita. |
| tentativas automáticas | Até 5 tentativas no total; backoff de 5, 10, 20 e 40 s. Depois, o registro vira `failed`. |
| retry manual | O botão **Sincronizar agora** antecipa o backoff; **Tentar enviar de novo** reinicia o contador de `failed`. |
## Estados de sincronização

| Resultado da tentativa | Estado local | Comportamento |
|---|---|---|
| HTTP 2xx | `synced` | Só confirma depois da resposta; limpa retry e erro. |
| Rede, timeout, 5xx, 408, 429 | `pending` | Para a fila no primeiro erro temporário e agenda backoff persistido. |
| 4xx permanente | `failed` | Sai do envio automático; **Tentar enviar de novo** exige ação do usuário. |
| HTTP 409/412 | `conflict` | Mantém os dados locais, mostra o erro e não reenvia sem ação explícita. |

- O retry automático tem limite de 5 tentativas totais. Os intervalos são 5, 10, 20 e 40 segundos; depois a ocorrência passa a `failed`.
- **Sincronizar agora** ignora o backoff. O retry de uma ocorrência `conflict` exige tocar em **Reenviar após revisar**.
- Se o app fechar durante o envio, `syncing` volta a `pending` na abertura. `retry_after_at` sobrevive ao reinício.
- A fila preserva a ordem de criação e para na primeira falha temporária.
- A sincronização dispara imediatamente quando a rede volta, ao retomar o app e a cada 30 s como fallback. Chamadas simultâneas compartilham a mesma execução.

## Contrato com a API

O backend atual (`CreateMachineEventDto`) aceita só `machineId`, `eventType` e `message`. Para não perder os campos do formulário, o app envia:

```json
{
  "machineId": "3f1c2a9e-0000-4000-8000-000000000001",
  "eventType": "failure",
  "message": "Vazamento de óleo.\n\nTipo: Falha | Setor: Usinagem (…) | Ocorrido em: 2026-10-30T13:05:00.000Z | Ref. app: <uuid>",
  "clientId": "<uuid>",
  "sectorId": "…",
  "description": "Vazamento de óleo.",
  "occurredAt": "2026-10-30T13:05:00.000Z"
}
```

`clientId`, `sectorId`, `description` e `occurredAt` são ignorados pelo backend atual. O cliente mantém o mesmo UUID em `clientId` e no header `Idempotency-Key` em todas as tentativas.

**Dependência BE-06: idempotência no servidor.** O código atual do backend não reconhece esses identificadores; enquanto o BE-06 não persistir e deduplicar a chave, uma resposta perdida após o commit ainda pode gerar evento duplicado no retry. O cliente envia o contrato estável, mas a ausência de duplicidade só pode ser comprovada depois da integração com o backend.

## Retenção e logout

| Situação | Ocorrências pendentes / com falha | Ocorrências enviadas | Cache |
|---|---|---|---|
| Abrir o app | mantidas | apagadas após 30 dias | vencido é apagado |
| Logout ou 401 | **mantidas**, visíveis só para o dono | apagadas | apagado |
| Login de outro usuário | mantidas, invisíveis para ele | — | o do usuário anterior é apagado |

As pendentes são mantidas no logout porque são trabalho que ainda não chegou ao servidor. Antes de sair, a tela de perfil avisa quantas existem.

## Evidências automatizadas

`npm test` roda o SQLite de verdade (sql.js) no lugar do módulo nativo, gravando um "arquivo" em memória a cada escrita. `simulateAppKill()` descarta a conexão e todo o estado dos módulos, como quando o sistema encerra o app.

| Critério | Teste |
|---|---|
| Formulário → SQLite preserva todos os campos, com UUID | `offlineDatabase.test.ts` › formulário → SQLite |
| Fechar e reabrir mantém o registro pendente | `offlineDatabase.test.ts` › fechar e reabrir o app; `offlineSync.test.ts` › pendente continua pendente depois de fechar e reabrir |
| Sem rede/backend: consulta o cache e cria ocorrência | `offlineCache.test.ts` › sem rede, o usuário consulta o cache e cria uma ocorrência pendente |
| Backend parado não mostra pendente como concluída | `offlineSync.test.ts` › backend parado (rede, 503, timeout) |
| Schema versionado | `offlineDatabase.test.ts` › schema SQLite |
| Token fora do SQLite | `offlineCache.test.ts` › o token nunca é gravado no arquivo SQLite |
| Migração v1 → v2 preserva a fila | `offlineDatabase.test.ts` › migra V1 para V2 sem perder pendências |
| Backoff, limite e conflito | `offlineSync.test.ts` › retries limitados e conflito explícito |
| Retomada automática após reconexão | `offlineSync.test.ts` › sincroniza automaticamente quando a rede volta |

O vídeo de demonstração segue o roteiro em `docs/ROTEIRO_VIDEO_OFFLINE.md`.


A matriz de cenários e as evidências de integração estão em `docs/MATRIZ_SYNC_OFFLINE.md`.
