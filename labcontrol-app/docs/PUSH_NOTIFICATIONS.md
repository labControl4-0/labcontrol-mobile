# Expo Notifications e Android development build

Tarefa: **MOB-05**. Dependência: MOB-01. Próximas: MOB-06 (receber push e navegar pelo payload) e BE-07 (registro e envio no backend).

Segue a parte mobile da aula [Expo e Java: Push Notification](https://glaucotodesco.notion.site/Expo-e-Java-Push-Notification-3e35d52a81f581b5abe7d93874de63b5) (permissão, canal, token, notificação local, EAS e FCM). O backend **não** é o Spring Boot da aula: o LabControl continua na API em C# .NET, e o registro do aparelho usa a rota que o BE-07 vai criar nela.

## Fluxo

```
Android (development build)
  ↓ canal "machine-alerts" + permissão
expo-notifications → ExpoPushToken (projectId do EAS)
  ↓ POST /api/devices { pushToken, platform }, com Authorization
API do LabControl (ASP.NET Core + Postgres; rota criada no BE-07)
  ↓ POST /api/notifications
Expo Push Service → FCM (credencial FCM V1 no EAS) → Android
```

## O que está no código

| Arquivo | Papel |
|---|---|
| `lib/push/notifications.ts` | Handler de exibição, canal Android, permissão, `getExpoPushTokenAsync`, notificação local |
| `lib/push/pushStore.ts` | Registro do token no armazenamento seguro e máscara para a tela |
| `services/pushRegistration.ts` | Permissão → token → `POST /devices`; `DELETE /devices/{token}` no logout |
| `app/components/PushSetupCard.tsx` | Cartão na tela **Notificações**: Ativar, Notificação local, token mascarado |
| `app/_layout.tsx` | Na abertura: handler, canal e registro silencioso (sem pedir permissão) |
| `app.json` | `android.package = com.labcontrol.mobile` e plugin `expo-notifications` |
| `app.config.js` | `googleServicesFile` vindo do EAS (`GOOGLE_SERVICES_JSON`) ou do arquivo local |
| `eas.json` | Perfis `development` (dev client, APK interno), `preview` e `production` |

### Comportamento

- **Canal:** `machine-alerts` ("Alertas de máquinas", importância alta), criado antes do pedido de permissão, como o Android 13+ exige.
- **Permissão:** o pedido só aparece quando o usuário toca em **Ativar notificações**. Na abertura do app e depois do login, o registro acontece só se a permissão já existir.
- **Recusa:** o app continua funcionando e mostra "Permissão negada". Se o usuário bloqueou de vez (`canAskAgain = false`), o app não insiste e oferece **Abrir configurações**.
- **Emulador, Expo Go e web:** o cartão explica que o token só existe em aparelho físico (ou que a plataforma não é suportada). Nada lança erro.
- **Token protegido:**
  - fica no SecureStore (Keystore), como o token de sessão; nunca no AsyncStorage, no SQLite ou nos logs;
  - a tela mostra só o começo e o fim: `ExponentPushToken[abcd••••wxyz]`;
  - o registro vai autenticado, para o backend associar o token ao usuário (BE-07);
  - no logout, o app pede `DELETE /devices/{token}` e apaga o token local. No 401, apaga o local.
- **Troca de usuário:** o mesmo token é registrado de novo para o usuário que entrou.

### Contrato com a API .NET (proposta para o BE-07)

O backend do projeto é a API em **ASP.NET Core + Postgres** (`labcontrol-api`). O app usa o mesmo formato de corpo da aula:

```http
POST /api/devices
Authorization: Bearer <jwt>
Content-Type: application/json

{ "pushToken": "ExponentPushToken[...]", "platform": "android" }
```

- **Resposta esperada:** 200 ou 201. Registrar o mesmo token de novo atualiza o registro, sem duplicar. Se o token já pertencer a outro usuário, ele passa para o usuário autenticado.
- **Remoção** (o app já chama no logout e ignora falhas): `DELETE /api/devices/{pushToken}` (URL-encoded) remove o aparelho do usuário autenticado.
- **No C#:** um `RegisterDeviceDto { string PushToken; string Platform }` funciona sem ajuste, porque o ASP.NET lê o JSON sem diferenciar maiúsculas. O controller precisa de `[Authorize]` e do `userId` vindo do JWT, como no `MachineEventsController`.

A API atual ainda não tem essa rota. Enquanto o BE-07 não sai, o cartão mostra "Token gerado, mas não registrado: o servidor ainda não tem a rota de registro de dispositivos (BE-07)", e o app tenta de novo na próxima abertura.

## Credenciais fora do Git

| Arquivo | Para que serve | Onde fica |
|---|---|---|
| `google-services.json` | Liga o app Android ao projeto Firebase | Local (ignorado pelo Git) e variável de arquivo **secreta** `GOOGLE_SERVICES_JSON` no EAS |
| Service Account JSON (`*-firebase-adminsdk-*.json`) | Autoriza o envio pelo FCM V1 | Só no EAS (`eas credentials`). Não deixe na pasta do projeto. |
| Keystore Android | Assinatura do APK | Gerenciado pelo EAS |

O `.gitignore` ignora esses arquivos, e o teste `pushConfig.test.ts` falha se algum deles for versionado ou se um arquivo versionado tiver chave privada ou chave de API do Google.

O `projectId` do EAS e o `android.package` **não** são segredos e ficam no `app.json`.

## Passo a passo (contas do Expo e do Firebase)

Rode dentro de `labcontrol-app`.

1. **Projeto EAS.** Defina com a equipe se o projeto fica na conta pessoal ou na organização do Expo.

   ```powershell
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   O `init` grava `extra.eas.projectId` no `app.json`. Faça commit dessa mudança.

2. **Firebase.** No [Firebase Console](https://console.firebase.google.com), crie um projeto, adicione um app **Android** com o pacote `com.labcontrol.mobile` e baixe o `google-services.json` para `labcontrol-app/`.

3. **Enviar o `google-services.json` ao EAS:**

   ```powershell
   npx eas-cli@latest env:set --name GOOGLE_SERVICES_JSON --value ./google-services.json --environment development --type file --visibility secret
   npx eas-cli@latest env:list --environment development
   ```

4. **Credencial FCM V1.** No Firebase: *Project settings → Service accounts → Generate new private key*. Depois:

   ```powershell
   npx eas-cli@latest credentials
   ```

   *Android → production → Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Upload a new service account key.* Apague o JSON baixado do computador depois do upload.

5. **Development build:**

   ```powershell
   npx eas-cli@latest build --profile development --platform android
   ```

   Instale o APK pelo link ou QR code que o EAS mostra.

6. **Rodar:** com o `.env` apontando para o backend (`EXPO_PUBLIC_API_URL=http://IP_DO_COMPUTADOR:PORTA/api`):

   ```powershell
   npx expo start --dev-client
   ```

## Roteiro de evidências (Android de teste)

Use uma conta de teste e não mostre o token inteiro nem a URL real do servidor.

| # | Ação | Evidência esperada |
|---|---|---|
| 1 | Abra o development build no aparelho | Tela de login do LabControl (o app não é o Expo Go) |
| 2 | **Notificações** → **Ativar notificações** → **Não permitir** | "Permissão negada. O app continua funcionando sem notificações."; navegue pelas outras telas normalmente |
| 3 | **Ativar notificações** de novo → **Permitir** (se o Android não perguntar mais, use **Abrir configurações**) | Situação "Permitidas" e push token mascarado |
| 4 | **Notificação local** | Notificação "LabControl: teste local" na barra do Android, no canal "Alertas de máquinas" |
| 5 | API .NET com a rota `POST /api/devices` (BE-07) | "Aparelho registrado no servidor." e o token aparece na tabela de dispositivos do Postgres. Antes do BE-07, o cartão mostra "Token gerado, mas não registrado" |
| 6 | Push remoto (MOB-06 / BE-07) | Pelo backend ou pela [ferramenta da Expo](https://expo.dev/notifications) com o token, a notificação chega com o app em segundo plano |

## Evidências automatizadas

| Critério | Teste |
|---|---|
| Negar permissão não quebra o app | `pushNotifications.test.ts` › permissão (6 casos: negada, bloqueada, sem pedido na abertura, erro nativo, notificação local sem permissão) |
| Token real gerado com o projectId e protegido | `pushNotifications.test.ts` › ExpoPushToken e registro; › proteção do token (SecureStore, fora do AsyncStorage/SQLite/logs, máscara, logout, 401) |
| Canal antes da permissão | `pushNotifications.test.ts` › cria o canal Android antes de pedir a permissão |
| Notificação local | `pushNotifications.test.ts` › notificação local |
| Credenciais fora do Git | `pushConfig.test.ts` |
| Registro do dispositivo na API .NET | `e2e/dotnetDevice.e2e.test.ts` (desligado no `npm test`) |

### Registro contra a API .NET real (5/11/2026)

O teste `e2e/dotnetDevice.e2e.test.ts` sobe o processo real da API (`LabControlApi.dll`) com um Postgres descartável. Ele cria um usuário sintético, faz login pelo app e roda o registro com o código real do app; só o módulo nativo é simulado, com um token **sintético**. Resultado com a API atual (sem a rota do BE-07):

```
√ sem a rota do BE-07, o app avisa e não marca o aparelho como registrado
√ a rota é chamada com sessão válida: o 404 não derruba o login
√ logout não quebra mesmo sem a rota de remoção
```

Quando o BE-07 entrar, troque a expectativa do primeiro caso para `status: "registered"` e confira o token na tabela de dispositivos.

Para repetir, use o mesmo preparo do `backendSync.e2e.test.ts` (ver `docs/MATRIZ_CENARIOS_OFFLINE.md`) e rode:

```powershell
$env:E2E_API_DLL = "$env:TEMP\labcontrol-api-e2e\out\LabControlApi.dll"
$env:E2E_DB_CONNECTION = "Host=127.0.0.1;Port=55433;Database=labcontroldb;Username=admin;Password=admin"
npx jest __tests__/e2e/dotnetDevice.e2e.test.ts --runInBand
```

## O que só pode ser comprovado no aparelho

Os testes automatizados simulam o módulo nativo. Estes itens dependem das contas do Expo e do Firebase e de um Android físico:

- o development build instalado e rodando;
- o ExpoPushToken **real** gerado (exige `projectId` e FCM configurados);
- a notificação local aparecendo na barra do Android;
- o push remoto (escopo de MOB-06 e BE-07).
