# Chatwoot Script Manager

Aplicação Next.js 15 (App Router) para gerenciar os scripts JavaScript do **Dashboard Scripts** do Chatwoot. Mantém os scripts versionados num repositório do GitHub, permite editá-los individualmente, gera o bundle no formato `<script>...</script><script>...</script>` e envia para a API `api-code-bundle-packaged` que serve via `GET /script.js`.

## Arquitetura

```
┌──────────────────┐  octokit  ┌─────────────┐  POST /bundle  ┌──────────────────────────┐  GET /script.js  ┌──────────────┐
│ Editor (este app)│ ────────► │ GitHub repo │   ────────►    │ api-code-bundle-packaged │  ───────────►    │ Chatwoot     │
│ Next.js + CM6    │           │ scripts/*.js│                │     (bundle único)       │                  │ loader       │
└──────────────────┘           └─────────────┘                └──────────────────────────┘                  └──────────────┘
```

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript strict**
- **shadcn/ui** sobre **Radix UI** + **Tailwind CSS** (tokens do design system Chatwoot)
- **CodeMirror 6** (`@uiw/react-codemirror`) com suporte a JS, light/dark
- **@octokit/rest** para GitHub
- **TanStack Query** (`@tanstack/react-query`) para cache/data fetching
- **react-hook-form** + **zod** para formulários
- **next-themes** para alternância claro/escuro

## Setup

```bash
# 1. Instalar deps
npm install

# 2. Rodar em dev
npm run dev

# 3. Build de produção
npm run build && npm run start
```

A porta default é `3000` (configurável com `PORT=4000 npm run dev`).

> **Nada precisa estar em `.env.local`.** Toda a configuração é feita pela tela `/setup` e persistida em `localStorage`. Isso mantém PAT e API key fora do bundle e no controle do usuário.

## Configuração inicial

Acesse a aplicação. Como ainda não há config, você é redirecionado para `/setup` e preenche:

| Campo | Descrição |
| ----- | --------- |
| **GitHub Personal Access Token** | PAT clássico ou fine-grained com escopo `repo` (read/write contents). |
| **Repositório** | Formato `owner/repo` (ex: `minhaempresa/chatwoot-scripts`). |
| **Branch** | Default `main`. |
| **Path dos scripts** | Subpasta onde ficam os `.js` (ex: `scripts/`). Vazio = raiz. |
| **URL da API de bundle** | URL pública do `api-code-bundle-packaged` (ex: `https://api.exemplo.com`). |
| **API Key** | Valor do header `x-api-key`. |
| **Remover comentários** | Toggle para strip de `//` e `/* */` antes de gerar o bundle. |

**Botão "Testar conexão"** faz uma chamada real ao GitHub (`repos.get`) e à API de bundle (`GET /script.js`) e reporta o status de cada uma separadamente.

### Como gerar o PAT do GitHub

1. https://github.com/settings/personal-access-tokens (ou `https://github.com/settings/tokens` para PAT clássico)
2. **Fine-grained** (recomendado):
   - **Repository access:** apenas o repositório dos scripts.
   - **Permissions → Contents:** Read and write.
3. **Clássico:** marque o escopo `repo`.
4. Cole o token na tela `/setup`.

## Telas

### `/setup` — Configuração

Formulário com validação Zod, campos `password` para PAT e API key, botão "Testar conexão" que executa as duas chamadas reais e mostra status com cor (verde/vermelho).

### `/` — Editor

Layout de duas colunas:

- **Sidebar (280px)** — lista de `.js` do path configurado, com:
  - busca com filtro (`Cmd/Ctrl+K` foca o campo)
  - bolinha laranja em arquivos com mudanças locais não salvas
  - botão **+** para criar novo script
  - botão **↻** para recarregar do GitHub
- **Editor** — CodeMirror 6 com:
  - syntax highlight de JavaScript
  - line numbers, fold gutter, auto-indent, autocomplete, bracket matching
  - tema light/dark seguindo o design system
  - `Cmd/Ctrl+S` salva no GitHub
  - badge "modificado" no header e `*` no `<title>` quando há mudanças
  - footer com contador de linhas e estado salvo/modificado

### Topbar global

