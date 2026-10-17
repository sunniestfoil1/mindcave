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

## 🌐 Relay (TURN): sem ele, muita gente não consegue entrar numa partida online

O jogo online conecta jogador e host direto (WebRTC). Quem está atrás de **NAT simétrico (CGNAT de operadora ou provedor)** só conecta por um servidor de relay (TURN);
só com STUN o handshake termina e a conexão nunca abre (o convidado vê "Falha ao conectar"). A função `webrtc-turn` devolve `turn: null` enquanto nenhum
relay estiver configurado.

**Passo a passo (uma vez, leva uns 5 minutos):**

1. Crie a credencial de relay em um destes (os dois têm plano grátis):
   * **Cloudflare Realtime TURN** (1 TB/mês grátis): painel da Cloudflare → *Realtime* → *TURN Server* → *Create* → anote o **Key ID** e o **API Token**.
   * **Metered** (50 GB/mês grátis): crie o app em metered.ca → anote o **domínio do app** (a parte antes de `.metered.live`) e a **API Key**.
2. Grave nos Secrets da Supabase (rode no seu terminal; **não cole a chave em conversa**):

```bash
npx supabase login
npx supabase secrets set CF_TURN_KEY_ID=... CF_TURN_API_TOKEN=... --project-ref ddwdgwaliywymcatdekg
# ou, se usou a Metered:
npx supabase secrets set METERED_DOMAIN=... METERED_API_KEY=... --project-ref ddwdgwaliywymcatdekg
npx supabase functions deploy webrtc-turn --no-verify-jwt --project-ref ddwdgwaliywymcatdekg
```

3. Confira: a resposta da função passa a trazer `"turn": "cloudflare"` (ou `"metered"`) e servidores `turn:`/`turns:` na frente da lista. Se vier `turn: null` ou algo em
   `erros`, a chave está errada.

```bash
curl -s -X POST "https://ddwdgwaliywymcatdekg.supabase.co/functions/v1/webrtc-turn" -H "apikey: <chave anon do .env.local>" -H "Content-Type: application/json" -d "{}"
```

A lógica fica em `_shared/ice.js` e é testada por `scripts/e2e/ice.mjs`.

## ⚙️ Variáveis e Secrets (Configuráveis no Supabase)

No menu **Settings > Edge Functions > Secrets** (ordem em que entram na lista; a primeira configurada fica na frente):

* `CF_TURN_KEY_ID` + `CF_TURN_API_TOKEN`: Cloudflare Realtime TURN (credencial gerada na hora, validade de 24 h).
* `METERED_DOMAIN` + `METERED_API_KEY`: Metered (credencial buscada na hora).
* `TURN_URL` (+ `TURN_USERNAME`, `TURN_CREDENTIAL`): servidor TURN próprio fixo; URLs separadas por vírgula.
* `TURN_HOST` + `TURN_SECRET`: Coturn com credencial efêmera (HMAC-SHA1).

Sem nenhuma delas a função devolve só o pool de STUN (Google, Twilio, Mozilla): funciona para a maioria das redes domésticas, **não** para CGNAT.
