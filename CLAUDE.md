# Ponto a Ponto — treino mental de ténis (PWA)

App pessoal de treino mental para ténis competitivo, inspirada na Winning Habits (Apeak). Vai correr no **GitHub Pages** e ser instalada no **iPhone** via Safari → Partilhar → "Adicionar ao ecrã principal".

Todo o texto da interface é em **português de Portugal** (tu, "ecrã", "telemóvel", "equipa"), sentence case, sem inglês.

## Estado atual

- `legacy/` — versão 2 **funcional**, feita como artifact do claude.ai (`index.html` + `app.js` + `content.js`). Tem toda a lógica e todas as funcionalidades. Usa APIs que só existem dentro do claude.ai (`window.claude.use('db' | 'user' | 'sample' | 'downloads')`) e por isso **não funciona fora do claude.ai**.
- `src/content.js` — conteúdo já convertido para módulo ES (8 pilares, 24 lições originais, 8 sessões guiadas, desafios, mapa pilar→treino). Não reescrever o conteúdo; só corrigir erros.
- `src/styles.css` — **design system novo** (rascunho completo de tokens e componentes). É a base da nova UI.

## Objetivo desta fase

1. Portar `legacy/app.js` para uma PWA standalone em `src/`, sem build step (ES modules nativos, ficheiros estáticos).
2. Substituir a camada de plataforma do claude.ai (ver abaixo).
3. Reescrever todo o markup das vistas para usar o design system de `src/styles.css`.
4. Tornar instalável no iPhone (manifest, ícones, service worker, safe areas).
5. Deploy no GitHub Pages a partir de `main` (raiz).

## Arquitetura alvo

```
index.html                 shell, meta iOS, <script type="module" src="src/main.js">
manifest.webmanifest
sw.js                      cache-first do app shell, versão em constante (bump a cada release)
icons/                     icon.svg, apple-touch-icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png
.nojekyll
src/
  main.js                  arranque, router, tab bar, registo do SW
  core.js                  estado S, utils, store (localStorage), engine (pillarScores, plan, loop, streak)
  ai.js                    cliente da API Anthropic (ver abaixo), askJSON, chatStream, contexto/persona
  ui.js                    componentes (slider, seg, chipset, sheet, toast, confirm), ícones SVG, gráficos (radar, linhas, heatmap)
  content.js
  styles.css
  views/
    onboarding.js  home.js  train.js  player.js  neuro.js  match.js (pre/post/practice/entry)
    coach.js  me.js  goals.js  tournaments.js  progress.js  settings.js
```

Os templates usam `onclick="..."` inline como no legacy; cada módulo de vista expõe os handlers com `Object.assign(window, {...})`. (Se preferires, migra para delegação de eventos com `data-action`, mas mantém tudo sem build.)

## Camada de plataforma — o que substituir

| Legacy (claude.ai) | PWA |
|---|---|
| `claude.use('db')` + `user.id()` (docs `profile`, `state`, `chat`, subcoleção `entries`) | `localStorage`, uma chave `pap_v3` com `{profile, state, entries, chat}`. Chamar `navigator.storage.persist()` no arranque. |
| `claude.use('sample')` | Chamada direta à **API Anthropic** com a chave do próprio utilizador (ver abaixo). |
| `claude.use('downloads')` (.ics do lembrete) | `Blob` + `<a download>` (funciona no Safari/iOS). |
| `navigator.clipboard` para exportar | Exportar = descarregar `ponto-a-ponto-backup-AAAA-MM-DD.json`. **Importar** = input de ficheiro + caixa para colar JSON. Aceitar o formato exportado pelo legacy (`{profile, state, entries}`) para migrar os dados do artifact. |

### Cliente da API Anthropic (`src/ai.js`)

