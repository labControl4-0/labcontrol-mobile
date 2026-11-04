# Matriz de sincronização offline (MOB-04)

Dados de teste devem ser sintéticos. O worker mantém a ordem da fila, limita retries e preserva qualquer ocorrência que a API não confirmou.

| Cenário | Preparação/ação | Resultado esperado | Cobertura |
|---|---|---|---|
| Reconexão | Iniciar sem rede; restaurar a rede; emitir estado conectado | Um envio imediato; o lock evita uma segunda execução concorrente | `offlineSync.test.ts` — reconexão automática |
| Falha parcial | 2xx na primeira ocorrência e 503 na segunda | Primeira `synced`; segunda e posteriores continuam pendentes; a fila para no 503 | `offlineSync.test.ts` — falha parcial |
| Backoff | Repetir timeout/5xx | Retry agendado para 5, 10, 20 e 40 s; respeitar `retry_after_at` | `offlineSync.test.ts` — backoff |
| Limite | Falhar em cinco tentativas totais | Estado `failed`, sem novas tentativas automáticas; retry manual reinicia o contador | `offlineSync.test.ts` — limite |
| Conflito | API responde 409 ou 412 | Estado `conflict`; payload local e erro preservados; nenhum retry automático; ação **Reenviar após revisar** inicia nova tentativa | `offlineSync.test.ts` — conflito |
| Reinício | Encerrar o app com fila pendente/backoff | SQLite preserva ocorrência, tentativas e horário agendado; ao abrir, segue o agendamento | `offlineDatabase.test.ts` — migração e reabertura; `offlineSync.test.ts` — backoff após reinício |
| Timeout após commit | API persiste e perde a resposta; o app repete a operação | O mesmo UUID continua em `clientId` e `Idempotency-Key`; o backend deve retornar o mesmo evento sem duplicar | Dependente do BE-06 e de teste de integração |

## Evidência de integração pendente

- O BE-06 (#72) continua aberto e precisa implementar a chave de idempotência e o resultado explícito de conflito. Até isso estar disponível, os testes do app comprovam que o cliente mantém uma chave estável; eles não comprovam deduplicação no servidor.
- A issue BE-06 descreve Java/Spring, mas o branch `main` atual de `labcontrol-api` contém controller e service ASP.NET Core em `Controllers/MachineEventsController.cs` e `Services/MachineEventService.cs`. Confirmar qual backend será usado antes de gravar a prova de persistência.
- Depois da integração, registrar o ID `clientId`, a resposta após timeout/replay e a consulta do evento persistido no backend. Não marcar o critério de não duplicidade como concluído antes dessa verificação.

## Roteiro manual

1. Criar duas ocorrências de teste no mesmo usuário.
2. Desconectar a rede e confirmar que ambas ficam pendentes.
3. Reconectar; confirmar que a fila envia em ordem e que cada item recebe apenas um resultado confirmado.
4. Repetir com resposta 503 após a primeira operação; confirmar que a parcial concluída permanece enviada e as demais continuam pendentes.
5. Fazer a API responder 409; conferir estado `conflict`, mensagem exibida e ausência de reenvio automático.
6. Após BE-06, simular timeout depois do commit e repetir a mesma chave; consultar o backend e comprovar um único evento.
