# Supabase Edge Functions — Mind Cave

Suite completa de Edge Functions para servidor de sinalização WebRTC, gerenciamento de salas, persistência em lote de chunks e telemetria de jogo.

---

## 📦 Lista de Funções Criadas

| Função | Pasta | Descrição |
|---|---|---|
| **webrtc-turn** | `supabase/functions/webrtc-turn/index.ts` | Retorna servidores ICE (STUN/TURN) de baixa latência e credenciais dinâmicas para atravessar NATs restritivos e redes 4G/5G móveis sem falhas de conexão. |
| **clean-signals** | `supabase/functions/clean-signals/index.ts` | Limpa sinais consumidos antigos (>60s) e sinais abandonados (>5m) para manter a tabela `signals` leve e rápida. |
| **room-manager** | `supabase/functions/room-manager/index.ts` | Validação de salas, heartbeat de anfitrião, verificação de senha/whitelist/ban e encerramento de salas. |
| **sync-world-delta** | `supabase/functions/sync-world-delta/index.ts` | Sincronização em lote de blocos alterados (`chunk_deltas`) com alta performance e sem sobrecarregar conexões individuais. |
| **player-death-logger** | `supabase/functions/player-death-logger/index.ts` | Registro atômico de mortes em `player_deaths`, atualizando estatísticas no perfil (`profiles`) e no jogador (`players`). |

---

## 🚀 Como Publicar no Supabase

### Opção 1: Via Supabase CLI (Recomendado)

Na raiz do projeto (`MIND-CAVE`), execute:

```bash
# 1. Login no Supabase (se ainda não fez)
npx supabase login

# 2. Link com o seu projeto (Project Ref: ddwdgwaliywymcatdekg)
npx supabase link --project-ref ddwdgwaliywymcatdekg

# 3. Deploy de todas as Edge Functions
npx supabase functions deploy webrtc-turn --no-verify-jwt
npx supabase functions deploy clean-signals --no-verify-jwt
npx supabase functions deploy room-manager --no-verify-jwt
npx supabase functions deploy sync-world-delta --no-verify-jwt
npx supabase functions deploy player-death-logger --no-verify-jwt
```

> **Nota:** A flag `--no-verify-jwt` permite que os clientes do jogo (inclusive jogadores convidados sem login) consigam chamar as rotinas de sinalização e sincronização usando a chave anon do Supabase.

---

### Opção 2: Pelo Painel Web do Supabase (Dashboard)

1. Acesse: [https://supabase.com/dashboard/project/ddwdgwaliywymcatdekg/functions](https://supabase.com/dashboard/project/ddwdgwaliywymcatdekg/functions)
2. Clique em **"Create Function"**.
3. Crie cada uma das pastas acima e cole o respectivo código de `index.ts` (junto com o `_shared/cors.ts` e `_shared/supabaseClient.ts` se estiver agrupando).

---

## ⚙️ Variáveis e Secrets Opcionais (Configuráveis no Supabase)

No menu **Settings > Edge Functions > Secrets**:

* `TURN_URL`: URL do seu servidor TURN (ex: `turn:meu-servidor-coturn.com:3478`).
* `TURN_USERNAME`: Usuário do seu servidor TURN.
* `TURN_CREDENTIAL`: Senha do seu servidor TURN.
* `TURN_SECRET`: Segredo compartilhado HMAC para TURN efêmero (padrão RFC / Coturn).
* `TURN_HOST`: Host base do Coturn.

Se nenhuma dessas variáveis for configurada, a função `webrtc-turn` utilizará automaticamente o pool global redundante de servidores STUN do Google, Twilio e Mozilla, garantindo que o jogo nunca fique sem resposta.