- `POST https://api.anthropic.com/v1/messages`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`, **`anthropic-dangerous-direct-browser-access: true`** (obrigatório para CORS a partir do browser).
- Corpo: `{model, max_tokens, system, messages, stream?}`. `system` é campo de topo, não uma mensagem. **Não enviar `temperature`.**
- Modelos (configuráveis nas Definições): por omissão `claude-sonnet-5-5` para análises; `claude-haiku-5-5` para tarefas rápidas (insight do dia, memória, frases). Confirmar os nomes em https://docs.claude.com antes de fixar.
- `askJSON(task, tier)`: pede JSON, extrai o primeiro `{…}` da resposta e faz `JSON.parse`.
- `chatStream(messages, onText)`: `stream: true`, ler SSE com `fetch().body.getReader()`, acumular `content_block_delta` → `delta.text`.
- A chave fica só no dispositivo (localStorage). Nas Definições: campo de chave (password), botão "Testar ligação", texto curto a explicar que a chave nunca sai do telemóvel exceto para a API da Anthropic, e a recomendar um limite de gastos na Console.
- Sem chave: todas as funções de IA ficam desativadas com uma mensagem que leva às Definições. O resto da app funciona offline.
- Erros: 401 → "Chave inválida"; 429 → "Muitos pedidos, tenta daqui a um minuto"; rede → "Sem ligação".

## PWA / iPhone

- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` = `default`, `apple-mobile-web-app-title` = "Ponto a Ponto", `theme-color` `#F2F3EF`, `<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">`, `<link rel="manifest">`.
- `manifest.webmanifest`: `display: standalone`, `start_url: "./"`, `scope: "./"` (caminhos **relativos** — o Pages serve em `/ponto-a-ponto/`), `background_color`/`theme_color` `#F2F3EF`, ícones 192/512 + maskable.
- Padding com `env(safe-area-inset-*)` (já no CSS).
- Ícone: bola de ténis estilizada sobre fundo terra (`#B9502F`) com linhas brancas; gerar PNGs a partir de `icons/icon.svg` (ex.: Playwright screenshot ou `sharp`).
- Service worker com cache do shell + fontes; estratégia network-first para `index.html`, cache-first para o resto.
- Fora do modo standalone, mostrar no ecrã inicial um cartão "Instalar no iPhone" com os 3 passos (Partilhar → Adicionar ao ecrã principal → Abrir).
- Voz das sessões guiadas: `speechSynthesis` com `lang='pt-PT'` (preferir voz pt-PT; fallback pt). Só iniciar após toque do utilizador.
- Lembretes: o iOS não permite notificações locais agendadas sem servidor de push. Manter o `.ics` diário (RRULE:FREQ=DAILY) como lembrete.

## Design system (já definido em `src/styles.css` — respeitar)

Identidade de clube de ténis, não de SaaS. **Um único elemento ousado**: o "court" em terra batida no ecrã Hoje. Tudo o resto é sóbrio.

- Cores: `--chalk #F2F3EF` (fundo, frio — nada de creme), `--paper #FFF` (listas agrupadas), `--ink #17332B` (verde dos paraventos: texto e botões principais), `--clay #B9502F` (superfície do court, botão +), `--ball #D6E04B` (concluído/destaque, **só sobre ink ou clay**), `--rule #DCDFD8`.
- Gráficos: `--series-1 #2a78d6`, `--series-2 #B9502F` (paleta validada para daltonismo). Sem eixos duplos; tooltip ao tocar.
- Tipografia: **Archivo** (Google Fonts, variável com eixo `wdth`). Títulos e números em `wdth 70–75`, peso 800 (estilo placar); corpo em `wdth 100`. Números tabulares.
- Layout: alinhado à esquerda; **listas agrupadas estilo iOS** (`.group` + `.item` com hairlines) em vez de cartões soltos; `.nums` para trios de estatísticas; `.panel` para blocos de texto; `.panel.ink` para respostas do coach.
- Hero do Hoje (`.court`): fundo clay com linhas de campo em SVG por trás (`svg.lines`), título do pilar do dia, e o **placar** `.score` de 5 células (check-in, lição, treino, desafio, reflexão) que ficam amarelo-bola quando concluídas (animação `pop` só na célula acabada de concluir).
- Evitar: rótulos em MAIÚSCULAS espaçadas, strings meta com "·" a juntar tudo, setas "→" em botões, sombras genéricas em tudo, gradientes decorativos.
- Tab bar: ícones SVG de traço (não emojis/unicode), botão central + em clay.
- Player de sessões: ecrã inteiro `--ink`, texto branco grande, círculo de respiração amarelo-bola.
- Acessibilidade: foco visível, `prefers-reduced-motion`, contraste AA, alvos ≥ 44px.

