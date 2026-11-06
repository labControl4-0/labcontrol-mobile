# Matriz de push e navegação (MOB-06)

Use uma conta e eventos sintéticos nos testes. O destino sempre é a tela interna fixa /NotificationEvent; o payload nunca fornece uma URL.

| Cenário | Preparação/ação | Resultado esperado | Cobertura |
|---|---|---|---|
| Primeiro plano | App aberto; receber push válido | Banner nativo e aviso no app; nenhum detalhe abre até o clique | pushNavigation.test.ts — recebimento em primeiro plano |
| Segundo plano | App no background; tocar no push | Abre o detalhe após validar payload e sessão | pushNavigation.test.ts — response listener |
| App encerrado | Encerrar o app; tocar no push | Response inicial é lido, navega uma vez e é limpo | pushNavigation.test.ts — response inicial |
| Payload inválido | Categoria desconhecida, ID inválido ou payload com URL | Nenhuma navegação; resposta inválida é descartada | pushNavigation.test.ts — validação do payload |
| Evento de outra máquina/ID/categoria | API retorna eventos autorizados para a máquina do payload | Só abre se ID, machineId e categoria coincidirem | pushNavigation.test.ts — evento autorizado |
| Sessão encerrada | Tocar num push antigo após logout | Não abre detalhes; encaminha para login | pushNavigation.test.ts — sessão ausente |
| Logout | Sair da conta com aparelho registrado | MOB-05 chama DELETE /api/devices/{pushToken} antes de limpar a sessão; falha de rede não impede logout | pushNotifications.test.ts — remoção no logout |
| Push remoto no Android | BE-07 envia via Expo Push Service e FCM a um token real | Push recebido, clique abre o evento autorizado e mostra categoria, ID e origem | Evidência manual necessária |

## Contrato de payload proposto ao BE-07

<pre>{
  "categoria": "failure",
  "avisoId": "2e1a1e01-6cb0-4c5e-8c49-5f35ee6ec121",
  "machineId": "3f1c2a9e-0000-4000-8000-000000000001",
  "origem": "machine-events"
}</pre>

machineId complementa os campos mínimos da issue BE-07 porque a API existente só oferece consulta autorizada por máquina (GET /api/machine-events/machine/{machineId}). O app usa avisoId para selecionar o evento dentro dessa resposta; ele não confia no ID para conceder acesso.

## Roteiro de evidência manual

1. Gere e instale um Android development build com Firebase/FCM configurado; Expo Go não recebe push remoto no Android.
2. Ative a permissão e confirme o token mascarado e o registro do aparelho no backend.
3. Com o app em primeiro plano, envie push de teste com o contrato acima e toque no banner.
4. Repita com o app em segundo plano e encerrado; os três fluxos devem abrir o mesmo evento, após validação pela API.
5. Envie categoria desconhecida, avisoId inválido e um campo url arbitrário; nenhum caso deve abrir uma rota.
6. Entre com um usuário sem acesso à máquina e confirme que o detalhe não é exibido.
7. Faça logout e confirme a remoção da associação do dispositivo no backend.

Anexe vídeo do recebimento → clique → detalhe e um registro sanitizado da associação do aparelho. Não exponha tokens completos, credenciais FCM, JWTs ou URLs privadas.

## Dependências de integração

- BE-07 (#73) ainda está aberto; o envio real e a remoção no backend precisam ser verificados.
- A API do projeto é ASP.NET Core; alinhar com BE-07 o campo machineId e a rota que enviará a notificação.
- MOB-05 ainda depende de EAS/Firebase e build Android para obter token real e comprovar push remoto.
