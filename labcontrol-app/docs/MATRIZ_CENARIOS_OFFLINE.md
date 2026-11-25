# Matriz de cenários offline e de sincronização

Tarefa: **MOB-04**. Dependências: MOB-03 e BE-06 (labControl4-0/labcontrol-api#72, ainda aberto).

Esta matriz lista cada cenário de rede, o resultado esperado e o teste que o comprova. O código entre colchetes é o mesmo usado no nome do teste em `__tests__/syncWorker.test.ts`. Os cenários marcados **E2E** também rodam contra a API real, em `__tests__/e2e/backendSync.e2e.test.ts`.

## Estados da ocorrência

| Estado | Rótulo na tela | Significado | Sai dele quando |
|---|---|---|---|
| `pending` | Pendente: ainda não enviada | Na fila. Pode ter falhado antes. | O worker reserva para envio |
| `syncing` | Enviando... | Requisição em andamento | Resposta, falha ou app fechado |
| `synced` | Enviada ao servidor | Servidor confirmou (2xx) ou o app encontrou o evento lá | Não sai |
| `failed` | Erro: recusada pelo servidor | Recusa definitiva (4xx, exceto 408, 409 e 429) | Usuário toca "Tentar enviar de novo" ou edita |
| `conflict` | Conflito: escolha qual versão manter | O servidor tem outra versão (conteúdo diferente ou 409) | Usuário escolhe uma das duas resoluções |

```
           salvar                        2xx ou encontrado no servidor
 (form) ─────────▶ pending ──▶ syncing ─────────────────────────────────▶ synced
                    ▲   ▲         │
                    │   └─────────┤ rede, timeout, 5xx, 408, 429, 401, app fechado
                    │             │   (backoff; marca "conferir antes de reenviar")
                    │             ├──────────────▶ failed ── tentar de novo / editar ──┐
                    │             │   4xx                                              │
                    │             └──────────────▶ conflict                            │
                    │                 409 ou versão diferente no servidor              │
                    └──────────────────────────────────────────────────────────────────┘
                         conflict ── "manter a do servidor" ─────────────▶ synced
                         conflict ── "enviar a minha como nova" ─▶ synced + nova pending
```

## Gatilhos de sincronização

| Gatilho | Respeita backoff e limite? | Onde |
|---|---|---|
| Abertura do app, volta ao app, timer de 30 s | Sim | `startAutoSync()` |
| Conexão volta (offline → online) | Não | `startReconnectSync()` com `expo-network` |
| Botão "Sincronizar agora", salvar ou editar uma ocorrência | Não | Telas Ocorrências e Nova ocorrência |

Retry: espera de 5 s, 10 s, 20 s, 40 s... até 10 min (`lib/offline/syncPolicy.ts`). Depois de 6 falhas seguidas, o timer para de tentar aquela ocorrência. Ela **continua pendente** e volta a ser enviada na reconexão ou no botão manual.

## Como a duplicidade é evitada

O problema: a API grava o evento, mas a resposta se perde (timeout, queda de rede, app fechado no meio). Se o app reenviasse às cegas, o servidor teria dois eventos.

1. Toda falha em que o servidor **pode** ter gravado (timeout, rede, 5xx, app fechado durante o envio) marca a ocorrência com `needs_check = 1`.
2. Antes de reenviar uma ocorrência marcada, o app chama `GET /machine-events/machine/{machineId}` e procura o UUID dela (`Ref. app: <uuid>` na mensagem, ou `clientId` quando o BE-06 existir).
3. Se encontrar com o mesmo conteúdo: marca como `synced` sem novo POST.
4. Se encontrar com conteúdo diferente (o usuário editou depois do envio incerto): vira `conflict`.
5. Se não encontrar: faz o POST.
6. Se a conferência falhar (sem rede): **não reenvia** e continua pendente.

O POST também leva `Idempotency-Key: <uuid>` e `clientId`, para o BE-06 deduplicar no servidor.

## Como o conflito é tratado

O app nunca sobrescreve a versão do servidor nem descarta a local sem o usuário escolher. A tela Ocorrências mostra as duas versões lado a lado:

- **Manter a do servidor:** a edição local é descartada, por escolha explícita, e a ocorrência fica como enviada.
- **Enviar a minha como nova:** a versão local ganha um UUID novo e é enviada como outra ocorrência. O servidor fica com as duas.

Enquanto está em conflito, a ocorrência sai da fila: nem o timer, nem a reconexão, nem o botão manual a reenviam.

## Matriz

| Código | Cenário | Resultado esperado | Teste | Situação |
|---|---|---|---|---|
| R1 | Rede volta, com vários avisos seguidos (oscilando) | Cada pendência enviada **uma vez**; avisos seguintes de "conectado" não disparam envio | `syncWorker` [R1] | Passa |
| R2 | App abre já online | O estado inicial não dispara envio sozinho | `syncWorker` [R2] | Passa |
| R3 | Rede volta e cai de novo em menos de 1,5 s | Nenhum envio | `syncWorker` [R3] | Passa |
| R4 | Rede volta durante um envio que vai falhar | O pedido da reconexão não se perde: roda uma vez depois e envia uma vez | `syncWorker` [R4] | Passa |
| R5 | Três toques seguidos em "Sincronizar agora" | Um envio | `syncWorker` [R5] | Passa |
| P1 | 3 pendentes, servidor responde 503 na 2ª | 1ª enviada; 2ª e 3ª pendentes; na repetição, todas uma vez | `syncWorker` [P1] | Passa |
| P2 | 2 pendentes, servidor recusa a 1ª (400) | 1ª em erro, 2ª enviada | `syncWorker` [P2] | Passa |
| P3 | Backend cai no meio da fila | As restantes ficam pendentes | `syncWorker` [P3] | Passa |
| D1 | Timeout depois de o servidor gravar | Continua pendente; na repetição, encontra no servidor e **não reenvia** | `syncWorker` [D1] e **E2E** | Passa |
| D2 | Timeout antes de gravar | A conferência não encontra; envia uma vez | `syncWorker` [D2] | Passa |
| D3 | Conferência falha por falta de rede | Não reenvia às cegas | `syncWorker` [D3] | Passa |
| D4 | Envio normal | POST com `Idempotency-Key` e `clientId` iguais ao UUID | `syncWorker` [D4] | Passa |
| I1 | App fechado pelo sistema durante o envio | Ao reabrir, volta para pendente, confere e não duplica | `syncWorker` [I1] | Passa |
| I2 | App fechado com pendências e backend parado | Ao reabrir com o backend de volta, envia cada uma uma vez | `syncWorker` [I2] | Passa |
| I3 | **Backend reiniciado** com pendências no app | Pendências enviadas, `synced` no app e gravadas no banco uma vez; continuam lá depois de outro reinício do backend | **E2E** | Passa |
| B1 | Falha temporária | Timer espera o backoff; reconexão e botão ignoram | `syncWorker` [B1] | Passa |
| B2 | Falhas seguidas | Espera dobra até 10 min | `syncWorker` [B2] | Passa |
| B3 | 6 falhas seguidas | Timer para, ocorrência continua pendente; reconexão envia | `syncWorker` [B3] | Passa |
| C1 | Edição local depois de um envio incerto, servidor com a versão antiga | Vira `conflict`; servidor não é alterado; edição local preservada | `syncWorker` [C1] | Passa |
| C2 | Em conflito | Nenhum gatilho reenvia | `syncWorker` [C2] | Passa |
| C3 | Resolver: manter a do servidor | Local passa a ser igual ao servidor, `synced` | `syncWorker` [C3] | Passa |
| C4 | Resolver: enviar a minha como nova | Servidor fica com as duas, cada uma uma vez | `syncWorker` [C4] | Passa |
| C5 | Servidor responde 409 | Vira `conflict` com a versão do servidor | `syncWorker` [C5] | Passa |
| C6 | Editar durante o envio ou depois de enviada | Edição recusada | `syncWorker` [C6] | Passa |
| C7 | Editar antes do envio | Vai a versão nova (`clientVersion: 2`) | `syncWorker` [C7] | Passa |
| M1 | Banco do MOB-03 (schema v1) | Migra para v2 sem perder registros; pendentes já tentadas ficam para conferir | `schemaMigration` | Passa |

## Testes ponta a ponta com a API real

`__tests__/e2e/backendSync.e2e.test.ts` usa os módulos reais do app (fila, SQLite, `apiFetch`) contra o processo real da API (`LabControlApi.dll`) e um Postgres. O teste:

- liga, **derruba** e **religa** o processo da API (I3);
- coloca um proxy local entre o app e a API que, no cenário D1, deixa a API gravar e só devolve a resposta depois do timeout do app;
- confere no banco, pela API, quantas vezes cada UUID foi gravado.

Fica desligado no `npm test`. Para rodar, num **banco descartável**:

```powershell
# 1. Postgres descartável (outro terminal)
docker run --rm --name labcontrol-e2e-db -e POSTGRES_DB=labcontroldb -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin -p 55433:5432 postgres:15

# 2. API compilada
gh repo clone labControl4-0/labcontrol-api $env:TEMP\labcontrol-api-e2e -- --depth 1
dotnet build $env:TEMP\labcontrol-api-e2e\LabControlApi.csproj -o $env:TEMP\labcontrol-api-e2e\out

# 3. Teste
$env:E2E_API_DLL = "$env:TEMP\labcontrol-api-e2e\out\LabControlApi.dll"
$env:E2E_DB_CONNECTION = "Host=127.0.0.1;Port=55433;Database=labcontroldb;Username=admin;Password=admin"
npm run test:e2e
```

O backend do projeto é a API em ASP.NET Core com Postgres e continua assim. A issue cita Spring porque o BE-05/BE-06 vêm da disciplina de Java/Spring; a evidência de "dado persistido" é feita na API .NET.

### Resultado registrado (4/11/2026, banco recém-criado, dados sintéticos)

```
PASS __tests__/e2e/backendSync.e2e.test.ts
  E2E com a API real
    √ backend parado: pendências sobrevivem ao app e ao backend reiniciados e são gravadas uma vez
    √ timeout depois de gravar: repetir não duplica o evento no servidor
```

Consulta direta no Postgres depois do teste:

```
               ref_app                |         descricao         | gravacoes
--------------------------------------+---------------------------+-----------
 342c1619-0815-4a13-817f-e595db272b9c | E2E A 1793849585918       |         1
 74ec89f4-0474-40c8-8d66-e191cd19b51a | E2E B 1793849585918       |         1
 8452acb2-1e5e-4f6d-b9dc-1b19608ea654 | E2E C 1793849585918       |         1
 7f5d6a96-f755-4621-978d-5d7d3722871c | E2E timeout 1793849585918 |         1
 refs duplicadas: 0
```

## Prova de que os testes pegam erros de verdade

Dois erros foram inseridos de propósito e desfeitos depois:

| Erro inserido | Testes que falharam |
|---|---|
| Reenviar sem conferir no servidor | D1, I1, C1, C3, C4 e o **E2E de timeout** (6 testes) |
| Cada pedido de sincronização roda em paralelo, sem coalescer | R4 |

## Limitações

- **A conferência depende do texto da mensagem.** Como a API atual não guarda `clientId`, o app procura o UUID no fim da `message`. Se alguém editar a mensagem no servidor removendo o `Ref. app`, a conferência não acha o evento. A correção é o BE-06 guardar `clientId` e aplicar a `Idempotency-Key`; o app já envia os dois e já procura por `clientId` primeiro.
- **Custo da conferência:** uma consulta extra por ocorrência que teve falha incerta. A consulta traz todos os eventos da máquina; com milhares de eventos, o BE-06 deveria oferecer uma busca por `clientId`.
- **Conflito por edição concorrente no servidor** não existe hoje: a API não tem rota para editar eventos. O app já trata o 409 que o BE-06 deve devolver.
- **Exclusões** (critério do BE-06) não fazem parte deste fluxo: o app só cria ocorrências.
- **Teste em aparelho:** a reconexão real (modo avião) depende do `expo-network` no aparelho e não foi testada fora do Jest.
