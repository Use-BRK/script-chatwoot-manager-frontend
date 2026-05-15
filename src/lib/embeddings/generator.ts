import type { Embedding } from "../config/schema";

/** Nome do arquivo virtual no bundle. */
export const EMBEDDINGS_SCRIPT_NAME = "embeddings/embeddings.gen.js";

/**
 * Gera o userscript que injeta os embeddings configurados como itens do
 * menu lateral de Configurações do Chatwoot. Cada item abre um <iframe>
 * em painel fixo sobreposto, à direita do sidebar.
 *
 * Baseado no script de exemplo "brk-mgr" — adaptado para múltiplos
 * embeddings dinâmicos e para SVGs do Iconify (com viewBox próprio).
 */
export function generateEmbeddingsScript(embeddings: Embedding[]): string {
  const tools = embeddings.map((e) => ({
    id: `brk-emb-${e.id}`,
    name: e.title,
    url: e.url,
    iconBody: e.iconBody,
    iconWidth: e.iconWidth,
    iconHeight: e.iconHeight,
  }));

  const toolsJson = JSON.stringify(tools);

  return `(function () {
  'use strict';

  const TOOLS = ${toolsJson};
  if (!TOOLS.length) return;

  const ACTIVE_CLASSES = ['active', 'font-semibold', 'bg-n-slate-2', 'dark:bg-n-solid-3', 'text-n-brand-600', 'dark:text-n-brand-500'];
  let isPanelOpen = false;
  let lastUrl = location.href;

  function injectCss() {
    if (document.getElementById('brk-emb-css')) return;
    const css = document.createElement('style');
    css.id = 'brk-emb-css';
    css.textContent = '#brk-emb-panel{position:fixed;top:0;right:0;bottom:0;background:var(--white,#fff);z-index:100;display:none;flex-direction:column}#brk-emb-panel.visible{display:flex}html.dark #brk-emb-panel,body.dark #brk-emb-panel{background:#1f2937}#brk-emb-iframe{width:100%;height:100%;border:none;display:block;background:transparent}';
    document.head.appendChild(css);
  }

  function getSidebarWidth() {
    const asideSettings = document.querySelector('.settings-wrap aside, div[class*="settings"] aside');
    const asideMain = document.querySelector('aside');
    const target = asideSettings || asideMain;
    return target ? target.getBoundingClientRect().right : 200;
  }

  function createPanel() {
    if (document.getElementById('brk-emb-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'brk-emb-panel';
    panel.innerHTML = '<iframe id="brk-emb-iframe" src="about:blank"></iframe>';
    document.body.appendChild(panel);
  }

  function getAuthToken() {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith('cw_d_session_info=')) {
        try { return JSON.parse(decodeURIComponent(c.substring('cw_d_session_info='.length))); } catch (e) { }
      }
    }
    return null;
  }

  async function checkIsAdmin() {
    const auth = getAuthToken();
    if (!auth || !auth['access-token']) return false;
    try {
      const res = await fetch('/api/v1/profile', { headers: { 'access-token': auth['access-token'], 'client': auth['client'], 'uid': auth['uid'] } });
      if (!res.ok) return false;
      const data = await res.json();
      return data.role === 'administrator' || data.type === 'SuperAdmin';
    } catch (err) { return false; }
  }

  function openPanel(url) {
    isPanelOpen = true;
    const panel = document.getElementById('brk-emb-panel');
    const iframe = document.getElementById('brk-emb-iframe');
    if (!panel || !iframe) return;
    panel.style.left = getSidebarWidth() + 'px';
    iframe.src = url;
    panel.classList.add('visible');
  }

  function closePanel() {
    isPanelOpen = false;
    const panel = document.getElementById('brk-emb-panel');
    const iframe = document.getElementById('brk-emb-iframe');
    if (panel) panel.classList.remove('visible');
    if (iframe) iframe.src = 'about:blank';
    TOOLS.forEach(function (t) {
      const el = document.getElementById(t.id);
      if (el) el.classList.remove.apply(el.classList, ACTIVE_CLASSES);
    });
  }

  function setupNavObserver() {
    const closeOnNav = function () {
      if (isPanelOpen && location.href !== lastUrl) closePanel();
      lastUrl = location.href;
    };
    window.addEventListener('popstate', closeOnNav);
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function () { origPush.apply(this, arguments); closeOnNav(); };
    history.replaceState = function () { origReplace.apply(this, arguments); closeOnNav(); };
  }

  function applyIcon(svg, tool) {
    if (!svg) return;
    svg.setAttribute('viewBox', '0 0 ' + tool.iconWidth + ' ' + tool.iconHeight);
    svg.setAttribute('width', '1em');
    svg.setAttribute('height', '1em');
    svg.innerHTML = tool.iconBody;
  }

  function injectIntoSettingsMenu() {
    if (!location.pathname.includes('/settings')) return;

    const links = Array.from(document.querySelectorAll('a[href*="/settings/"]'));
    if (links.length === 0) return;

    if (isPanelOpen) {
      links.forEach(function (a) {
        if (TOOLS.some(function (t) { return t.id === a.id; })) return;
        a.classList.remove.apply(a.classList, ACTIVE_CLASSES);
        a.classList.remove('router-link-active', 'router-link-exact-active');
        a.removeAttribute('aria-current');
      });
      TOOLS.forEach(function (t) {
        const el = document.getElementById(t.id);
        if (el && !el.classList.contains('active')) el.classList.add.apply(el.classList, ACTIVE_CLASSES);
      });
    }

    const refLink = links.find(function (l) {
      return !l.classList.contains('active') && !l.getAttribute('aria-current');
    }) || links[0];
    if (!refLink) return;

    const container = refLink.parentElement.tagName === 'LI'
      ? refLink.parentElement.parentElement
      : refLink.parentElement;

    [].concat(TOOLS).reverse().forEach(function (tool) {
      if (document.getElementById(tool.id)) return;

      const myItem = refLink.cloneNode(true);
      myItem.id = tool.id;
      myItem.href = '#';
      myItem.classList.remove.apply(myItem.classList, ACTIVE_CLASSES);
      myItem.classList.remove('router-link-active', 'router-link-exact-active');
      myItem.removeAttribute('aria-current');
      myItem.style.cursor = 'pointer';

      const span = Array.from(myItem.querySelectorAll('*')).find(function (s) {
        return s.childNodes.length === 1 && s.textContent.trim().length > 2;
      });
      if (span) span.textContent = tool.name;

      applyIcon(myItem.querySelector('svg'), tool);

      myItem.onclick = function (e) {
        e.preventDefault();
        container.querySelectorAll('a').forEach(function (a) {
          a.classList.remove.apply(a.classList, ACTIVE_CLASSES);
        });
        if (isPanelOpen) {
          closePanel();
        } else {
          openPanel(tool.url);
          myItem.classList.add.apply(myItem.classList, ACTIVE_CLASSES);
        }
      };

      if (refLink.parentElement.tagName === 'LI') {
        const li = document.createElement('li');
        li.className = refLink.parentElement.className;
        li.appendChild(myItem);
        container.insertBefore(li, container.firstChild);
      } else {
        container.insertBefore(myItem, container.firstChild);
      }
    });
  }

  async function init() {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return;
    injectCss();
    createPanel();
    setupNavObserver();
    setInterval(injectIntoSettingsMenu, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 500);
})();`;
}