- Logo + nome
- **StatusIndicator** (bolinha + texto): verifica `GET /script.js` da API e mostra última pegada do bundle em produção
- Botão destacado **"Gerar e enviar bundle"** (`Cmd/Ctrl+Shift+B`)
- Toggle de tema (claro/escuro/sistema)
- Ícone de configurações → `/setup`

### Modal de bundle

Ao clicar em "Gerar e enviar bundle":

- **Preview** do bundle final em CodeMirror readonly (formato exato `<script>...</script><script>...</script>` sem separadores)
- **Estatísticas**: nº de scripts, tamanho do bundle, tamanho do JS bruto
- **Lista de arquivos com checkboxes** — permite excluir scripts específicos do bundle sem removê-los do repo
- O conteúdo usado é o **local** (incluindo edições não salvas), não o do GitHub — isso permite testar mudanças antes de fazer commit
- **Confirmar e enviar** dispara `POST /bundle` com `x-api-key`. Toast de sucesso/erro e timestamp.

## Atalhos de teclado

| Atalho | Ação |
| ------ | ---- |
| `Cmd/Ctrl+S` | Salvar no GitHub |
| `Cmd/Ctrl+Shift+B` | Abrir modal de bundle |
| `Cmd/Ctrl+K` | Focar busca de arquivos |

## Design System

A pasta `design-system-chatwoot/` na raiz contém:
- `tokens.json` — tokens estruturados (Radix Colors + semantic tokens)
- `design-system.css` — CSS vars para light/dark
- `Design system.html` — referência visual

Os tokens foram extraídos para `src/app/globals.css` no formato canal-RGB (`var(--blue-9)` → `39 129 246`) e expostos em `tailwind.config.ts` via `rgb(var(--token) / <alpha-value>)`. Isso permite compor opacidade nos utilitários do Tailwind.

Apontar para outro design system: edite `globals.css` (vars) e `tailwind.config.ts` (mappings).

## Estrutura

```
src/
  app/
    layout.tsx           # ThemeProvider + QueryClient + Toaster
    page.tsx             # editor (rota principal)
    setup/page.tsx
    providers.tsx
    globals.css          # tokens do design system
  components/
    ui/                  # shadcn primitives (button, dialog, toast, etc.)
    editor/              # code-editor, file-list, editor-header
    bundle/              # bundle-modal, bundle-preview
    layout/              # top-bar, status-indicator, theme-toggle
  lib/
    config/              # storage (localStorage) + zod schema
    github/              # octokit client + types
    bundle/              # generator (puro) + api client
    utils.ts
  hooks/
    use-config.ts
    use-github-files.ts  # tanstack query
    use-bundle-deploy.ts
    use-toast.ts
design-system-chatwoot/  # tokens visuais (não modificar)
```

## Lógica do bundler

`src/lib/bundle/generator.ts` exporta `generateBundle(files, options)`:

- Para cada arquivo: trim + (opcional) strip de `//` e `/* */`
- Envolve cada script em `<script>...</script>`
- **Concatena sem nenhum separador** entre `</script>` e o próximo `<script>`
- Skipa arquivos vazios após trim

Formato exato:

```
<script>codigo1</script><script>codigo2</script><script>codigo3</script>
```

## Tipos principais

```ts
ScriptFile        // { name, path, sha, size, content }
ScriptListItem    // { name, path, sha, size }
AppConfig         // resultado do zod schema (PAT, repo, branch, path, apiUrl, apiKey, stripComments)
DeployResult      // { success, message, deployedAt } — resposta da API
ApiHealth         // { ok, bytes, hasDeploy } — saúde do GET /script.js
```

## Loader no Chatwoot

Em **Super Admin → Installation Configs → Dashboard Scripts**, cole **uma única vez**:

```html
<script>
  (function () {
    var s = document.createElement('script');
    s.src = 'https://SUA-API-PUBLICA/script.js';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>
```

Daí em diante, todo deploy via este editor substitui o que sai em `/script.js` e os agentes pegam a versão nova ao recarregar o dashboard.

## Limitações conhecidas

- Sem OAuth com GitHub — apenas PAT manual.
- Sem histórico de deploys (a API não persiste isso).
- Sem diff visual entre versões / rollback.
- Sem multi-tenant.
- Sem testes (E2E ou unitários).
