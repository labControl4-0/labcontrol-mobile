# Roteiro do vídeo de teste offline (MOB-03)

Duração sugerida: 3 a 4 minutos. Grave a tela do celular ou do emulador. Use uma conta e dados sintéticos e não mostre e-mail real, senha ou a URL do servidor.

## Preparação

1. Instale a versão da branch no aparelho e configure o `.env` (ver README).
2. Entre com uma conta de teste que tenha pelo menos um laboratório com máquinas.
3. Abra a tela **Máquinas** uma vez **com internet**, para o app salvar o cache.

## Cenas

| # | Ação | O que precisa aparecer |
|---|---|---|
| 1 | Com internet, abra **Máquinas**. | A lista de máquinas, sem aviso de offline. |
| 2 | Ligue o **modo avião** (ou pare o backend). | — |
| 3 | Feche e abra a tela **Máquinas** de novo. | A mesma lista e o aviso amarelo "Sem conexão com o servidor. Mostrando dados salvos em …". |
| 4 | Toque numa máquina e preencha tipo, descrição e data. Toque em **Salvar ocorrência**. | O aviso "Salva no aparelho: envio pendente". |
| 5 | Na tela **Ocorrências**, mostre o registro. | Máquina, setor, tipo, descrição e data iguais aos digitados, e o status **"Pendente: ainda não enviada"**. Nunca "Enviada". |
| 6 | Toque em **Sincronizar agora**, ainda offline. | "Sem conexão com o servidor", e o registro continua **Pendente**. |
| 7 | **Feche o app** pelo seletor de apps (deslizar para fechar) e abra de novo, ainda offline. | Na tela **Ocorrências**, o registro continua lá, **Pendente**, com os mesmos campos. |
| 8 | Desligue o modo avião (ou suba o backend). Toque em **Sincronizar agora** ou espere até 30 s. | O status muda para **"Enviada ao servidor"**. |
| 9 | (Opcional) Mostre o evento na API, por exemplo em `GET /api/machine-events/machine/{id}` no API Tester. | O evento com a mesma descrição e a `Ref. app` igual ao UUID mostrado no app. |

## Como provar "backend parado" além do modo avião

Com a internet ligada, pare o backend (ou aponte o `EXPO_PUBLIC_API_URL` para um endereço sem servidor). Repita as cenas 4 a 6. A ocorrência precisa continuar **Pendente**.

## Onde anexar

Anexe o vídeo na issue #4 e no PR do MOB-03.
