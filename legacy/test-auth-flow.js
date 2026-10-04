#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const guardSource = fs.readFileSync('/home/ubuntu/auth-guard.js', 'utf8');
const dashboard = fs.readFileSync('/home/ubuntu/dashboard-sumbanepay-logout-corrigido.html', 'utf8');
const login = fs.readFileSync('/home/ubuntu/login-sumbanepay-corrigido.html', 'utf8');

class Storage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  keys() { return [...this.data.keys()]; }
}

function createGuardContext(session = null) {
  const sessionStorage = new Storage();
  const localStorage = new Storage();
  if (session) sessionStorage.setItem('sumbanepay_session', JSON.stringify(session));
  const location = {
    href: 'https://example.test/pages/dashboard.html',
    replacedWith: null,
    replace(url) { this.replacedWith = url; }
  };
  const context = {
    URL,
    window: {
      sessionStorage,
      localStorage,
      location,
      URL,
      SumbanePayAuth: undefined
    }
  };
  context.window.window = context.window;
  vm.runInNewContext(guardSource, context);
  return { context, sessionStorage, localStorage, location };
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

test('acesso direto sem sessão redireciona para login', () => {
  const { location } = createGuardContext();
  assert.match(location.replacedWith, /\/pages\/login\.html\?reason=unauthorized$/);
});

test('sessão válida permite acesso direto', () => {
  const state = createGuardContext({ userId: 'u1' });
  assert.equal(state.context.window.SumbanePayAuth.readSession().userId, 'u1');
  assert.equal(state.context.window.SumbanePayAuth.requireAuthentication(), true);
  assert.equal(state.location.replacedWith, null);
});

test('logout limpa sessão e redireciona para login', () => {
  const { context, sessionStorage, localStorage, location } = createGuardContext();
  sessionStorage.setItem('sumbanepay_session', JSON.stringify({ userId: 'u1' }));
  localStorage.setItem('sz_session', 'u1');
  context.window.SumbanePayAuth.logout();
  assert.equal(sessionStorage.getItem('sumbanepay_session'), null);
  assert.equal(localStorage.getItem('sz_session'), null);
  assert.match(location.replacedWith, /\/pages\/login\.html\?reason=logout$/);
});

test('dashboard contém botões Sair e guarda de histórico', () => {
  assert.match(dashboard, /onclick="logout\(\)"/);
  assert.match(dashboard, /addEventListener\('popstate'/);
  assert.match(dashboard, /clearAuthentication\(\)/);
  assert.match(dashboard, /login\.html\?logout=/);
  assert.match(dashboard, /auth-guard\.js/);
});

test('login redireciona Voltar do navegador e Sair para index', () => {
  assert.match(login, /function goToMain\(/);
  assert.match(login, /addEventListener\('popstate'/);
  assert.match(login, /new URL\('\.\.\/index\.html'/);
  assert.match(login, /btn-exit-main/);
});

console.log('Todos os testes de autenticação passaram.');
