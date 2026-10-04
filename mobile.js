/* ============================================================
   SumbanePay — navegação mobile corrigida
   Compatível com:
   .sp-menu-toggle
   .mobile-menu-toggle
   .menu-toggle
   #menuToggle
   ============================================================ */

(function () {
    'use strict';

    if (window.__spMobileNavInit) {
        return;
    }

    window.__spMobileNavInit = true;

    /*
     * Aplicar o tema guardado
     */
    try {
        var savedTheme = localStorage.getItem('sumbanepay_theme');

        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (savedTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
        }
    } catch (error) {
        console.warn('Não foi possível carregar o tema:', error);
    }

    /*
     * Seletores utilizados nas páginas
     */
    var TOGGLE_SELECTOR =
        '.sp-menu-toggle, .mobile-menu-toggle, .menu-toggle, #menuToggle';

    var BACKDROP_SELECTOR =
        '.sp-sidebar-backdrop, .sidebar-backdrop, .sidebar-overlay';

    var OPEN_CLASS = 'sp-sidebar-open';
    var BACKDROP_ACTIVE = 'sp-backdrop-active';

    /*
     * Actualizar o estado visual do botão
     */
    function setToggleState(isOpen) {
        var buttons = document.querySelectorAll(TOGGLE_SELECTOR);

        buttons.forEach(function (button) {
            button.setAttribute('aria-expanded', String(isOpen));

            button.setAttribute(
                'aria-label',
                isOpen
                    ? 'Fechar menu de navegação'
                    : 'Abrir menu de navegação'
            );

            var icon = button.querySelector('i');

            if (icon) {
                icon.className = isOpen
                    ? 'bi bi-x-lg'
                    : 'bi bi-list';
            }
        });
    }

    /*
     * Abrir menu
     */
    function openMenu() {
        document.body.classList.add(OPEN_CLASS);

        var sidebar = document.querySelector('.sidebar');

        if (sidebar) {
            /*
             * Compatibilidade com páginas antigas
             * que utilizam .sidebar.open
             */
            sidebar.classList.add('open');
        }

        var backdrops = document.querySelectorAll(BACKDROP_SELECTOR);

        backdrops.forEach(function (backdrop) {
            backdrop.classList.add('show');
            backdrop.classList.add(BACKDROP_ACTIVE);
        });

        setToggleState(true);
    }

    /*
     * Fechar menu
     */
    function closeMenu() {
        document.body.classList.remove(OPEN_CLASS);

        var sidebar = document.querySelector('.sidebar');

        if (sidebar) {
            sidebar.classList.remove('open');
        }

        var backdrops = document.querySelectorAll(BACKDROP_SELECTOR);

        backdrops.forEach(function (backdrop) {
            backdrop.classList.remove('show');
            backdrop.classList.remove(BACKDROP_ACTIVE);
        });

        setToggleState(false);
    }

    /*
     * Alternar menu
     */
    function toggleMenu() {
        if (document.body.classList.contains(OPEN_CLASS)) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    /*
     * Garantir que existe apenas um botão de menu
     */
    function removeDuplicateButtons(topNav) {
        if (!topNav) {
            return;
        }

        var buttonsInsideNav =
            topNav.querySelectorAll(TOGGLE_SELECTOR);

        for (var i = 1; i < buttonsInsideNav.length; i++) {
            var duplicate = buttonsInsideNav[i];

            if (duplicate.parentNode) {
                duplicate.parentNode.removeChild(duplicate);
            }
        }
    }

    /*
     * Criar botão se a página não tiver nenhum
     */
    function ensureMenuButton(topNav) {
        if (!topNav) {
            return;
        }

        var existingButton =
            topNav.querySelector(TOGGLE_SELECTOR);

        if (existingButton) {
            return;
        }

        var button = document.createElement('button');

        button.type = 'button';
        button.className = 'sp-menu-toggle';
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute(
            'aria-label',
            'Abrir menu de navegação'
        );

        button.innerHTML =
            '<i class="bi bi-list" aria-hidden="true"></i>';

        topNav.insertBefore(button, topNav.firstChild);
    }

    /*
     * Ligar o botão de menu
     */
    function bindMenuButton(topNav) {
        if (!topNav) {
            return;
        }

        var button = topNav.querySelector(TOGGLE_SELECTOR);

        if (!button) {
            return;
        }

        /*
         * Remover onclick antigo para evitar
         * que o menu abra e feche duas vezes
         */
        button.onclick = null;

        /*
         * Clonar o botão para remover listeners antigos
         */
        var cleanButton = button.cloneNode(true);

        cleanButton.onclick = null;

        button.parentNode.replaceChild(cleanButton, button);

        cleanButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            toggleMenu();
        });

        cleanButton.setAttribute('aria-expanded', 'false');
        cleanButton.setAttribute(
            'aria-label',
            'Abrir menu de navegação'
        );
    }

    /*
     * Criar ou preparar o fundo escuro
     */
    function ensureBackdrop() {
        var backdrop =
            document.querySelector(BACKDROP_SELECTOR);

        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'sp-sidebar-backdrop';
            backdrop.setAttribute('aria-hidden', 'true');

            document.body.appendChild(backdrop);
        }

        backdrop.classList.add(BACKDROP_ACTIVE);
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.onclick = null;

        var cleanBackdrop = backdrop.cloneNode(true);

        cleanBackdrop.onclick = null;

        backdrop.parentNode.replaceChild(
            cleanBackdrop,
            backdrop
        );

        cleanBackdrop.addEventListener('click', function (event) {
            event.preventDefault();
            closeMenu();
        });

        return cleanBackdrop;
    }

    /*
     * Fechar menu ao clicar num link
     */
    function bindSidebarLinks(sidebar) {
        if (!sidebar) {
            return;
        }

        var links = sidebar.querySelectorAll('a');

        links.forEach(function (link) {
            var cleanLink = link.cloneNode(true);

            link.parentNode.replaceChild(cleanLink, link);

            cleanLink.addEventListener('click', function () {
                closeMenu();
            });
        });
    }

    /*
     * Inicialização
     */
    function initMenu() {
        var topNav = document.querySelector('.top-nav');
        var sidebar = document.querySelector('.sidebar');

        if (!topNav || !sidebar) {
            return;
        }

        ensureBackdrop();

        removeDuplicateButtons(topNav);

        ensureMenuButton(topNav);

        removeDuplicateButtons(topNav);

        bindMenuButton(topNav);

        bindSidebarLinks(sidebar);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeMenu();
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 991.98) {
                closeMenu();
            }
        });

        /*
         * Compatibilidade com onclick antigo do HTML
         */
        window.toggleSidebar = toggleMenu;
        window.closeSidebar = closeMenu;
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initMenu
        );
    } else {
        initMenu();
    }
})();
