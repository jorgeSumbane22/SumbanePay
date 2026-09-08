/* SumbanePay — mobile navigation enhancement */
(function () {
  'use strict';
  // Apply the saved choice before the rest of the page becomes interactive.
  try {
    var savedTheme = localStorage.getItem('sumbanepay_theme');
    if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (savedTheme === 'light') document.documentElement.removeAttribute('data-theme');
  } catch (error) { /* localStorage can be unavailable in privacy mode */ }
  function closeMenu() { document.body.classList.remove('sp-sidebar-open'); }
  function init() {
    var sidebar = document.querySelector('.sidebar');
    var topNav = document.querySelector('.top-nav');
    if (!sidebar || !topNav) return;
    if (!document.querySelector('.sp-sidebar-backdrop')) {
      var backdrop = document.createElement('div');
      backdrop.className = 'sp-sidebar-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.addEventListener('click', closeMenu);
      document.body.appendChild(backdrop);
    }
    if (!topNav.querySelector('.sp-menu-toggle')) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sp-menu-toggle';
      button.setAttribute('aria-label', 'Abrir menu de navegação');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
      button.addEventListener('click', function () {
        var isOpen = document.body.classList.toggle('sp-sidebar-open');
        button.setAttribute('aria-expanded', String(isOpen));
        button.setAttribute('aria-label', isOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
        button.querySelector('i').className = isOpen ? 'bi bi-x-lg' : 'bi bi-list';
      });
      topNav.insertBefore(button, topNav.firstChild);
    }
    sidebar.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeMenu(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
