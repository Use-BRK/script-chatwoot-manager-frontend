/**
 * chatwoot-test-banner.js
 * 
 * Script de TESTE para validar que o bundle está sendo injetado
 * corretamente no Chatwoot. Exibe um banner flutuante no canto
 * inferior direito com status e timestamp do deploy.
 *
 * Para usar:
 *   1. Cole este script no editor do Script Manager
 *   2. Faça deploy (Ctrl+Shift+B)
 *   3. Abra o painel do Chatwoot — o banner deve aparecer
 *
 * O banner some automaticamente após 15 segundos, ou clicando nele.
 */
(function () {
  "use strict";

  // Evita duplicação caso o script seja re-injetado
  if (document.getElementById("__cw_test_banner")) return;

  var banner = document.createElement("div");
  banner.id = "__cw_test_banner";

  var now = new Date();
  var ts = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  banner.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px">' +
    '<span style="font-size:18px">✅</span>' +
    "<div>" +
    '<strong style="font-size:13px">Bundle ativo!</strong><br>' +
    '<span style="font-size:11px;opacity:.8">Injetado às ' + ts + "</span>" +
    "</div>" +
    "</div>";

  Object.assign(banner.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "99999",
    background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    color: "#f1f5f9",
    padding: "12px 18px",
    borderRadius: "10px",
    boxShadow: "0 4px 24px rgba(0,0,0,.35)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "13px",
    cursor: "pointer",
    transition: "opacity .4s ease, transform .4s ease",
    opacity: "0",
    transform: "translateY(16px)",
  });

  document.body.appendChild(banner);

  // Animação de entrada
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      banner.style.opacity = "1";
      banner.style.transform = "translateY(0)";
    });
  });

  // Fecha ao clicar
  banner.addEventListener("click", function () {
    dismiss();
  });

  // Auto-dismiss após 15s
  var timer = setTimeout(dismiss, 15000);

  function dismiss() {
    clearTimeout(timer);
    banner.style.opacity = "0";
    banner.style.transform = "translateY(16px)";
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 400);
  }

  // Log no console pra debug
  console.log(
    "%c[chatwoot-bundle] ✅ Script de teste injetado com sucesso às " + ts,
    "color: #22c55e; font-weight: bold;"
  );
})();
