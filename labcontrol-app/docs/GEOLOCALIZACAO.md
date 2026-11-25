# Geolocalização e mapas

Adaptação do material "Expo e Java: Geolocalização e Mapas" ao LabControl. O material usa uma entidade didática `Location` com backend Java/H2. Aqui o backend é a API ASP.NET do LabControl, e as coordenadas foram associadas aos modelos que já existem: **máquina** e **ocorrência**.

## O que a coordenada representa

| Dado | Significado | Onde fica |
|---|---|---|
| Posição atual | Onde o usuário está agora | Só na memória da tela do mapa. Não é gravada nem enviada. |
| Posição da máquina | Onde o equipamento está | API (quando tiver os campos) ou SQLite `machine_locations` |
| Posição da ocorrência | Onde o técnico estava ao registrar | SQLite `occurrences` e, no envio, a API |

## Telas

**Mapa das máquinas** (`app/(tabs)/MachineMap`), aberto pelo botão "Ver no mapa" na tela Máquinas:

1. **Minha localização**: pede a permissão e mostra a posição (marcador azul), a precisão e o círculo de precisão.
2. **Carregar máquinas**: lista as máquinas da API (com o cache offline já existente) e junta com as posições fixadas no aparelho. Cores por status: verde ativo, laranja atenção, vermelho erro, cinza inativo.
3. **Fixar aqui**: com o usuário junto da máquina, grava a posição dela. Avisa quando a precisão passa de 50 m.
4. **Distância**: Haversine, em linha reta, da mais próxima para a mais distante.
5. **Máquinas de exemplo**: interruptor com 5 máquinas fictícias (Torno CNC, Fresadora, Impressora 3D, Compressor, Estufa), uma para cada status, a 47 m, 69 m, 144 m, 155 m e 1,1 km. Ficam ao redor da primeira posição obtida, ou do ponto fictício do material (-23.5003, -47.4582). Nunca são enviadas à API.

**Nova ocorrência**: interruptor "Anexar minha localização", **desligado por padrão**. Se a localização falhar (permissão negada, GPS desligado, mais de 20 s), a tela explica o motivo e a ocorrência pode ser salva sem ela.

**Ocorrências**: quem tem localização mostra as coordenadas e o link "Ver no mapa" (marcador roxo).

## Mapa: OpenStreetMap + Leaflet

Sem chave do Google Maps e sem cartão, como no material.

- Android/iOS: `components/geo/LocationMap.tsx`, uma WebView com Leaflet 1.9.4 (unpkg, com hash SRI) e tiles do OpenStreetMap. Os dados entram por `injectJavaScript`.
- Web: `components/geo/LocationMap.web.tsx`, Leaflet do npm direto no navegador. A importação é dinâmica porque o app gera páginas estáticas.
- Os popups usam `textContent`. Nomes vindos da API nunca são tratados como HTML.
- Sem internet não há mapa-base. A tela avisa, e a lista com coordenadas e distâncias continua funcionando.
- Atribuição do OpenStreetMap sempre visível. Não há download de tiles em massa nem mapa offline. Em produção, avaliar um serviço de tiles com capacidade e condições adequadas.

## Envio para a API

A API atual guarda só `machineId`, `eventType` e `message` no evento. A localização da ocorrência vai:

- em campos próprios no POST (`latitude`, `longitude`, `locationAccuracy`), ignorados hoje e prontos para o backend;
- dentro da `message`, antes da referência do app: `... | Local: -23.500300, -47.458200 (±8 m) | Ref. app: <uuid>`.

Ocorrências sem localização mandam exatamente o mesmo corpo de antes.

## Pendências no backend (sugestão, não implementado)

1. `Machine`: `latitude` e `longitude` (decimal, opcionais, validados na faixa). O app já lê esses campos de `GET /machines/plant/{id}` e dá prioridade a eles sobre a posição fixada no aparelho.
2. `MachineEvent`: `latitude`, `longitude` e `locationAccuracy` opcionais em `CreateMachineEventDto`, com HTTP 400 fora da faixa.
3. Endpoint para gravar a posição de uma máquina, para que "Fixar aqui" deixe de ser só local.

## Privacidade

- A localização só é lida por ação explícita: botão ou interruptor. Não existe rastreamento em segundo plano. O `app.json` desliga a localização em segundo plano e remove as permissões "Always" do iOS.
- A posição atual não sai da tela do mapa.
- A posição na ocorrência é dado pessoal do técnico. Só é registrada com o interruptor ligado e segue a mesma retenção das ocorrências (`docs/SQLITE_SCHEMA.md`).

## Testes

`npm test` cobre:

| Arquivo | O que verifica |
|---|---|
| `geoDistance.test.ts` | Haversine, faixas válidas, formatação, deslocamento |
| `geoLocation.test.ts` | Permissão concedida, negada ou bloqueada, GPS desligado, timeout de 20 s, coordenada inválida |
| `geoMachines.test.ts` | Prioridade API > aparelho, ordenação por distância, máquinas de exemplo |
| `geoMap.test.ts` | Cores, pontos, escape do script injetado, página Leaflet (SRI, sem `innerHTML`) |
| `geoPersistence.test.ts` | SQLite (salvar, substituir, isolar por usuário, `CHECK`), localização na ocorrência e no POST |
| `schemaMigration.test.ts` | Migração v1 → v3 sem perder ocorrências |

O teste no aparelho continua manual. Ver o roteiro abaixo.

### Roteiro no aparelho (Expo Go ou development build)

1. Máquinas → Ver no mapa → Minha localização → permitir. Conferir o marcador azul e a precisão.
2. Conferir as 5 máquinas de exemplo e a "Mais próxima".
3. Numa máquina real sem posição, tocar em "Fixar aqui". Fechar e reabrir o app e conferir que a posição continua.
4. Nova ocorrência → ligar "Anexar minha localização" → salvar. Em Ocorrências, tocar em "Ver no mapa".
5. Negar a permissão, desligar o GPS e ficar sem internet: a tela deve explicar cada caso sem travar.
