(function () {
    'use strict';

    var menuButtonSelector =
        '.sp-menu-toggle, .mobile-menu-toggle, .menu-toggle, #menuToggle';

    var backdropSelector =
        '.sp-sidebar-backdrop, .sidebar-backdrop, .sidebar-overlay';

    var sidebar;
    var menuButton;
    var backdrop;

    function findElements() {
        sidebar = document.querySelector('.sidebar');
        menuButton = document.querySelector(menuButtonSelector);
        backdrop = document.querySelector(backdropSelector);
    }

    function setButtonState(open) {
        if (!menuButton) {
            return;
        }

        menuButton.setAttribute(
            'aria-expanded',
            open ? 'true' : 'false'
        );

        menuButton.setAttribute(
            'aria-label',
            open
                ? 'Fechar menu'
                : 'Abrir menu'
        );

        var icon = menuButton.querySelector('i');

        if (icon) {
            icon.className = open
                ? 'bi bi-x-lg'
                : 'bi bi-list';
        }
    }

    function openMenu() {
        findElements();

        if (sidebar) {
            sidebar.classList.add('open');
        }

        document.body.classList.add('sp-sidebar-open');

        if (backdrop) {
            backdrop.classList.add('show');
            backdrop.classList.add('sp-backdrop-active');
        }

        setButtonState(true);
    }

    function closeMenu() {
        findElements();

        if (sidebar) {
            sidebar.classList.remove('open');
        }

        document.body.classList.remove('sp-sidebar-open');

        if (backdrop) {
            backdrop.classList.remove('show');
            backdrop.classList.remove('sp-backdrop-active');
        }

        setButtonState(false);
    }

    function toggleMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        findElements();

        if (
            sidebar &&
            sidebar.classList.contains('open')
        ) {
            closeMenu();
        } else if (
            document.body.classList.contains('sp-sidebar-open')
        ) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    function createMenuButtonIfNecessary() {
        var topNav = document.querySelector('.top-nav');

        if (!topNav) {
            return;
        }

        menuButton = topNav.querySelector(menuButtonSelector);

        if (menuButton) {
            return;
        }

        menuButton = document.createElement('button');

        menuButton.type = 'button';
        menuButton.className = 'mobile-menu-toggle';
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Abrir menu');

        menuButton.innerHTML =
            '<i class="bi bi-list" aria-hidden="true"></i>';

        topNav.insertBefore(
            menuButton,
            topNav.firstChild
        );
    }

    function createBackdropIfNecessary() {
        backdrop = document.querySelector(backdropSelector);

        if (backdrop) {
            return;
        }

        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');

        document.body.appendChild(backdrop);
    }

    function removeDuplicateButtons() {
        var buttons = document.querySelectorAll(
            menuButtonSelector
        );

        if (buttons.length <= 1) {
            return;
        }

        for (var i = 1; i < buttons.length; i++) {
            if (buttons[i].parentNode) {
                buttons[i].parentNode.removeChild(buttons[i]);
            }
        }
    }

    function initialiseMenu() {
        findElements();

        if (!sidebar) {
            return;
        }

        createMenuButtonIfNecessary();
        createBackdropIfNecessary();
        removeDuplicateButtons();
        findElements();

        if (menuButton) {
            menuButton.onclick = null;

            menuButton.addEventListener(
                'click',
                toggleMenu
            );
        }

        if (backdrop) {
            backdrop.onclick = function (event) {
                event.preventDefault();
                closeMenu();
            };
        }

        var links = sidebar.querySelectorAll('a');

        for (var i = 0; i < links.length; i++) {
            links[i].addEventListener(
                'click',
                closeMenu
            );
        }

        document.addEventListener(
            'keydown',
            function (event) {
                if (event.key === 'Escape') {
                    closeMenu();
                }
            }
        );

        window.addEventListener(
            'resize',
            function () {
                if (window.innerWidth > 991) {
                    closeMenu();
                }
            }
        );

        window.toggleSidebar = toggleMenu;
        window.closeSidebar = closeMenu;

        setButtonState(false);
    }

    window.openSumbaneMenu = openMenu;
    window.closeSumbaneMenu = closeMenu;
    window.toggleSumbaneMenu = toggleMenu;

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initialiseMenu
        );
    } else {
        initialiseMenu();
    }
})();
