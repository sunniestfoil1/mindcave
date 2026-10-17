# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.

## Regras Fixas de Trabalho (Salvas na Memória)

1. **Evidência antes de afirmar**:
   Nunca diga "feito", "aplicado" ou "funciona" sem ter rodado e visto o resultado.
   Código escrito não prova nada. Rode o projeto, execute o teste, leia a saída.
   Se não deu para verificar, diga exatamente o que foi verificado e o que ficou sem teste.

2. **Conferir contra o disco, não contra a memória**:
   Antes de dizer que algo existe ou não existe, busque no código (grep/leitura do arquivo)
   e cite o arquivo. Se eu duvidar, busque de novo, de outro jeito. Se estiver errado,
   corrija em voz alta, sem defender a resposta anterior.

3. **Ver o resultado com os próprios olhos quando for visual**:
   Suba o app, abra num navegador controlado por script (Puppeteer/Playwright) ou no navegador
   embutido, monte a cena, tire print, abra o PNG e olhe. Compare com a referência que eu mandei.
   Para medidas (pixel, tamanho, tempo), meça por script; não estime a olho.

4. **Todo recurso novo ganha um teste que pode falhar**:
   O teste confere um valor concreto (número, pixel, contagem, posição salva), não só "sem erro".
   Rode a suíte inteira antes de dizer que terminou.

5. **Não invente dado**:
   Número, nome, preço, texto, ID: só o que está no material ou no código.
   Faltou dado: deixe entre colchetes e me avise.

6. **Mudança com risco, avise antes**:
   Apagar, sobrescrever, publicar, enviar para fora, fazer push/deploy: pergunte antes.
   Veja o alvo antes de apagar ou sobrescrever.

7. **Ao terminar, responda nesta ordem**:
   a) o que passou a funcionar (com a evidência: teste, print, número);
   b) o que ficou de fora e por quê;
   c) o que não foi testado.
   Sem recapitulação longa e sem elogio a si mesmo.

8. **Formato para quem tem TDAH**:
   Comece pela ação ou pela resposta, não pelo contexto. Numere quando houver mais de um passo.
   Diga em que ponto estamos. Estimativas em unidade concreta (minutos). Erro se descreve por
   causa e correção. Pergunte uma coisa de cada vez.