## Funcionalidades (todas já existem no legacy — portar sem perder nenhuma)

- **Onboarding** (7 passos): perfil de jogador, estilo, desafios mentais (chips), avaliação inicial dos 8 pilares, objetivo da época, rotina, palavras-chave → radar do perfil e "o teu plano começa por …" (com bias dos desafios, igual ao `choosePillar`).
- **Loop diário adaptativo** (`plan()` em legacy): check-in → lição → treino mental → desafio no court → reflexão. Escolhe o pilar mais fraco (baseline + reflexões + check-ins), evita repetir o de ontem, "modo jogo" se houver jogo/torneio hoje. Modo fixo opcional por pilar.
- **Biblioteca**: 24 lições com filtro por pilar, marcar como lida, "Perguntar ao coach".
- **Treino**: sessões guiadas com voz (scripts + respiração), grelha de Schulte, tempo de reação, "Do crítico ao treinador" (reframes), visualizações personalizadas geradas por IA.
- **Jogos**: preparar (cartão de jogo IA), rever (estatísticas, plano cumprido, 8 pilares, emoções, análise IA + memória), reflexão de treino.
- **Torneios**: contagem decrescente, plano IA com checklist por fase, jogos ligados.
- **Objetivos**: mental/ténis × processo/performance/resultado, passos (IA), progresso.
- **Coach**: chat em streaming com contexto completo + **memória** editável (atualizada após jogos, revisão semanal e a cada 8 mensagens).
- **Eu/Progresso**: radar atual vs inicial, barras por pilar com delta, heatmap 8 semanas, índice mental por sessão, check-ins, Schulte, revisão semanal IA.
- **Definições**: refazer perfil, foco da semana, palavras-chave, voz, lembrete .ics, chave/modelos da API, exportar/importar, apagar tudo.

## Testes

- Playwright (Chromium já instalado no ambiente cloud) a 390×844, `deviceScaleFactor: 2`. Fazer `page.route('https://api.anthropic.com/**')` para simular respostas JSON e SSE.
- Percorrer: onboarding completo → Hoje → lição → sessão guiada (saltar até ao fim) → check-in → preparar jogo → rever jogo → reflexão → Schulte → reação → reframe → objetivo + passos IA → torneio + plano IA → chat → insight → Treinar (todas as tabs) → Eu → Progresso + revisão → Definições → exportar/importar.
- Zero erros na consola. Tirar screenshots e **olhar para eles** (sobreposições, texto cortado, tab bar a tapar conteúdo).
- Servir localmente com `python3 -m http.server` (os módulos ES não carregam via `file://`).

## Deploy

- GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`. URL: `https://andremp33.github.io/ponto-a-ponto/`.
- Ficheiro `.nojekyll` na raiz.
- A cada release: incrementar `CACHE_VERSION` em `sw.js`.

## Convenções

- Sem frameworks nem build. JS moderno (ES2022), sem dependências externas além do Google Fonts.
- PT-PT em todo o texto. Exemplos de jogadores: só factos verificáveis, sem citações inventadas.
- Não pôr dados pessoais no código (o repositório é público): o perfil vem do onboarding ou do import.
