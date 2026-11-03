Lê o CLAUDE.md com atenção. A pasta legacy/ tem a versão funcional da app (feita como artifact do claude.ai); src/styles.css tem o design system novo e src/content.js o conteúdo.

Quero que transformes isto numa PWA standalone para instalar no meu iPhone via GitHub Pages, seguindo a arquitetura, a camada de plataforma (API Anthropic com a minha chave + localStorage + export/import), o design system e a lista de funcionalidades do CLAUDE.md. Não percas nenhuma funcionalidade do legacy.

Trabalha por fases e faz commit no fim de cada uma:
1. Shell PWA: index.html, manifest, sw.js, ícones gerados, main.js com router e tab bar.
2. core.js + ai.js (com "Testar ligação" nas Definições) + import dos dados do legacy.
3. Todas as vistas reescritas com o design system novo, começando pelo Hoje com o court e o placar.
4. Testes Playwright a 390×844 com a API simulada; vê os screenshots e corrige o que estiver mal.
5. Push para main e diz-me o URL do GitHub Pages.

Usa o skill de frontend-design para rever a UI e o de dataviz para os gráficos, se estiverem disponíveis.
