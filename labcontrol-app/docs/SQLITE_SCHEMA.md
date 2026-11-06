# SQLite e fila offline

Tarefa: **MOB-03**. Dependências: MOB-01, MOB-02 e BE-05.

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

### Versão 2 (MOB-04)

A tabela `occurrences` é recriada, porque o SQLite não altera um `CHECK` existente. Todos os registros da v1 são copiados.

| Mudança | Descrição |
|---|---|
| `sync_status` | Aceita também `conflict` |
| `retry_count` | Falhas temporárias seguidas desde o último sucesso (base do backoff) |
| `next_attempt_at` | Quando a fila automática pode tentar de novo (ms desde 1970) |
| `needs_check` | `1` quando uma tentativa anterior pode ter chegado ao servidor. O app confere antes de reenviar. Na migração, vale `1` para pendentes que já tinham tentativa. |
| `local_version` | Aumenta a cada edição local; vai no POST como `clientVersion` |
| `conflict_json` | Versão do servidor guardada quando há conflito |

Estados, gatilhos, backoff, duplicidade e conflitos: `docs/MATRIZ_CENARIOS_OFFLINE.md`.

## Estados de sincronização (MOB-03)

> Atualizado no MOB-04: veja a máquina de estados completa, com `conflict` e a conferência antes do reenvio, em `docs/MATRIZ_CENARIOS_OFFLINE.md`.

```
            salvar               2xx
 (form) ──────────▶ pending ─────────▶ syncing ─────────▶ synced
                      ▲  ▲               │
   sem rede, timeout, │  └───────────────┘
   5xx, 408, 429, 401 │                  │ 4xx (400, 403, 404, 409, 422...)
                      │                  ▼
                      └─── usuário ─── failed
                         "tentar de novo"
```

- **Uma ocorrência só vira `synced` depois de uma resposta 2xx da API.** Nenhuma tela mostra "enviada" antes disso.
- Se o app for fechado no meio de um envio, o registro em `syncing` volta para `pending` na próxima abertura.
- A fila é enviada na ordem de criação. Na primeira falha temporária, o envio para (as próximas também falhariam) e é retomado depois.
- Chamadas simultâneas (botão + timer) compartilham a mesma execução, então nada é enviado duas vezes pelo app.

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

`clientId`, `sectorId`, `description` e `occurredAt` são ignorados pelo backend atual. Eles já estão no corpo para quando o **BE-05** aceitar esses campos.

**Resolvido no app (MOB-04):** antes de reenviar uma ocorrência com falha incerta, o app confere no servidor pelo `Ref. app` e não duplica. O POST também leva `Idempotency-Key` e `clientVersion`. Ver `docs/MATRIZ_CENARIOS_OFFLINE.md`.

**Texto original do MOB-03, mantido como histórico. Pendência no backend (BE-05): idempotência.** Se a API gravar a ocorrência e a resposta se perder no caminho (queda de rede depois do commit), o app reenvia e o servidor cria um evento duplicado. O UUID vai na mensagem (`Ref. app`) para que duplicatas possam ser identificadas. A correção definitiva é o BE-05 aceitar `clientId` e responder com o evento já existente quando ele se repetir.

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
