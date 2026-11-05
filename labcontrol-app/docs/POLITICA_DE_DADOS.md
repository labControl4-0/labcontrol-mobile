# Política de dados locais do LabControl Mobile

Tarefa: **MOB-02**. Dependência: MOB-01.

Este documento define onde cada dado do app fica no aparelho, por quanto tempo fica e quando é apagado. Toda mudança que grave algo novo no aparelho deve atualizar a tabela abaixo.

## Classificação

| Dado | Classe | Onde fica | Retenção | Apagado em |
|---|---|---|---|---|
| Token JWT | **Credencial** | Nativo: `expo-secure-store` (Keystore no Android, Keychain no iOS), chave `labcontrol.auth.token`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Web: `sessionStorage` da aba. | Até o logout ou o 401. Na web, também até fechar a aba. | Logout, 401 e troca de usuário |
| Perfil (id, nome, e-mail) | **Sessão** (dado pessoal) | AsyncStorage, chave `@labcontrol:profile`, sem o token | Até o logout ou o 401 | Logout, 401 e sessão incompleta |
| Foto de perfil (URI local) | **Cache do usuário** | AsyncStorage, `@labcontrol:cache:<userId>:profileImageUri` | 30 dias | Logout, 401, troca de usuário e prazo vencido |
| Plantas, máquinas e setores para uso offline | **Cache do usuário, temporário** | SQLite `labcontrol.db`, tabela `cache_entries` (`lib/offline/cacheStore.ts`) | 7 dias | Logout, 401, troca de usuário e prazo vencido |
| Ocorrência de máquina ainda não enviada (`pending`, `failed`) | **Trabalho do usuário não sincronizado** | SQLite, tabela `occurrences` | Até ser enviada | **Mantida** no logout e no 401, visível só para o dono |
| Ocorrência de máquina já enviada (`synced`) | **Cópia local** | SQLite, tabela `occurrences` | 30 dias | Logout, 401 e prazo vencido |
| Chaves de versões anteriores (`@labcontrol:session`, `@labcontrol:token`, `@labcontrol:user`, `profile_image_uri`) | **Legado** | AsyncStorage | Nenhuma | Abertura do app, login e logout |

## Regras

1. **O token nunca vai para o AsyncStorage, para o SQLite nem para os logs.** No Android, o AsyncStorage é gravado num banco SQLite, por isso o token fica só no armazenamento seguro.
2. **Todo cache é separado por usuário.** Use sempre `userCache(userId)`. A leitura só enxerga as chaves do usuário logado. Assim, mesmo que uma limpeza falhe, um usuário não vê os dados de outro.
3. **O login de outro usuário apaga o cache do anterior.** Isso cobre o caso em que o app foi fechado sem logout.
4. **O logout e o 401 apagam token, perfil, todo o cache e as chaves legadas.**
5. **Todo dado em cache tem prazo.** Um dado vencido ou corrompido é apagado na leitura e tratado como ausente.
6. **Os logs não podem conter token, sessão, senha nem o header `Authorization`.** Logue só a mensagem do erro (`error.message`).

## Estratégia web

O `expo-secure-store` não funciona na web. Lá, o token fica no `sessionStorage` da aba:

- é apagado quando a aba é fechada, e então o app volta ao login;
- não é compartilhado entre abas;
- nunca usa o `localStorage`, que persiste sem prazo.

Limitação: qualquer script da página consegue ler o `sessionStorage`. Por isso uma falha de XSS exporia o token. A proteção completa exige que o backend envie o token num cookie `HttpOnly`, o que fica para uma tarefa de backend. Sem `sessionStorage` disponível (render estático no Node ou navegador com armazenamento bloqueado), o token fica só em memória.

## SQLite e offline first

Desde o MOB-03, o app usa o `expo-sqlite` (schema em `docs/SQLITE_SCHEMA.md`). Regras:

- o banco só recebe as classes de cache e de ocorrências acima, nunca o token;
- toda linha tem `user_id`, e toda consulta filtra por ele;
- o cache só aceita as chaves permitidas (`plants`, `machines:<id>`, `sectors:<id>`);
- todo cache tem prazo, e as ocorrências enviadas saem do aparelho em 30 dias;
- o logout apaga o cache e as ocorrências enviadas. As ocorrências ainda não enviadas ficam no aparelho, porque apagá-las perderia trabalho que não chegou ao servidor. Antes de sair, o app avisa quantas existem.

O teste `noTokenLeak.test.ts` falha se um arquivo que importa `expo-sqlite` acessar o token ou a sessão. O teste `offlineCache.test.ts` procura o token dentro do arquivo do banco.

## Evidências

| Regra | Teste |
|---|---|
| Token fora do AsyncStorage/SQLite | `storage.test.ts` › token no armazenamento seguro |
| Estratégia web | `storage.test.ts` › estratégia web |
| Troca de usuário | `storage.test.ts` › troca de usuário |
| Retenção | `storage.test.ts` › retenção local |
| Logout | `storage.test.ts` › logout e `auth.test.ts` |
| Token fora dos logs | `noTokenLeak.test.ts` |
| Chaves legadas | `auth.test.ts` › remove na abertura as chaves antigas |

Rode com `npm test`. Os testes usam só dados sintéticos.

## Fora do escopo

- O arquivo da foto escolhida na galeria continua na pasta de cache do app depois do logout. Só a referência a ele é apagada. Para apagar o arquivo seria preciso adicionar o `expo-file-system`.
