# Ponto a Ponto

Treino mental de ténis: um programa diário adaptativo (check-in, lição, treino mental guiado, desafio no court e reflexão), preparação e revisão de jogos, torneios, objetivos e um coach de IA com memória.

PWA sem build, pensada para instalar no iPhone a partir do GitHub Pages.

## Instalar no iPhone

1. Abre `https://andremp33.github.io/ponto-a-ponto/` no Safari.
2. Toca em Partilhar → **Adicionar ao ecrã principal**.
3. Abre a app a partir do ícone. O coach funciona logo, grátis e offline. Para conversa livre, em Definições → Coach escolhe **IA no telemóvel** e descarrega o modelo (cerca de 1 GB, uma vez, por Wi-Fi; precisa do iOS 26 ou mais recente).

Os dados ficam só no telemóvel. Usa Definições → Exportar para fazer cópias de segurança.

## Desenvolvimento

```bash
python3 -m http.server 8000   # http://localhost:8000
```

Testes (Playwright, iPhone 390×844, API da Anthropic simulada; screenshots em `tests/out/`):

```bash
npm install
npx playwright install chromium
npm test
```

A cada release, incrementar `CACHE_VERSION` em `sw.js`.

Ver `CLAUDE.md` para arquitetura, design system e plano de trabalho.
