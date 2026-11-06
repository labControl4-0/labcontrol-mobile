# MOB-08 — validação das telas e estados

## Contratos usados

A interface consome os endpoints disponíveis na API ASP.NET:

- `GET /api/plants`
- `GET /api/machines/plant/{plantId}`
- `GET /api/machine-events/machine/{machineId}`

Os eventos usam `MachineEventResponseDto`: `id`, `machineId`, `eventType`, `message`, `createdAt` e `resolvedAt`. Os dados de plantas e máquinas usam o cache local existente. Eventos continuam dependendo de resposta da API.

## Matriz de cenários

| Cenário | Resultado esperado | Evidência a anexar |
| --- | --- | --- |
| Carregamento inicial | Indicador de carregamento no painel, alertas e mapa | Captura de cada tela durante carregamento |
| Resposta válida com dados | Painel mostra contagem real de plantas, máquinas e eventos abertos; eventos exibem máquina e planta; mapa mostra setor e máquinas | Capturas com dados sintéticos |
| Resposta válida vazia | Mensagem de estado vazio; contagens zero somente após resposta bem-sucedida vazia | Capturas do painel e alertas |
| Falha de API ou sessão | Mensagem de erro e ação de tentar novamente; nenhuma falha é convertida em contagem vazia | Captura com rede/API indisponível |
| Catálogo vindo do cache | Aviso informa que parte do catálogo veio da cópia local e sua data | Captura em modo offline |
| Toque em uma máquina | Leitor de tela anuncia máquina e status; detalhes mostram planta, setor, status e posição | Gravação curta usando TalkBack |
| Toque em um evento | Abre o mapa da planta correta e o marcador pode ser aberto para conferir máquina e setor | Gravação alerta → planta → máquina |

## Limites conhecidos para comprovação

- A tela não exibe energia ou temperatura agregadas. O DTO atual de métrica expõe leituras genéricas (`Name`, `Value`, `Timestamp`) por máquina; a consulta agregada está relacionada à dependência BE-09 (#75). Os valores antigos de demonstração foram removidos para não apresentar métricas inventadas.
- Se a API de eventos falhar, o painel e a lista de alertas exibem erro. Eventos ainda não fazem parte da política de cache local.
- Esta alteração não inclui capturas feitas em Android nem aceite do usuário. Anexar essas evidências após executar os cenários com dados sintéticos e obter a validação da equipe.

## Registro de execução

| Verificação | Estado |
| --- | --- |
| Inspeção estática dos contratos e alterações | Concluída |
| Execução em dispositivo Android | Pendente |
| Capturas reais das telas | Pendente |
| Aceite do usuário/equipe | Pendente |
