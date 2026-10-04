/* ============================================================
   SumbanePay — mobile navigation enhancement v3
   Fonte única do menu mobile.

   Funciona com QUALQUER combinação que já tenhas no HTML:
     - botão:    .sp-menu-toggle | .mobile-menu-toggle | .menu-toggle | #menuToggle
     - backdrop: .sp-sidebar-backdrop | .sidebar-backdrop | .sidebar-overlay
     - onclick inline: toggleSidebar() / closeSidebar()

   Faz:
     1. Remove botões de menu duplicados (mantém 1 só).
     2. Reutiliza o backdrop existente (não cria outro).
     3. Neutraliza onclick inline para não haver duplo toggle.
     4. Expõe window.toggleSidebar / window.closeSidebar.
     5. Abre/fecha via body.sp-sidebar-open (o que o responsive.css espera).
   ============================================================ */
(function () {
  'use strict';

  // Guarda contra dupla inclusão do ficheiro
  if (window.__spMobileNavInit) return;
  window.__spMobileNavInit = true;

  // -----------------------------------------------------------
  // Aplicar tema guardado antes da página ficar interativa
  // -----------------------------------------------------------
  try {
    var savedTheme = localStorage.getItem('sumbanepay_theme');
    if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (savedTheme === 'light') document.documentElement.removeAttribute('data-theme');
  } catch (e) {}

  // -----------------------------------------------------------
  // Constantes
  // -----------------------------------------------------------
  var TOGGLE_SELECTOR =
    '.sp-menu-toggle, .mobile-menu-toggle, .menu-toggle, #menuToggle';

  var BACKDROP_SELECTOR =
    '.sp-sidebar-backdrop, .sidebar-backdrop, .sidebar-overlay';

  var OPEN_CLASS      = 'sp-sidebar-open';
  var BACKDROP_ACTIVE = 'sp-backdrop-active';

  // -----------------------------------------------------------
  // Abrir / fechar / toggle
  // -----------------------------------------------------------
  function openMenu() {
    document.body.classList.add(OPEN_CLASS);
    setToggleState(true);
  }

  function closeMenu() {
    document.body.classList.remove(OPEN_CLASS);
    setToggleState(false);
  }

  function toggleMenu() {
    if (document.body.classList.contains(OPEN_CLASS)) closeMenu();
    else openMenu();
  }

  // -----------------------------------------------------------
  // Atualizar estado visual e ARIA do botão
  // -----------------------------------------------------------
  function setToggleState(isOpen) {
    var toggles = document.querySelectorAll(TOGGLE_SELECTOR);
    toggles.forEach(function (btn) {
      btn.setAttribute('aria-expanded', String(isOpen));
      btn.setAttribute('aria-label', isOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
      var icon = btn.querySelector('i');
      if (icon) icon.className = isOpen ? 'bi bi-x-lg' : 'bi bi-list';
    });
  }

  // -----------------------------------------------------------
  // Remover botões duplicados — mantém só o primeiro dentro do .top-nav
  // -----------------------------------------------------------
  function dedupeToggles(topNav) {
    if (!topNav) return;

    // 1) Todos os botões que existem dentro do top-nav
    var insideNav = topNav.querySelectorAll(TOGGLE_SELECTOR);
    for (var i = 1; i < insideNav.length; i++) {
      insideNav[i].parentNode && insideNav[i].parentNode.removeChild(insideNav[i]);
    }

    // 2) Botões duplicados FORA do top-nav (ex.: dentro do .app-main)
    //    Só remove se não estiverem dentro do top-nav.
    var all = document.querySelectorAll(TOGGLE_SELECTOR);
    var seenInNav = false;
    all.forEach(function (btn) {
      var inNav = topNav.contains(btn);
      if (inNav) {
        if (seenInNav) {
          btn.parentNode && btn.parentNode.removeChild(btn);
        } else {
          seenInNav = true;
        }
      }
    });
  }

  // -----------------------------------------------------------
  // Garantir que existe pelo menos um botão.
  // Se não existir nenhum, cria um .sp-menu-toggle no início do top-nav.
  // -----------------------------------------------------------
  function ensureToggleExists(topNav) {
    if (!topNav) return;
    if (topNav.querySelector(TOGGLE_SELECTOR)) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-menu-toggle';
    btn.setAttribute('aria-label', 'Abrir menu de navegação');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
    topNav.insertBefore(btn, topNav.firstChild);
  }

  // -----------------------------------------------------------
  // Ligar o clique a UM só botão.
  // Neutraliza onclick inline para não haver duplo toggle.
  // -----------------------------------------------------------
  function bindToggle(topNav) {
    if (!topNav) return;

    var btn = topNav.querySelector(TOGGLE_SELECTOR);
    if (!btn) return;

    // Neutralizar handlers inline antigos (onclick="toggleSidebar()" etc.)
    btn.onclick = null;

    // Remover listeners antigos clonando o nó — assim garantimos que
    // só existe UM listener, mesmo que este script corra duas vezes.
    var clone = btn.cloneNode(true);
    clone.onclick = null;
    btn.parentNode.replaceChild(clone, btn);
    btn = clone;

    // Ligar o handler único
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    // Estado inicial
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Abrir menu de navegação');
  }

  // -----------------------------------------------------------
  // Backdrop — reutiliza o que o HTML já tem; só cria se faltar.
  // -----------------------------------------------------------
  function ensureBackdrop() {
    var backdrop = document.querySelector(BACKDROP_SELECTOR);

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sp-sidebar-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    // Normalizar: garantir a classe de ativação e um único handler
    backdrop.classList.add(BACKDROP_ACTIVE);
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.onclick = null;

    // Clonar para limpar listeners antigos
    var clone = backdrop.cloneNode(true);
    clone.onclick = null;
    backdrop.parentNode.replaceChild(clone, backdrop);

    clone.addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu();
    });

    return clone;
  }

  // -----------------------------------------------------------
  // Fechar menu ao clicar num link do sidebar
  // -----------------------------------------------------------
  function bindSidebarLinks(sidebar) {
    if (!sidebar) return;
    sidebar.querySelectorAll('a').forEach(function (link) {
      // Clonar para limpar handlers antigos
      var clone = link.cloneNode(true);
      link.parentNode.replaceChild(clone, link);
      clone.addEventListener('click', closeMenu);
    });
  }

  // -----------------------------------------------------------
  // Init
  // -----------------------------------------------------------
  function init() {
    var topNav  = document.querySelector('.top-nav');
    var sidebar = document.querySelector('.sidebar');

    if (!topNav || !sidebar) return;

    // 1) Backdrop
    ensureBackdrop();

    // 2) Botões: remover duplicados, garantir pelo menos um
    dedupeToggles(topNav);
    ensureToggleExists(topNav);
    // Remover duplicados outra vez (caso ensureToggleExists tenha criado)
    dedupeToggles(topNav);

    // 3) Ligar clique (um só handler)
    bindToggle(topNav);

    // 4) Links do sidebar fecham o menu
    bindSidebarLinks(sidebar);

    // 5) ESC fecha
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });

    // 6) Ao passar para desktop, garantir que fecha
    window.addEventListener('resize', function () {
      if (window.innerWidth > 991.98) closeMenu();
    });

    // 7) Expor funções globais para o HTML continuar a funcionar
    //    (onclick="toggleSidebar()" / onclick="closeSidebar()")
    window.toggleSidebar = toggleMenu;
    window.closeSidebar  = closeMenu;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();