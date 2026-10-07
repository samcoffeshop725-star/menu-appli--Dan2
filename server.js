'use strict';
/*
 * VERSION TOUT-EN-UN — ne modifiez pas ce fichier à la main (généré par build-standalone.js)
 * Boutique Telegram Mini App — serveur sans dépendance (Node.js 18+)
 * - Sert la mini-app (/) et le panel admin (/admin)
 * - API JSON + stockage dans data/db.json + images dans public/uploads
 * - Bot Telegram (long polling) avec bouton "Ouvrir la boutique"
 * - Envoi des commandes sur WhatsApp (CallMeBot, WhatsApp Cloud API ou lien wa.me) ou Signal (lien signal.me)
 * - News, notifications d'accueil, statistiques de visites, fichier clients exportable
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadEnv(path.join(__dirname, '.env'));

const APP_VERSION = '1.5 — news, notifications, Signal, visites, clients';

const CFG = {
  port: Number(process.env.PORT) || 3000,
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  adminPhone: (process.env.ADMIN_PHONE || '').replace(/\D/g, ''),
  botToken: (process.env.BOT_TOKEN || '').trim(),
  webappUrl: (process.env.WEBAPP_URL || '').trim().replace(/\/+$/, ''),
  adminChatId: (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim(),
  requireTelegram: process.env.REQUIRE_TELEGRAM === 'true',
  // IDs Telegram ayant l'accès admin direct (en plus de ceux ajoutés dans le panel)
  adminTgIds: (process.env.ADMIN_TELEGRAM_IDS || '').split(/[\s,;]+/).filter((x) => /^\d+$/.test(x)),
  wa: {
    provider: (process.env.WHATSAPP_PROVIDER || 'link').trim().toLowerCase(), // link | callmebot | cloud
    callmebotKey: (process.env.CALLMEBOT_APIKEY || '').trim(),
    cloudToken: (process.env.WHATSAPP_CLOUD_TOKEN || '').trim(),
    cloudPhoneId: (process.env.WHATSAPP_CLOUD_PHONE_ID || '').trim(),
  },
};

// Version « tout-en-un » : remplis automatiquement par build-standalone.js
let EMBEDDED_FILES = {"/admin.css":":root { --bg: #070812; --panel: #0f1122; --panel2: #151832; --line: #242848; --text: #eef1ff; --muted: #9aa3c7; --accent: #00f0ff; --accent2: #b44cff; --ok: #39ff88; --err: #ff4d6d; --warn: #ffc94d; }\n* { box-sizing: border-box; }\nhtml, body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 'Inter', system-ui, sans-serif; }\nbody { background: radial-gradient(900px 500px at 0 -10%, rgba(0, 240, 255, .1), transparent 60%), radial-gradient(900px 500px at 100% 0, rgba(180, 76, 255, .1), transparent 60%), var(--bg); min-height: 100vh; }\nbutton, input, select, textarea { font: inherit; color: inherit; }\nbutton { cursor: pointer; }\n[hidden] { display: none !important; }\nh1, h2, h3 { margin: 0; }\na { color: var(--accent); }\n\n.login { min-height: 100vh; display: grid; place-items: center; padding: 16px; }\n.login form { width: min(380px, 100%); padding: 28px; }\n.brand { font: 900 20px 'Orbitron', sans-serif; letter-spacing: .08em; background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; background-clip: text; color: transparent; }\n\n.card { background: rgba(15, 17, 34, .85); border: 1px solid var(--line); border-radius: 18px; }\n.top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: rgba(7, 8, 18, .85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }\n.top .sp { flex: 1; }\n.tabs { display: flex; gap: 6px; overflow-x: auto; padding: 12px 20px; border-bottom: 1px solid var(--line); scrollbar-width: none; }\n.tabs button { flex: none; border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 8px 14px; font-weight: 600; color: var(--muted); display: flex; gap: 6px; align-items: center; }\n.tabs button.on { color: var(--accent); border-color: var(--accent); box-shadow: 0 0 16px rgba(0, 240, 255, .25); }\n.tabs .pill { background: var(--accent2); color: #fff; border-radius: 8px; padding: 0 6px; font-size: 11px; }\n.wrap { max-width: 1240px; margin: 0 auto; padding: 20px; }\n.layout { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }\n@media (min-width: 1050px) { .layout.with-preview { grid-template-columns: 1fr 390px; } }\n.preview { position: sticky; top: 76px; padding: 14px; }\n.preview iframe { width: 100%; height: 720px; border: 1px solid var(--line); border-radius: 22px; background: #000; display: block; }\n.preview-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; color: var(--muted); font-weight: 600; }\n\n.sec { padding: 20px; margin-bottom: 16px; }\n.sec > h2 { font-size: 16px; margin-bottom: 4px; }\n.sec > .hint { color: var(--muted); margin: 0 0 16px; font-size: 13px; }\n.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }\n.f { display: flex; flex-direction: column; gap: 6px; }\n.f.full { grid-column: 1 / -1; }\n.f > label, .lab { font-size: 12px; font-weight: 600; color: var(--muted); }\n.f small { color: var(--muted); font-size: 12px; }\n.in { width: 100%; min-height: 42px; padding: 9px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel2); outline: 0; }\n.in:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0, 240, 255, .15); }\ntextarea.in { min-height: 90px; resize: vertical; }\ninput[type=color].in { padding: 4px; height: 42px; cursor: pointer; }\ninput[type=range] { width: 100%; accent-color: var(--accent); }\n.range-row { display: flex; justify-content: space-between; }\n.range-row b { color: var(--accent); font-family: 'Orbitron', sans-serif; font-size: 12px; }\n.check { display: flex; gap: 10px; align-items: center; cursor: pointer; user-select: none; }\n.check input { width: 18px; height: 18px; accent-color: var(--accent); }\n\n.btn { border: 0; border-radius: 12px; padding: 10px 16px; font-weight: 700; background: linear-gradient(95deg, var(--accent), var(--accent2)); color: #05060f; display: inline-flex; gap: 6px; align-items: center; justify-content: center; white-space: nowrap; }\n.btn:disabled { opacity: .6; }\n.btn.ghost { background: var(--panel2); color: var(--text); border: 1px solid var(--line); }\n.btn.danger { background: rgba(255, 77, 109, .12); color: var(--err); border: 1px solid rgba(255, 77, 109, .4); }\n.btn.sm { padding: 6px 10px; font-size: 12px; border-radius: 10px; }\n.btn.block { width: 100%; }\n.actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }\n.bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }\n.bar .in { width: auto; flex: 1; min-width: 160px; }\n\n.imgf { display: flex; gap: 12px; align-items: center; }\n.imgf-prev { width: 84px; height: 84px; border-radius: 14px; border: 1px dashed var(--line); background: var(--panel2) center / cover no-repeat; flex: none; display: grid; place-items: center; font-size: 11px; color: var(--muted); text-align: center; }\n.imgf.wide .imgf-prev { width: 150px; height: 96px; }\n.imgf-actions { display: flex; flex-direction: column; gap: 6px; }\n.imgf.loading .imgf-prev { animation: pulse 1s infinite; }\n@keyframes pulse { 50% { opacity: .4; } }\n\n.rows { display: flex; flex-direction: column; gap: 10px; }\n.row { display: grid; gap: 10px; align-items: center; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel2); }\n.row.cat { grid-template-columns: auto 1fr auto; }\n.row.soc { grid-template-columns: 140px 1fr 1fr 1.6fr auto; }\n.row.rev { grid-template-columns: 1fr; }\n.row .ctl { display: flex; gap: 6px; }\n@media (max-width: 800px) { .row.soc { grid-template-columns: 1fr 1fr; } .row.soc .ctl { grid-column: 1 / -1; } }\n@media (max-width: 560px) { .row.cat { grid-template-columns: 1fr; } }\n\n.plist { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }\n.pitem { display: flex; gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel2); align-items: center; }\n.pitem.off { opacity: .5; }\n.pitem .th { width: 64px; height: 64px; border-radius: 12px; background: #0b0d20 center / cover; flex: none; }\n.pitem .info { flex: 1; min-width: 0; }\n.pitem .info b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.pitem .info small { color: var(--muted); display: block; }\n.g { color: #00f0ff; text-shadow: 0 0 8px rgba(0, 240, 255, .7); font-weight: 700; }\n.e { color: #39ff88; text-shadow: 0 0 8px rgba(57, 255, 136, .7); font-weight: 700; }\n.opt-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-bottom: 8px; align-items: center; }\n.suffix { position: relative; }\n.suffix span { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }\n.suffix .in { padding-right: 34px; }\n\n.presets { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }\n.preset { border: 1px solid var(--line); background: var(--panel2); border-radius: 14px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; font-weight: 600; }\n.preset i { width: 34px; height: 20px; border-radius: 6px; display: block; }\n.preset.on { border-color: var(--accent); }\n\n.order { padding: 16px; margin-bottom: 12px; }\n.order .oh { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }\n.order .oh b { font-family: 'Orbitron', sans-serif; color: var(--accent); }\n.order .oh .sp { flex: 1; }\n.order table { width: 100%; border-collapse: collapse; margin: 8px 0; }\n.order td { padding: 5px 0; border-bottom: 1px dashed var(--line); }\n.order td:last-child { text-align: right; }\n.order .cust { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 16px; color: #cdd3ee; font-size: 13px; }\n.st { padding: 3px 9px; border-radius: 8px; font-size: 12px; font-weight: 700; }\n.st-nouvelle { background: rgba(0, 240, 255, .15); color: var(--accent); }\n.st-confirmée { background: rgba(180, 76, 255, .18); color: #d49cff; }\n.st-expédiée { background: rgba(255, 201, 77, .15); color: var(--warn); }\n.st-livrée { background: rgba(57, 255, 136, .15); color: var(--ok); }\n.st-annulée { background: rgba(255, 77, 109, .15); color: var(--err); }\n.flag { font-size: 12px; color: var(--muted); }\n\n.status-list { display: grid; gap: 10px; }\n.status-item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel2); }\n.dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex: none; }\n.dot.ok { background: var(--ok); box-shadow: 0 0 10px var(--ok); }\n.dot.ko { background: var(--err); box-shadow: 0 0 10px var(--err); }\n.dot.mid { background: var(--warn); box-shadow: 0 0 10px var(--warn); }\n.status-item small { color: var(--muted); display: block; }\ncode { background: #1c2040; padding: 1px 6px; border-radius: 6px; font-size: 12px; }\n\n.modal { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; }\n.modal-bg { position: absolute; inset: 0; background: rgba(0, 0, 0, .65); backdrop-filter: blur(4px); }\n.modal-box { position: relative; width: min(720px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; padding: 22px; background: var(--panel); border: 1px solid var(--line); border-radius: 20px; }\n.modal-box h2 { margin-bottom: 16px; font-size: 18px; }\n\n.toast { position: fixed; z-index: 70; left: 50%; bottom: 24px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none; padding: 12px 18px; border-radius: 12px; background: #11142a; border: 1px solid var(--accent); font-weight: 600; transition: all .25s; box-shadow: 0 0 20px rgba(0, 240, 255, .3); }\n.toast.show { opacity: 1; transform: translate(-50%, 0); }\n.toast.err { border-color: var(--err); box-shadow: 0 0 20px rgba(255, 77, 109, .3); }\n.muted { color: var(--muted); }\n.empty { padding: 30px; text-align: center; color: var(--muted); }\n.warnbox { padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255, 201, 77, .4); background: rgba(255, 201, 77, .08); color: #ffe3a0; margin-bottom: 16px; font-size: 13px; }\n.check.f { flex-direction: row; align-items: center; }\n@media (max-width: 1049px) { .preview { display: none; } }\n@media (max-width: 600px) { .wrap { padding: 14px; } .top { padding: 10px 14px; } .top .muted { display: none; } .tabs { padding: 10px 14px; } .sec { padding: 16px; } }\n.login-card { position: relative; box-shadow: 0 0 0 1px rgba(0, 240, 255, .15), 0 20px 60px rgba(0, 0, 0, .5), 0 0 60px rgba(180, 76, 255, .15); }\n.login-ico { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 20px; display: grid; place-items: center; font-size: 28px; border: 1px solid var(--accent); box-shadow: 0 0 22px rgba(0, 240, 255, .45), inset 0 0 14px rgba(0, 240, 255, .2); }\n.eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); border: 0; background: none; font-size: 16px; padding: 6px; opacity: .7; }\n.back-link { display: block; text-align: center; margin-top: 16px; color: var(--muted); font-size: 13px; text-decoration: none; }\n.vidf { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }\n.vid-prev { width: 200px; height: 118px; border-radius: 12px; border: 1px dashed var(--line); background: #0b0d20; display: grid; place-items: center; overflow: hidden; flex: none; font-size: 12px; }\n.vid-prev video, .vid-prev iframe { width: 100%; height: 100%; border: 0; display: block; object-fit: cover; background: #000; }\n@media (max-width: 560px) { .vidf { flex-direction: column; align-items: stretch; } .vid-prev { width: 100%; } }\n\n/* ============ v1.5 : visites, clients ============ */\n.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-bottom: 16px; }\n.kpi { padding: 16px 18px; }\n.kpi .kv { font: 900 30px 'Orbitron', sans-serif; color: var(--accent); text-shadow: 0 0 14px rgba(0, 240, 255, .5); margin: 4px 0 2px; }\n.kpi small { color: var(--muted); font-size: 12px; }\n.kpi .up { color: var(--ok); font-weight: 700; } .kpi .down { color: var(--err); font-weight: 700; }\n.chart { display: grid; grid-template-columns: repeat(30, 1fr); gap: 3px; align-items: end; height: 170px; padding-top: 18px; }\n.chart .bar { position: relative; height: 100%; display: flex; align-items: flex-end; }\n.chart .bar i { display: block; width: 100%; min-height: 2px; border-radius: 4px 4px 0 0; background: linear-gradient(180deg, var(--accent), var(--accent2)); box-shadow: 0 0 10px rgba(0, 240, 255, .35); }\n.chart .bar span { position: absolute; left: 50%; transform: translateX(-50%); top: -16px; font-size: 10px; color: var(--muted); }\n.chart .bar:not(:hover) span { visibility: hidden; } .chart .bar:last-child span { visibility: visible; color: var(--accent); }\n.chart-x { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; margin-top: 6px; }\n.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }\n.tbl th { text-align: left; color: var(--muted); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--line); }\n.tbl td { padding: 7px 8px; border-bottom: 1px dashed var(--line); vertical-align: top; }\n@media (max-width: 640px) { .tbl th:nth-child(5), .tbl td:nth-child(5) { display: none; } .chart { height: 130px; } }\n","/admin.html":"<!doctype html>\n<html lang=\"fr\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <meta name=\"robots\" content=\"noindex\">\n  <title>Panel admin</title>\n  <script src=\"https://telegram.org/js/telegram-web-app.js\"></script>\n  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@700;900&display=swap\" rel=\"stylesheet\">\n  <link rel=\"stylesheet\" href=\"/admin.css\">\n</head>\n<body>\n  <div id=\"root\"></div>\n  <div class=\"modal\" id=\"modal\" hidden><div class=\"modal-bg\" data-act=\"modal-close\"></div><div class=\"modal-box\" id=\"modalBox\"></div></div>\n  <div class=\"toast\" id=\"toast\"></div>\n  <script src=\"/admin.js\"></script>\n</body>\n</html>\n","/admin.js":"/* Panel admin — boutique néon */\n(() => {\n  'use strict';\n\n  const $ = (s, r = document) => r.querySelector(s);\n  const $$ = (s, r = document) => [...r.querySelectorAll(s)];\n  const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));\n  const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);\n  const g = (n) => new Intl.NumberFormat('fr-FR').format(n || 0) + ' g';\n  const store = {\n    get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },\n    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* */ } },\n  };\n  const root = $('#root');\n  const tg = window.Telegram && window.Telegram.WebApp;\n  if (tg) { try { tg.ready(); tg.expand(); } catch (e) { /* */ } }\n  const initData = () => {\n    if (tg && tg.initData) return tg.initData;\n    try { return sessionStorage.getItem('tg_init') || ''; } catch (e) { return ''; }\n  };\n  const inTelegram = () => !!initData();\n\n  let TOKEN = store.get('adm_token');\n  let D = null; // données chargées\n  let tab = location.hash.slice(1) || 'stats';\n\n  const TABS = [\n    ['stats', '📊', 'Visites'], ['general', '⚙️', 'Général'], ['news', '📰', 'News'], ['notices', '🔔', 'Notifications'], ['theme', '🎨', 'Thème'], ['categories', '🗂️', 'Catégories'], ['products', '📦', 'Produits'],\n    ['reviews', '⭐', 'Avis'], ['socials', '🔗', 'Réseaux'], ['orders', '🧾', 'Commandes'], ['customers', '📇', 'Clients'], ['integrations', '🔌', 'Intégrations'],\n  ];\n  const SOCIAL_TYPES = { instagram: 'Instagram', tiktok: 'TikTok', telegram: 'Telegram', snapchat: 'Snapchat', whatsapp: 'WhatsApp', facebook: 'Facebook', x: 'X / Twitter', youtube: 'YouTube', signal: 'Signal', website: 'Site web' };\n  const PRESETS = {\n    cyber: { name: 'Cyber', accent: '#00f0ff', accent2: '#b44cff', gramColor: '#00f0ff', priceColor: '#39ff88', bgColor: '#05060f' },\n    toxic: { name: 'Toxic', accent: '#39ff14', accent2: '#00ffa3', gramColor: '#39ff14', priceColor: '#f5ff4d', bgColor: '#040a06' },\n    sunset: { name: 'Sunset', accent: '#ff2bd6', accent2: '#ff8a00', gramColor: '#ff5ce1', priceColor: '#ffd23f', bgColor: '#0d0510' },\n    ice: { name: 'Ice', accent: '#7df9ff', accent2: '#4d7cff', gramColor: '#a6fbff', priceColor: '#ffffff', bgColor: '#040814' },\n    gold: { name: 'Gold', accent: '#ffcf4d', accent2: '#ff6b3d', gramColor: '#ffcf4d', priceColor: '#ffe9a8', bgColor: '#0a0804' },\n    blood: { name: 'Blood', accent: '#ff1f4b', accent2: '#8a2bff', gramColor: '#ff4d6d', priceColor: '#ff9eb1', bgColor: '#0a0306' },\n  };\n\n  /* ---------------- API ---------------- */\n  async function api(method, url, body) {\n    const r = await fetch(url, {\n      method,\n      headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },\n      body: body !== undefined ? JSON.stringify(body) : undefined,\n    });\n    const j = await r.json().catch(() => ({}));\n    if (r.status === 401 && url !== '/api/admin/login') { logout(); throw new Error('Session expirée, reconnectez-vous'); }\n    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);\n    return j;\n  }\n\n  let toastT;\n  function toast(msg, err) {\n    const t = $('#toast');\n    t.textContent = msg;\n    t.classList.toggle('err', !!err);\n    t.classList.add('show');\n    clearTimeout(toastT);\n    toastT = setTimeout(() => t.classList.remove('show'), 2600);\n  }\n\n  async function withBusy(btn, fn) {\n    const txt = btn ? btn.innerHTML : '';\n    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }\n    try { await fn(); } catch (e) { toast(e.message, true); } finally { if (btn) { btn.disabled = false; btn.innerHTML = txt; } }\n  }\n\n  /* ---------------- connexion ---------------- */\n  function renderLogin() {\n    root.innerHTML = `<div class=\"login\"><form class=\"card login-card\" id=\"loginForm\" autocomplete=\"on\">\n      <div class=\"login-ico\">🔐</div>\n      <div class=\"brand\" style=\"text-align:center;margin-bottom:6px\">ACCÈS ADMIN</div>\n      <p class=\"muted\" style=\"margin:0 0 20px;text-align:center\">Réservé à l'administrateur de la boutique.</p>\n      <div class=\"f\" style=\"margin-bottom:14px\"><label for=\"lg-phone\">Numéro de téléphone</label>\n        <input class=\"in\" id=\"lg-phone\" type=\"tel\" name=\"phone\" required autocomplete=\"tel\" inputmode=\"tel\" placeholder=\"+212 6 00 00 00 00\" autofocus></div>\n      <div class=\"f\" style=\"margin-bottom:18px\"><label for=\"lg-pass\">Mot de passe</label>\n        <div class=\"suffix\"><input class=\"in\" id=\"lg-pass\" type=\"password\" name=\"password\" required autocomplete=\"current-password\" placeholder=\"••••••••\">\n        <button type=\"button\" class=\"eye\" id=\"eye\" aria-label=\"Afficher le mot de passe\">👁</button></div></div>\n      <button class=\"btn block\" type=\"submit\">Se connecter</button>\n      <a href=\"/\" class=\"back-link\">← Retour à la boutique</a>\n    </form></div>`;\n    $('#eye').onclick = () => { const i = $('#lg-pass'); i.type = i.type === 'password' ? 'text' : 'password'; };\n    $('#loginForm').onsubmit = async (e) => {\n      e.preventDefault();\n      const f = e.target;\n      const btn = f.querySelector('button[type=submit]');\n      btn.disabled = true;\n      btn.textContent = 'Connexion…';\n      try {\n        const { token } = await api('POST', '/api/admin/login', { phone: f.phone.value, password: f.password.value });\n        TOKEN = token;\n        store.set('adm_token', token);\n        await boot();\n      } catch (err) {\n        toast(err.message, true);\n        f.password.value = '';\n        btn.disabled = false;\n        btn.textContent = 'Se connecter';\n      }\n    };\n  }\n  let retried = false;\n  function logout() {\n    TOKEN = '';\n    store.set('adm_token', '');\n    if (inTelegram() && !retried) { retried = true; boot(); } else renderLogin();\n  }\n\n  // Accès spécial : ouvert depuis le compte Telegram de l'admin → connexion automatique\n  async function tgLogin() {\n    const data = initData();\n    if (!data) return false;\n    try {\n      const { token } = await api('POST', '/api/admin/tg-login', { initData: data });\n      TOKEN = token;\n      store.set('adm_token', token);\n      return true;\n    } catch (e) { toast(e.message, true); return false; }\n  }\n\n  async function boot() {\n    if (!TOKEN && !(await tgLogin())) return renderLogin();\n    try { D = await api('GET', '/api/admin/data'); } catch (e) { return; }\n    renderShell();\n  }\n\n  /* ---------------- structure ---------------- */\n  function renderShell() {\n    root.innerHTML = `<header class=\"top\"><span class=\"brand\">${esc(D.settings.shopName)}</span><span class=\"muted\">· Admin</span><span class=\"sp\"></span>\n      <a class=\"btn ghost sm\" href=\"/\" ${inTelegram() ? '' : 'target=\"_blank\"'}>${inTelegram() ? '← Boutique' : 'Voir la boutique ↗'}</a><button class=\"btn ghost sm\" id=\"logout\">Déconnexion</button></header>\n      <nav class=\"tabs\" id=\"tabs\"></nav><main class=\"wrap\" id=\"main\"></main>`;\n    $('#logout').onclick = logout;\n    renderTabs();\n    renderTab();\n  }\n  function renderTabs() {\n    $('#tabs').innerHTML = TABS.map(([id, ic, label]) => `<button data-tab=\"${id}\" class=\"${tab === id ? 'on' : ''}\">${ic} ${label}${id === 'orders' && D.newOrders ? ` <span class=\"pill\">${D.newOrders}</span>` : ''}${id === 'reviews' && D.reviews.some((r) => !r.approved) ? ` <span class=\"pill\">${D.reviews.filter((r) => !r.approved).length}</span>` : ''}</button>`).join('');\n    $$('#tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); renderTabs(); renderTab(); }; });\n  }\n  function renderTab() {\n    $('#main').oninput = null;\n    const fn = { stats: tStats, news: tNews, notices: tNotices, customers: tCustomers, general: tGeneral, theme: tTheme, categories: tCategories, products: tProducts, reviews: tReviews, socials: tSocials, orders: tOrders, integrations: tIntegrations }[tab] || tStats;\n    fn($('#main'));\n  }\n\n  const previewPanel = () => `<aside class=\"preview card\"><div class=\"preview-h\"><span>📱 Aperçu en direct</span><a href=\"/\" target=\"_blank\">Ouvrir ↗</a></div><iframe id=\"pv\" src=\"/\"></iframe></aside>`;\n  function postPreview(settings, reload) {\n    const f = $('#pv');\n    if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'preview', settings, reload }, location.origin);\n  }\n\n  /* ---------------- champ image ---------------- */\n  function imgField(key, url, opts = {}) {\n    return `<div class=\"imgf ${opts.wide ? 'wide' : ''}\" data-imgf>\n      <div class=\"imgf-prev\" style=\"${url ? `background-image:url('${esc(url)}')` : ''}\">${url ? '' : 'Aucune image'}</div>\n      <div class=\"imgf-actions\">\n        <label class=\"btn ghost sm\">📁 ${url ? 'Changer' : 'Choisir'}<input type=\"file\" accept=\"image/*\" hidden></label>\n        <button type=\"button\" class=\"btn ghost sm\" data-imgclear>✕ Retirer</button>\n      </div>\n      <input type=\"hidden\" data-k=\"${esc(key)}\" value=\"${esc(url || '')}\" data-max=\"${opts.max || 1400}\">\n    </div>`;\n  }\n  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });\n  const readUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });\n  async function prepareImage(file, max) {\n    if (file.type === 'image/gif') return readUrl(file);\n    const img = await loadImg(URL.createObjectURL(file));\n    const scale = Math.min(1, max / Math.max(img.width, img.height));\n    if (scale === 1 && file.size < 1.2e6) return readUrl(file);\n    const c = document.createElement('canvas');\n    c.width = Math.round(img.width * scale);\n    c.height = Math.round(img.height * scale);\n    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);\n    const webp = c.toDataURL('image/webp', 0.86);\n    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');\n  }\n  function setImg(box, url) {\n    const prev = $('.imgf-prev', box);\n    const hidden = $('input[type=hidden]', box);\n    hidden.value = url;\n    prev.style.backgroundImage = url ? `url('${url}')` : '';\n    prev.textContent = url ? '' : 'Aucune image';\n    hidden.dispatchEvent(new Event('input', { bubbles: true }));\n  }\n  document.addEventListener('change', async (e) => {\n    const input = e.target;\n    if (input.type !== 'file' || !input.closest('[data-imgf]')) return;\n    const box = input.closest('[data-imgf]');\n    const file = input.files[0];\n    if (!file) return;\n    box.classList.add('loading');\n    try {\n      let url;\n      try {\n        const dataUrl = await prepareImage(file, Number($('input[type=hidden]', box).dataset.max) || 1400);\n        ({ url } = await api('POST', '/api/admin/upload', { dataUrl }));\n      } catch (convErr) {\n        // Format que le navigateur ne sait pas redimensionner (HEIC de l'iPhone, image énorme…) : on envoie le fichier tel quel\n        url = await uploadRaw(file);\n      }\n      setImg(box, url);\n      toast('Image importée ✓ — pensez à enregistrer');\n    } catch (err) {\n      toast(/HEIC|heic/.test(file.type + file.name)\n        ? 'Photo au format HEIC : dans Réglages → Appareil photo → Formats, choisissez « Plus compatible », ou envoyez une capture d\\'écran.'\n        : (err.message || 'Import impossible'), true);\n    }\n    box.classList.remove('loading');\n    input.value = '';\n  });\n  document.addEventListener('click', (e) => {\n    const b = e.target.closest('[data-imgclear]');\n    if (b) setImg(b.closest('[data-imgf]'), '');\n    if (e.target.closest('[data-act=modal-close]')) closeModal();\n  });\n\n  // Lit les champs [data-k] d'un conteneur\n  function readFields(el) {\n    const o = {};\n    $$('[data-k]', el).forEach((i) => {\n      const k = i.dataset.k;\n      o[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' || i.type === 'range' ? Number(i.value) : i.value;\n    });\n    return o;\n  }\n  const readRows = (container) => $$('[data-row]', container).map((r) => ({ ...JSON.parse(r.dataset.row), ...readFields(r) }));\n\n  const uploadRaw = (file, onProgress) => uploadBinary(file, onProgress);\n  const uploadVideo = (file, onProgress) => uploadBinary(file, onProgress);\n\n  // Envoi d'un fichier en binaire, avec progression\n  function uploadBinary(file, onProgress) {\n    return new Promise((resolve, reject) => {\n      const x = new XMLHttpRequest();\n      x.open('POST', '/api/admin/upload-file');\n      x.setRequestHeader('Content-Type', file.type || 'video/mp4');\n      x.setRequestHeader('Authorization', 'Bearer ' + TOKEN);\n      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };\n      x.onload = () => {\n        let j = {};\n        try { j = JSON.parse(x.responseText); } catch (e) { /* */ }\n        x.status === 200 && j.url ? resolve(j.url) : reject(new Error(j.error || 'Erreur ' + x.status));\n      };\n      x.onerror = () => reject(new Error('Connexion interrompue'));\n      x.send(file);\n    });\n  }\n\n  function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; }\n  function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; }\n  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });\n\n  /* ================= GÉNÉRAL ================= */\n  function tGeneral(main) {\n    const s = D.settings;\n    main.innerHTML = `<div class=\"layout with-preview\"><div>\n      <div class=\"sec card\" id=\"gen\">\n        <h2>Identité de la boutique</h2><p class=\"hint\">Nom, slogan et logo affichés en haut de la mini-app.</p>\n        <div class=\"grid\">\n          <div class=\"f\"><label>Nom de la boutique</label><input class=\"in\" data-k=\"shopName\" value=\"${esc(s.shopName)}\" maxlength=\"60\"></div>\n          <div class=\"f\"><label>Slogan</label><input class=\"in\" data-k=\"tagline\" value=\"${esc(s.tagline)}\" maxlength=\"140\"></div>\n          <div class=\"f full\"><label>Logo (carré conseillé)</label>${imgField('logo', s.logo, { max: 512 })}</div>\n        </div>\n      </div>\n      <div class=\"sec card\" id=\"gen2\">\n        <h2>Commandes & livraison</h2><p class=\"hint\">Le client choisit WhatsApp ou Signal pour envoyer sa commande. Prix en euros.</p>\n        <div class=\"grid\">\n          <div class=\"f\"><label>Numéro WhatsApp (format international)</label><input class=\"in\" data-k=\"whatsapp\" value=\"${esc(s.whatsapp)}\" placeholder=\"33612345678\"><small>Ex. 33612345678 pour la France (sans + ni 0)</small></div>\n          <div class=\"f\"><label>Signal : numéro ou lien de pseudo</label><input class=\"in\" data-k=\"signal\" value=\"${esc(s.signal || '')}\" placeholder=\"+33612345678 ou https://signal.me/#eu/…\"><small>Numéro au format international, ou le lien « signal.me » de votre pseudo Signal.</small></div>\n          <div class=\"f\"><label>Indicatif pays des numéros clients</label><div class=\"suffix\"><input class=\"in\" data-k=\"countryCode\" value=\"${esc(s.countryCode || '33')}\" inputmode=\"numeric\" maxlength=\"4\"><span>+</span></div><small>Ajouté aux numéros saisis en format local (06… → +33 6…).</small></div>\n          <div class=\"f full\"><label>Canaux de commande proposés au client</label>\n            <div style=\"display:flex;gap:18px;flex-wrap:wrap\">\n              <label class=\"check\"><input type=\"checkbox\" data-ch=\"whatsapp\" ${(s.orderChannels || {}).whatsapp !== false ? 'checked' : ''}> 💬 WhatsApp</label>\n              <label class=\"check\"><input type=\"checkbox\" data-ch=\"signal\" ${(s.orderChannels || {}).signal !== false ? 'checked' : ''}> 🔵 Signal</label>\n            </div><small>Un canal n'apparaît que si son numéro est renseigné. Avec un seul canal actif, le choix n'est pas affiché.</small></div>\n          <div class=\"f\"><label>Frais de livraison</label><div class=\"suffix\"><input class=\"in\" type=\"number\" step=\"0.01\" min=\"0\" data-k=\"deliveryFee\" value=\"${s.deliveryFee}\"><span>€</span></div></div>\n          <div class=\"f\"><label>Livraison offerte dès (0 = jamais)</label><div class=\"suffix\"><input class=\"in\" type=\"number\" step=\"0.01\" min=\"0\" data-k=\"freeDeliveryFrom\" value=\"${s.freeDeliveryFrom}\"><span>€</span></div></div>\n          <div class=\"f\"><label>Minimum de commande (0 = aucun)</label><div class=\"suffix\"><input class=\"in\" type=\"number\" step=\"0.01\" min=\"0\" data-k=\"minOrder\" value=\"${s.minOrder}\"><span>€</span></div></div>\n          <div class=\"f full\"><label>Message affiché dans le panier</label><textarea class=\"in\" data-k=\"cartNote\" maxlength=\"400\">${esc(s.cartNote)}</textarea></div>\n          <label class=\"check f full\"><input type=\"checkbox\" data-k=\"reviewsEnabled\" ${s.reviewsEnabled ? 'checked' : ''}> Autoriser les clients à publier des avis (validation requise)</label>\n        </div>\n      </div>\n      <div class=\"sec card\" id=\"gen3\">\n        <h2>🔑 Accès admin spécial (Telegram)</h2>\n        <p class=\"hint\">Les comptes Telegram listés ici voient un bouton <b>⚙️ Admin</b> dans la boutique et entrent dans ce panel <b>sans mot de passe</b>. Ils peuvent aussi taper <code>/admin</code> dans le bot.<br>\n        Pour connaître votre ID : envoyez <code>/id</code> à votre bot.</p>\n        <div class=\"f\"><label>IDs Telegram administrateurs (séparés par des virgules)</label>\n          <input class=\"in\" data-k=\"adminTelegramIds\" value=\"${esc((s.adminTelegramIds || []).join(', '))}\" placeholder=\"123456789, 987654321\" inputmode=\"numeric\"></div>\n        <p class=\"hint\" style=\"margin:12px 0 0\">Depuis un navigateur : ouvrez <code>/admin</code> avec votre mot de passe, ou appuyez 5 fois rapidement sur le logo de la boutique.</p>\n      </div>\n      <div class=\"sec card\" id=\"gen4\">\n        <h2>🔒 Mes identifiants de connexion</h2>\n        <p class=\"hint\">Changez votre numéro et votre mot de passe quand vous voulez. ${D.credentials && D.credentials.custom\n          ? 'Vos identifiants personnalisés sont actifs.'\n          : 'Vous utilisez encore les identifiants de départ du serveur.'}</p>\n        <div class=\"grid\">\n          <div class=\"f\"><label>Numéro de téléphone</label><input class=\"in\" id=\"cr-phone\" type=\"tel\" value=\"${esc((D.credentials && D.credentials.phone) || '')}\" placeholder=\"+212 6 00 00 00 00\"><small>Laissez vide pour ne pas demander de numéro à la connexion.</small></div>\n          <div class=\"f\"><label>Mot de passe actuel *</label><input class=\"in\" id=\"cr-cur\" type=\"password\" autocomplete=\"current-password\"></div>\n          <div class=\"f\"><label>Nouveau mot de passe</label><input class=\"in\" id=\"cr-new\" type=\"password\" autocomplete=\"new-password\" placeholder=\"6 caractères minimum\"><small>Laissez vide pour garder le mot de passe actuel.</small></div>\n          <div class=\"f\"><label>Confirmer le nouveau mot de passe</label><input class=\"in\" id=\"cr-conf\" type=\"password\" autocomplete=\"new-password\"></div>\n        </div>\n        <div class=\"warnbox\" style=\"margin:14px 0 0\">Après le changement, vous resterez connecté ici, mais toutes les autres sessions ouvertes seront déconnectées.<br>\n        Si votre boutique est hébergée sans disque persistant (offre gratuite Render), pensez à reporter le nouveau mot de passe dans la variable <code>ADMIN_PASSWORD</code> de l'hébergeur : sinon il sera perdu au prochain redémarrage.</div>\n        <div class=\"actions\"><button class=\"btn\" id=\"crsave\">🔐 Changer mes identifiants</button></div>\n      </div>\n      <div class=\"actions\"><button class=\"btn\" id=\"save\">💾 Enregistrer</button></div>\n    </div>${previewPanel()}</div>`;\n    const collect = () => ({ ...readFields($('#gen')), ...readFields($('#gen2')), ...readFields($('#gen3')),\n      orderChannels: Object.fromEntries($$('[data-ch]', $('#gen2')).map((i) => [i.dataset.ch, i.checked])) });\n    main.oninput = () => postPreview(collect());\n    $('#crsave').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const body = {\n        phone: $('#cr-phone').value,\n        currentPassword: $('#cr-cur').value,\n        newPassword: $('#cr-new').value,\n        confirmPassword: $('#cr-conf').value,\n      };\n      if (!body.currentPassword) throw new Error('Saisissez votre mot de passe actuel');\n      if (!body.newPassword && body.phone.trim() === ((D.credentials && D.credentials.phone) || '')) throw new Error('Aucun changement à enregistrer');\n      const r = await api('PUT', '/api/admin/credentials', body);\n      D.credentials = r.credentials;\n      toast('Identifiants mis à jour ✓');\n      tGeneral(main);\n    });\n    $('#save').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const r = await api('PUT', '/api/admin/settings', collect());\n      D.settings = r.settings;\n      $('.top .brand').textContent = D.settings.shopName;\n      postPreview(D.settings, true);\n      toast('Paramètres enregistrés ✓');\n    });\n  }\n\n  /* ================= THÈME ================= */\n  function tTheme(main) {\n    const t = D.settings.theme;\n    const range = (k, label, min, max, step, fmt) => `<div class=\"f\"><div class=\"range-row\"><label>${label}</label><b data-out=\"${k}\">${fmt(t[k])}</b></div>\n      <input type=\"range\" data-k=\"${k}\" min=\"${min}\" max=\"${max}\" step=\"${step}\" value=\"${t[k]}\"></div>`;\n    const pct = (v) => Math.round(v * 100) + ' %';\n    const FMT = { overlay: pct, panelOpacity: pct, blur: (v) => v + ' px', glow: (v) => '×' + Number(v).toFixed(1) };\n    main.innerHTML = `<div class=\"layout with-preview\"><div>\n      <div class=\"sec card\" id=\"th\">\n        <h2>Palette néon</h2><p class=\"hint\">Choisissez un preset puis ajustez chaque couleur. L'aperçu se met à jour en direct.</p>\n        <div class=\"presets\">${Object.entries(PRESETS).map(([id, p]) => `<button class=\"preset ${t.preset === id ? 'on' : ''}\" data-preset=\"${id}\"><i style=\"background:linear-gradient(90deg,${p.accent},${p.accent2})\"></i>${p.name}</button>`).join('')}</div>\n        <input type=\"hidden\" data-k=\"preset\" value=\"${esc(t.preset)}\">\n        <div class=\"grid\">\n          <div class=\"f\"><label>Couleur principale</label><input class=\"in\" type=\"color\" data-k=\"accent\" value=\"${t.accent}\"></div>\n          <div class=\"f\"><label>Couleur secondaire</label><input class=\"in\" type=\"color\" data-k=\"accent2\" value=\"${t.accent2}\"></div>\n          <div class=\"f\"><label>Néon des grammes</label><input class=\"in\" type=\"color\" data-k=\"gramColor\" value=\"${t.gramColor}\"></div>\n          <div class=\"f\"><label>Néon des prix (€)</label><input class=\"in\" type=\"color\" data-k=\"priceColor\" value=\"${t.priceColor}\"></div>\n          <div class=\"f\"><label>Couleur de fond</label><input class=\"in\" type=\"color\" data-k=\"bgColor\" value=\"${t.bgColor}\"></div>\n          ${range('glow', 'Intensité lumineuse', 0, 2, 0.1, FMT.glow)}\n        </div>\n      </div>\n      <div class=\"sec card\" id=\"th2\">\n        <h2>Image de fond & lisibilité</h2><p class=\"hint\">Ajoutez votre propre fond. Le voile et le flou derrière les textes garantissent la lisibilité.</p>\n        <div class=\"f\" style=\"margin-bottom:16px\"><label>Image de fond personnalisée</label>${imgField('bgImage', t.bgImage, { wide: true, max: 1920 })}</div>\n        <div class=\"grid\">\n          ${range('overlay', 'Voile sombre sur le fond', 0, 0.95, 0.05, FMT.overlay)}\n          ${range('blur', 'Flou derrière les textes', 0, 40, 1, FMT.blur)}\n          ${range('panelOpacity', 'Opacité des panneaux', 0, 1, 0.05, FMT.panelOpacity)}\n          <label class=\"check f\"><input type=\"checkbox\" data-k=\"animatedBg\" ${t.animatedBg ? 'checked' : ''}> Fond animé (halos + grille néon)</label>\n        </div>\n      </div>\n      <div class=\"actions\"><button class=\"btn ghost\" id=\"reset\">Réinitialiser</button><button class=\"btn\" id=\"save\">💾 Enregistrer le thème</button></div>\n    </div>${previewPanel()}</div>`;\n\n    const collect = () => ({ ...readFields($('#th')), ...readFields($('#th2')) });\n    const update = () => {\n      const v = collect();\n      for (const k in FMT) { const o = $(`[data-out=${k}]`); if (o) o.textContent = FMT[k](v[k]); }\n      postPreview({ theme: v });\n    };\n    main.oninput = (e) => {\n      if (e.target.type === 'color') { $('[data-k=preset]').value = 'custom'; $$('.preset').forEach((b) => b.classList.remove('on')); }\n      update();\n    };\n    $$('[data-preset]').forEach((b) => {\n      b.onclick = () => {\n        const p = PRESETS[b.dataset.preset];\n        for (const k of ['accent', 'accent2', 'gramColor', 'priceColor', 'bgColor']) $(`[data-k=${k}]`).value = p[k];\n        $('[data-k=preset]').value = b.dataset.preset;\n        $$('.preset').forEach((x) => x.classList.toggle('on', x === b));\n        update();\n      };\n    });\n    $('#reset').onclick = () => { $('[data-preset=cyber]').click(); for (const [k, v] of Object.entries({ overlay: 0.55, blur: 14, panelOpacity: 0.45, glow: 1 })) $(`[data-k=${k}]`).value = v; $('[data-k=animatedBg]').checked = true; update(); };\n    $('#save').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const r = await api('PUT', '/api/admin/settings', { theme: collect() });\n      D.settings = r.settings;\n      postPreview(D.settings, true);\n      toast('Thème enregistré ✓');\n    });\n  }\n\n  /* ================= CATÉGORIES ================= */\n  function tCategories(main, items = D.categories) {\n    main.innerHTML = `<div class=\"sec card\">\n      <h2>Catégories</h2><p class=\"hint\">L'accueil affiche les catégories sous forme de tuiles avec image (3 par ligne). Glissez l'ordre avec ↑ ↓.</p>\n      <div class=\"rows\" id=\"rows\">${items.map((c, i) => `<div class=\"row cat\" data-row='${esc(JSON.stringify({ id: c.id }))}'>\n        ${imgField('image', c.image, { max: 800 })}\n        <div class=\"f\"><label>Nom</label><input class=\"in\" data-k=\"name\" value=\"${esc(c.name)}\" maxlength=\"40\"><small>${D.products.filter((p) => p.categoryId === c.id).length} produit(s)</small></div>\n        <div class=\"ctl\"><button class=\"btn ghost sm\" data-mv=\"-1\" data-i=\"${i}\" ${i ? '' : 'disabled'}>↑</button><button class=\"btn ghost sm\" data-mv=\"1\" data-i=\"${i}\" ${i < items.length - 1 ? '' : 'disabled'}>↓</button><button class=\"btn danger sm\" data-del=\"${i}\">Supprimer</button></div>\n      </div>`).join('') || '<div class=\"empty\">Aucune catégorie</div>'}</div>\n      <div class=\"actions\"><button class=\"btn ghost\" id=\"add\">+ Ajouter une catégorie</button><button class=\"btn\" id=\"save\">💾 Enregistrer</button></div>\n    </div>`;\n    listControls(main, (list) => tCategories(main, list), () => ({ id: '', name: 'Nouvelle catégorie', image: '' }), (c) => {\n      const n = D.products.filter((p) => p.categoryId === c.id).length;\n      return !n || confirm(`${n} produit(s) sont dans cette catégorie. Ils resteront visibles sans catégorie. Supprimer ?`);\n    });\n    $('#save').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const r = await api('PUT', '/api/admin/categories', { items: readRows($('#rows')) });\n      D.categories = r.items;\n      tCategories(main);\n      toast('Catégories enregistrées ✓');\n    });\n  }\n\n  // Réordonner / supprimer / ajouter dans une liste en conservant les saisies en cours\n  function listControls(main, rerender, blank, canDelete) {\n    const cur = () => readRows($('#rows'));\n    $$('[data-mv]', main).forEach((b) => { b.onclick = () => { const l = cur(); const i = +b.dataset.i; const j = i + +b.dataset.mv; [l[i], l[j]] = [l[j], l[i]]; rerender(l); }; });\n    $$('[data-del]', main).forEach((b) => { b.onclick = () => { const l = cur(); const i = +b.dataset.del; if (canDelete && !canDelete(l[i])) return; l.splice(i, 1); rerender(l); toast('Supprimé — cliquez sur Enregistrer pour valider'); }; });\n    $('#add', main).onclick = () => { const l = cur(); l.push(blank()); rerender(l); const rows = $$('[data-row]', main); rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); };\n  }\n\n  /* ================= PRODUITS ================= */\n  let pFilter = { q: '', cat: '' };\n  function tProducts(main) {\n    const cats = D.categories;\n    const q = pFilter.q.toLowerCase();\n    const list = D.products.filter((p) => (!pFilter.cat || p.categoryId === pFilter.cat) && (!q || p.name.toLowerCase().includes(q)));\n    main.innerHTML = `<div class=\"sec card\">\n      <h2>Produits</h2><p class=\"hint\">${D.products.length} produit(s). Chaque produit peut avoir plusieurs formats en grammes avec leur prix en euros.</p>\n      <div class=\"bar\">\n        <input class=\"in\" id=\"pq\" placeholder=\"Rechercher…\" value=\"${esc(pFilter.q)}\">\n        <select class=\"in\" id=\"pc\" style=\"flex:0 1 200px\"><option value=\"\">Toutes catégories</option>${cats.map((c) => `<option value=\"${esc(c.id)}\" ${pFilter.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>\n        <button class=\"btn\" id=\"padd\">+ Nouveau produit</button>\n      </div>\n      <div class=\"plist\">${list.map((p) => {\n        const c = cats.find((x) => x.id === p.categoryId);\n        return `<div class=\"pitem ${p.active ? '' : 'off'}\">\n          <div class=\"th\" style=\"${p.image ? `background-image:url('${esc(p.image)}')` : ''}\"></div>\n          <div class=\"info\"><b>${esc(p.name)}</b><small>${c ? esc(c.name) : 'Sans catégorie'}${p.active ? '' : ' · masqué'}${p.badge ? ' · ' + esc(p.badge) : ''}${p.video ? ' · 🎬 vidéo' : ''}</small>\n          <small>${p.options.map((o) => `<span class=\"g\">${g(o.grams)}</span> <span class=\"e\">${eur(o.price)}</span>`).join(' · ') || '<span style=\"color:var(--err)\">Aucun format</span>'}</small></div>\n          <div class=\"ctl\" style=\"display:flex;flex-direction:column;gap:6px\"><button class=\"btn ghost sm\" data-edit=\"${esc(p.id)}\">Modifier</button><button class=\"btn ghost sm\" data-dup=\"${esc(p.id)}\">Dupliquer</button></div>\n        </div>`;\n      }).join('') || '<div class=\"empty\">Aucun produit</div>'}</div>\n    </div>`;\n    $('#pq').oninput = (e) => { pFilter.q = e.target.value; const pos = e.target.selectionStart; tProducts(main); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); };\n    $('#pc').onchange = (e) => { pFilter.cat = e.target.value; tProducts(main); };\n    $('#padd').onclick = () => editProduct(main, null);\n    $$('[data-edit]').forEach((b) => { b.onclick = () => editProduct(main, D.products.find((p) => p.id === b.dataset.edit)); });\n    $$('[data-dup]').forEach((b) => {\n      b.onclick = async () => {\n        const p = D.products.find((x) => x.id === b.dataset.dup);\n        await saveProducts([...D.products, { ...p, id: '', name: p.name + ' (copie)', active: false }], 'Produit dupliqué (masqué) ✓');\n        tProducts(main);\n      };\n    });\n  }\n\n  async function saveProducts(items, msg) {\n    const r = await api('PUT', '/api/admin/products', { items });\n    D.products = r.items;\n    toast(msg);\n  }\n\n  function editProduct(main, p) {\n    const isNew = !p;\n    p = p || { id: '', name: '', categoryId: pFilter.cat || (D.categories[0] && D.categories[0].id) || '', description: '', image: '', badge: '', active: true, options: [{ grams: 100, price: 10 }] };\n    const optRow = (o) => `<div class=\"opt-row\" data-opt>\n      <div class=\"suffix\"><input class=\"in\" type=\"number\" min=\"1\" step=\"1\" data-o=\"grams\" value=\"${o.grams}\" placeholder=\"Quantité\"><span>g</span></div>\n      <div class=\"suffix\"><input class=\"in\" type=\"number\" min=\"0\" step=\"0.01\" data-o=\"price\" value=\"${o.price}\" placeholder=\"Prix\"><span>€</span></div>\n      <button type=\"button\" class=\"btn danger sm\" data-optdel>✕</button></div>`;\n    openModal(`<h2>${isNew ? 'Nouveau produit' : 'Modifier le produit'}</h2>\n      <form id=\"pform\">\n      <div class=\"grid\">\n        <div class=\"f\"><label>Nom</label><input class=\"in\" data-k=\"name\" value=\"${esc(p.name)}\" required maxlength=\"80\"></div>\n        <div class=\"f\"><label>Catégorie</label><select class=\"in\" data-k=\"categoryId\"><option value=\"\">— Sans catégorie —</option>${D.categories.map((c) => `<option value=\"${esc(c.id)}\" ${c.id === p.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>\n        <div class=\"f full\"><label>Description</label><textarea class=\"in\" data-k=\"description\" maxlength=\"2000\">${esc(p.description)}</textarea></div>\n        <div class=\"f full\"><label>Image du produit</label>${imgField('image', p.image, { wide: true, max: 1200 })}</div>\n        <div class=\"f full\"><label>Vidéo du produit (optionnel)</label>\n          <div class=\"vidf\" data-vidf>\n            <div class=\"vid-prev\" id=\"vidPrev\"></div>\n            <div class=\"imgf-actions\">\n              <label class=\"btn ghost sm\"><span id=\"vidBtnTxt\">🎬 Importer</span><input type=\"file\" accept=\"video/*\" hidden id=\"vidFile\"></label>\n              <button type=\"button\" class=\"btn ghost sm\" id=\"vidClear\">✕ Retirer</button>\n            </div>\n          </div>\n          <input class=\"in\" data-k=\"video\" id=\"vidUrl\" value=\"${esc(p.video || '')}\" placeholder=\"…ou collez un lien https:// (MP4, YouTube, Vimeo)\">\n          <small>L'image <b>et</b> la vidéo s'affichent toutes les deux dans la fiche produit. MP4, WEBM ou MOV (iPhone), 80 Mo maximum. Sur un hébergement sans disque persistant, préférez un lien YouTube.</small>\n        </div>\n        <div class=\"f\"><label>Badge (optionnel)</label><input class=\"in\" data-k=\"badge\" value=\"${esc(p.badge)}\" maxlength=\"16\" placeholder=\"NOUVEAU, PROMO…\"></div>\n        <label class=\"check f\" style=\"align-self:end;min-height:42px\"><input type=\"checkbox\" data-k=\"active\" ${p.active ? 'checked' : ''}> Visible dans la boutique</label>\n        <div class=\"f full\"><label>Formats — quantité en grammes et prix en euros</label><div id=\"opts\">${p.options.map(optRow).join('')}</div>\n          <button type=\"button\" class=\"btn ghost sm\" id=\"optadd\" style=\"align-self:flex-start\">+ Ajouter un format</button></div>\n      </div>\n      <div class=\"actions\">${isNew ? '' : '<button type=\"button\" class=\"btn danger\" id=\"pdel\" style=\"margin-right:auto\">Supprimer</button>'}\n        <button type=\"button\" class=\"btn ghost\" data-act=\"modal-close\">Annuler</button><button class=\"btn\" type=\"submit\">💾 Enregistrer</button></div>\n      </form>`);\n    const box = $('#modalBox');\n    const ytId = (u) => (u.match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/)|youtu\\.be\\/)([\\w-]{6,})/) || [])[1];\n    const vimeoId = (u) => (u.match(/vimeo\\.com\\/(?:video\\/)?(\\d+)/) || [])[1];\n    const drawVideo = () => {\n      const u = $('#vidUrl').value.trim();\n      const prev = $('#vidPrev');\n      if (!u) { prev.innerHTML = '<span class=\"muted\">Aucune vidéo</span>'; return; }\n      if (ytId(u)) prev.innerHTML = `<iframe src=\"https://www.youtube.com/embed/${esc(ytId(u))}\" allowfullscreen></iframe>`;\n      else if (vimeoId(u)) prev.innerHTML = `<iframe src=\"https://player.vimeo.com/video/${esc(vimeoId(u))}\" allowfullscreen></iframe>`;\n      else prev.innerHTML = `<video src=\"${esc(u)}\" controls playsinline preload=\"metadata\"></video>`;\n    };\n    drawVideo();\n    $('#vidUrl').oninput = drawVideo;\n    $('#vidClear').onclick = () => { $('#vidUrl').value = ''; drawVideo(); };\n    $('#vidFile').onchange = async (ev) => {\n      const file = ev.target.files[0];\n      ev.target.value = '';\n      if (!file) return;\n      if (file.size > 80 * 1024 * 1024) return toast(`Vidéo trop lourde (${Math.round(file.size / 1048576)} Mo) — 80 Mo maximum. Réduisez-la ou collez un lien YouTube.`, true);\n      if (!/^video\\//.test(file.type || '')) return toast('Ce fichier n\\'est pas une vidéo', true);\n      const lab = $('#vidBtnTxt');\n      lab.textContent = 'Import… 0 %';\n      try {\n        const url = await uploadVideo(file, (pct) => { lab.textContent = `Import… ${pct} %`; });\n        $('#vidUrl').value = url;\n        drawVideo();\n        toast('Vidéo importée ✓ — pensez à enregistrer le produit');\n      } catch (err) { toast(err.message || 'Import impossible', true); }\n      lab.textContent = '🎬 Importer';\n    };\n    $('#optadd').onclick = () => { $('#opts').insertAdjacentHTML('beforeend', optRow({ grams: '', price: '' })); };\n    box.addEventListener('click', (e) => { const d = e.target.closest('[data-optdel]'); if (d) d.closest('[data-opt]').remove(); });\n    if (!isNew) {\n      $('#pdel').onclick = async () => {\n        if (!confirm(`Supprimer « ${p.name} » ?`)) return;\n        try { await saveProducts(D.products.filter((x) => x.id !== p.id), 'Produit supprimé'); closeModal(); tProducts(main); } catch (e) { toast(e.message, true); }\n      };\n    }\n    $('#pform').onsubmit = (e) => {\n      e.preventDefault();\n      const v = readFields($('#pform'));\n      v.options = $$('[data-opt]').map((r) => ({ grams: Number($('[data-o=grams]', r).value), price: Number($('[data-o=price]', r).value) })).filter((o) => o.grams > 0);\n      if (!v.name.trim()) return toast('Le nom est obligatoire', true);\n      if (!v.options.length) return toast('Ajoutez au moins un format (grammes + prix)', true);\n      const item = { ...p, ...v };\n      const items = isNew ? [...D.products, item] : D.products.map((x) => (x.id === p.id ? item : x));\n      withBusy(e.submitter, async () => { await saveProducts(items, 'Produit enregistré ✓'); closeModal(); tProducts(main); });\n    };\n  }\n\n  /* ================= AVIS ================= */\n  function tReviews(main, items = D.reviews) {\n    main.innerHTML = `<div class=\"sec card\">\n      <h2>Avis & témoignages</h2><p class=\"hint\">Les avis des clients arrivent en attente : cochez « Publié » pour les afficher.</p>\n      <div class=\"rows\" id=\"rows\">${items.map((r, i) => `<div class=\"row rev\" data-row='${esc(JSON.stringify({ id: r.id }))}' style=\"${r.approved ? '' : 'border-color:rgba(255,201,77,.5)'}\">\n        <div class=\"grid\">\n          <div class=\"f\"><label>Nom</label><input class=\"in\" data-k=\"name\" value=\"${esc(r.name)}\" maxlength=\"40\"></div>\n          <div class=\"f\"><label>Note</label><select class=\"in\" data-k=\"rating\">${[5, 4, 3, 2, 1].map((n) => `<option value=\"${n}\" ${r.rating === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)}</option>`).join('')}</select></div>\n          <div class=\"f\"><label>Date</label><input class=\"in\" type=\"date\" data-k=\"date\" value=\"${esc(r.date)}\"></div>\n          <label class=\"check f\" style=\"align-self:end;min-height:42px\"><input type=\"checkbox\" data-k=\"approved\" ${r.approved ? 'checked' : ''}> Publié${r.approved ? '' : ' <span style=\"color:var(--warn)\">(en attente)</span>'}</label>\n          <div class=\"f full\"><label>Avis</label><textarea class=\"in\" data-k=\"text\" maxlength=\"1000\">${esc(r.text)}</textarea></div>\n        </div>\n        <div class=\"ctl\" style=\"justify-content:flex-end\"><button class=\"btn ghost sm\" data-mv=\"-1\" data-i=\"${i}\" ${i ? '' : 'disabled'}>↑</button><button class=\"btn ghost sm\" data-mv=\"1\" data-i=\"${i}\" ${i < items.length - 1 ? '' : 'disabled'}>↓</button><button class=\"btn danger sm\" data-del=\"${i}\">Supprimer</button></div>\n      </div>`).join('') || '<div class=\"empty\">Aucun avis</div>'}</div>\n      <div class=\"actions\"><button class=\"btn ghost\" id=\"add\">+ Ajouter un avis</button><button class=\"btn\" id=\"save\">💾 Enregistrer</button></div>\n    </div>`;\n    listControls(main, (l) => tReviews(main, l), () => ({ id: '', name: '', rating: 5, text: '', date: new Date().toISOString().slice(0, 10), approved: true }));\n    $('#save').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const r = await api('PUT', '/api/admin/reviews', { items: readRows($('#rows')) });\n      D.reviews = r.items;\n      renderTabs();\n      tReviews(main);\n      toast('Avis enregistrés ✓');\n    });\n  }\n\n  /* ================= RÉSEAUX ================= */\n  function tSocials(main, items = D.socials) {\n    main.innerHTML = `<div class=\"sec card\">\n      <h2>Réseaux sociaux</h2><p class=\"hint\">Liens affichés sur la page « Réseaux » de la mini-app. L'URL doit commencer par https://</p>\n      <div class=\"rows\" id=\"rows\">${items.map((s, i) => `<div class=\"row soc\" data-row='${esc(JSON.stringify({ id: s.id }))}'>\n        <div class=\"f\"><label>Réseau</label><select class=\"in\" data-k=\"type\">${Object.entries(SOCIAL_TYPES).map(([k, v]) => `<option value=\"${k}\" ${s.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>\n        <div class=\"f\"><label>Titre</label><input class=\"in\" data-k=\"label\" value=\"${esc(s.label)}\" maxlength=\"40\"></div>\n        <div class=\"f\"><label>Pseudo</label><input class=\"in\" data-k=\"handle\" value=\"${esc(s.handle)}\" maxlength=\"60\" placeholder=\"@moncompte\"></div>\n        <div class=\"f\"><label>Lien</label><input class=\"in\" data-k=\"url\" value=\"${esc(s.url)}\" placeholder=\"https://…\"></div>\n        <div class=\"ctl\"><button class=\"btn ghost sm\" data-mv=\"-1\" data-i=\"${i}\" ${i ? '' : 'disabled'}>↑</button><button class=\"btn ghost sm\" data-mv=\"1\" data-i=\"${i}\" ${i < items.length - 1 ? '' : 'disabled'}>↓</button><button class=\"btn danger sm\" data-del=\"${i}\">✕</button></div>\n      </div>`).join('') || '<div class=\"empty\">Aucun réseau</div>'}</div>\n      <div class=\"actions\"><button class=\"btn ghost\" id=\"add\">+ Ajouter un réseau</button><button class=\"btn\" id=\"save\">💾 Enregistrer</button></div>\n    </div>`;\n    listControls(main, (l) => tSocials(main, l), () => ({ id: '', type: 'instagram', label: 'Instagram', handle: '', url: 'https://' }));\n    main.querySelectorAll('[data-k=type]').forEach((sel) => {\n      sel.onchange = () => { const lab = sel.closest('[data-row]').querySelector('[data-k=label]'); if (!lab.value || Object.values(SOCIAL_TYPES).includes(lab.value)) lab.value = SOCIAL_TYPES[sel.value]; };\n    });\n    $('#save').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const rows = readRows($('#rows'));\n      const bad = rows.find((r) => !/^(https?:\\/\\/|tg:\\/\\/|mailto:|tel:)\\S+$/i.test(r.url.trim()));\n      if (bad) throw new Error(`Lien invalide pour « ${bad.label} » (doit commencer par https://)`);\n      const r = await api('PUT', '/api/admin/socials', { items: rows });\n      D.socials = r.items;\n      tSocials(main);\n      toast('Réseaux enregistrés ✓');\n    });\n  }\n\n  /* ================= COMMANDES ================= */\n  async function tOrders(main) {\n    main.innerHTML = '<div class=\"empty\">Chargement…</div>';\n    let data;\n    try { data = await api('GET', '/api/admin/orders'); } catch (e) { main.innerHTML = `<div class=\"empty\">${esc(e.message)}</div>`; return; }\n    const { orders, statuses } = data;\n    const ca = orders.filter((o) => o.status !== 'annulée').reduce((a, o) => a + o.total, 0);\n    main.innerHTML = `<div class=\"sec card\" style=\"display:flex;gap:24px;flex-wrap:wrap\">\n        <div><div class=\"muted\">Commandes</div><div style=\"font:900 26px Orbitron\">${orders.length}</div></div>\n        <div><div class=\"muted\">Nouvelles</div><div style=\"font:900 26px Orbitron;color:var(--accent)\">${orders.filter((o) => o.status === 'nouvelle').length}</div></div>\n        <div><div class=\"muted\">Chiffre d'affaires</div><div class=\"e\" style=\"font:900 26px Orbitron\">${eur(ca)}</div></div>\n        <div style=\"margin-left:auto;align-self:center\"><button class=\"btn ghost sm\" id=\"refresh\">↻ Actualiser</button></div>\n      </div>\n      ${orders.map((o) => `<div class=\"order card\">\n        <div class=\"oh\"><b>#${esc(o.id)}</b><span class=\"st st-${esc(o.status)}\">${esc(o.status)}</span><span class=\"muted\">${new Date(o.createdAt).toLocaleString('fr-FR')}</span><span class=\"sp\"></span>\n          <span class=\"flag\">${o.channel === 'signal' ? '🔵 Signal (client)' : o.delivered && o.delivered.whatsapp ? '✅ WhatsApp auto' : '🔗 WhatsApp via lien client'}${o.delivered && o.delivered.telegram ? ' · ✅ Telegram' : ''}</span>\n          <select class=\"in\" style=\"width:auto;min-height:34px;padding:4px 8px\" data-status=\"${esc(o.id)}\">${statuses.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>\n        <div class=\"cust\"><span>👤 ${esc(o.customer.name)}</span><span>📞 ${esc(o.customer.phone)}</span>${o.customer.address ? `<span>📍 ${esc(o.customer.address)}</span>` : ''}${o.telegram ? `<span>✈️ ${o.telegram.username ? '@' + esc(o.telegram.username) : esc(o.telegram.name)} (${o.telegram.id})</span>` : ''}${o.customer.note ? `<span>📝 ${esc(o.customer.note)}</span>` : ''}</div>\n        <table>${o.items.map((it) => `<tr><td>${esc(it.name)} — <span class=\"g\">${g(it.grams)}</span> × ${it.qty}</td><td class=\"e\">${eur(it.lineTotal)}</td></tr>`).join('')}\n          <tr><td class=\"muted\">Livraison</td><td>${o.delivery ? eur(o.delivery) : 'offerte'}</td></tr>\n          <tr><td><b>Total</b> · <span class=\"g\">${g(o.totalGrams)}</span></td><td class=\"e\" style=\"font-size:16px\">${eur(o.total)}</td></tr></table>\n        <div class=\"actions\" style=\"margin-top:8px\">\n          <a class=\"btn ghost sm\" target=\"_blank\" rel=\"noopener\" href=\"https://wa.me/${esc(String(o.customer.phoneIntl || o.customer.phone).replace(/\\D/g, '').replace(/^0/, '33'))}\">💬 WhatsApp client</a>\n          <a class=\"btn ghost sm\" target=\"_blank\" rel=\"noopener\" href=\"https://signal.me/#p/+${esc(String(o.customer.phoneIntl || o.customer.phone).replace(/\\D/g, '').replace(/^0/, '33'))}\">🔵 Signal client</a>\n          <button class=\"btn danger sm\" data-odel=\"${esc(o.id)}\">Supprimer</button></div>\n      </div>`).join('') || '<div class=\"sec card empty\">Aucune commande pour le moment.</div>'}`;\n    $('#refresh').onclick = () => tOrders(main);\n    $$('[data-status]').forEach((s) => {\n      s.onchange = async () => {\n        try { await api('PATCH', `/api/admin/orders/${s.dataset.status}`, { status: s.value }); toast('Statut mis à jour ✓'); D.newOrders = (await api('GET', '/api/admin/data')).newOrders; renderTabs(); tOrders(main); } catch (e) { toast(e.message, true); }\n      };\n    });\n    $$('[data-odel]').forEach((b) => {\n      b.onclick = async () => {\n        if (!confirm(`Supprimer la commande #${b.dataset.odel} ?`)) return;\n        try { await api('DELETE', `/api/admin/orders/${b.dataset.odel}`); toast('Commande supprimée'); tOrders(main); } catch (e) { toast(e.message, true); }\n      };\n    });\n  }\n\n  /* ================= INTÉGRATIONS ================= */\n  async function tIntegrations(main) {\n    main.innerHTML = '<div class=\"empty\">Chargement…</div>';\n    let s;\n    try { s = await api('GET', '/api/admin/status'); } catch (e) { main.innerHTML = `<div class=\"empty\">${esc(e.message)}</div>`; return; }\n    const item = (state, title, desc) => `<div class=\"status-item\"><span class=\"dot ${state}\"></span><div><b>${title}</b><small>${desc}</small></div></div>`;\n    const wa = s.whatsapp;\n    const waAuto = wa.provider === 'callmebot' ? wa.callmebotKey : wa.provider === 'cloud' ? wa.cloud : false;\n    main.innerHTML = `<div class=\"sec card\" style=\"padding:12px 16px;margin-bottom:16px\"><span class=\"muted\">Version de l'application :</span> <b>${esc(s.version || '?')}</b></div>\n      ${s.defaultPassword ? '<div class=\"warnbox\">⚠️ Vous utilisez le mot de passe admin par défaut. Définissez <code>ADMIN_PASSWORD</code> dans le fichier <code>.env</code> puis redémarrez le serveur.</div>' : ''}\n      <div class=\"sec card\"><h2>État des connexions</h2><p class=\"hint\">Ces réglages se font dans le fichier <code>.env</code> (voir README).</p>\n      <div class=\"status-list\">\n        ${item(s.bot ? 'ok' : s.botTokenSet ? 'ko' : 'mid', 'Bot Telegram', s.bot ? `Connecté : <a href=\"https://t.me/${esc(s.bot.username)}\" target=\"_blank\">@${esc(s.bot.username)}</a>` : s.botTokenSet ? 'Token invalide ou Telegram injoignable' : 'BOT_TOKEN non défini')}\n        ${item(/^https:\\/\\//.test(s.webappUrl) ? 'ok' : 'ko', 'URL de la mini-app', s.webappUrl ? esc(s.webappUrl) : 'WEBAPP_URL non défini (URL https publique requise par Telegram)')}\n        ${item(wa.number ? 'ok' : 'ko', 'Numéro WhatsApp de réception', wa.number ? esc(wa.number) : 'À renseigner dans l\\'onglet Général')}\n        ${item(waAuto ? 'ok' : 'mid', 'Envoi WhatsApp', wa.provider === 'link'\n          ? 'Mode « lien » : le client envoie le récapitulatif pré-rempli en un clic. Pour un envoi 100 % automatique, configurez CallMeBot ou WhatsApp Cloud API.'\n          : waAuto ? `Automatique via ${wa.provider === 'cloud' ? 'WhatsApp Cloud API' : 'CallMeBot'}` : `Mode ${esc(wa.provider)} sélectionné mais identifiants manquants`)}\n        ${item(s.signal && s.signal.link ? 'ok' : 'mid', 'Commandes via Signal', s.signal && s.signal.link ? `Actif : ${esc(s.signal.link)}${s.signal.channels.signal ? '' : ' (désactivé dans Général)'}` : 'Optionnel : renseignez votre numéro Signal dans l\\'onglet Général')}\n        ${item(s.adminChatId ? 'ok' : 'mid', 'Copie des commandes sur Telegram', s.adminChatId ? 'Activée' : 'Optionnel : envoyez /id au bot et copiez la valeur dans TELEGRAM_ADMIN_CHAT_ID')}\n        ${item(s.requireTelegram ? 'ok' : 'mid', 'Commandes réservées à Telegram', s.requireTelegram ? 'Oui (signature Telegram vérifiée)' : 'Non — la boutique fonctionne aussi dans un navigateur')}\n      </div>\n      <div class=\"actions\"><button class=\"btn\" id=\"test\">📨 Envoyer un message de test</button></div></div>`;\n    $('#test').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const r = await api('POST', '/api/admin/test');\n      const w = r.whatsapp.ok ? 'WhatsApp ✓' : r.whatsapp.mode === 'link' ? 'WhatsApp : mode lien (pas d\\'envoi auto)' : 'WhatsApp ✗ ' + (r.whatsapp.error || '');\n      const t = r.telegram.ok ? 'Telegram ✓' : 'Telegram : ' + (r.telegram.error || '✗');\n      toast(`${w} · ${t}`, !r.whatsapp.ok && !r.telegram.ok);\n    });\n  }\n\n  /* ================= VISITES ================= */\n  async function tStats(main) {\n    main.innerHTML = '<div class=\"empty\">Chargement…</div>';\n    let st;\n    try { st = await api('GET', '/api/admin/stats'); } catch (e) { main.innerHTML = `<div class=\"empty\">${esc(e.message)}</div>`; return; }\n    const nf = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);\n    const dShort = (k) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });\n    const delta = (a, b) => (!b ? '' : `<span class=\"${a >= b ? 'up' : 'down'}\">${a >= b ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / b) * 100))} %</span>`);\n    const kpi = (label, b, extra = '') => `<div class=\"kpi card\"><div class=\"muted\">${label}</div><div class=\"kv\">${nf(b.unique)}</div><small>${nf(b.views)} ouverture${b.views > 1 ? 's' : ''} ${extra}</small></div>`;\n    const max = Math.max(1, ...st.last30.map((d) => d.u));\n    main.innerHTML = `<div class=\"kpis\">\n        ${kpi('Aujourd\\'hui', st.today, delta(st.today.unique, st.yesterday.unique))}\n        ${kpi('Hier', st.yesterday)}\n        ${kpi('Cette semaine', st.week, delta(st.week.unique, st.lastWeek.unique) ? 'vs sem. passée ' + delta(st.week.unique, st.lastWeek.unique) : '')}\n        ${kpi('Ce mois-ci', st.month)}\n      </div>\n      <div class=\"sec card\">\n        <div style=\"display:flex;align-items:center;gap:10px;flex-wrap:wrap\"><h2 style=\"flex:1\">Visiteurs uniques — 30 derniers jours</h2><button class=\"btn ghost sm\" id=\"srefresh\">↻ Actualiser</button></div>\n        <p class=\"hint\">Un visiteur = un appareil ou un compte Telegram, compté une fois par jour. Les ouvertures comptent chaque lancement de l'app (au plus une toutes les 30 min).</p>\n        <div class=\"chart\" role=\"img\" aria-label=\"Visiteurs par jour\">${st.last30.map((d) => `<div class=\"bar\" title=\"${dShort(d.day)} : ${d.u} visiteur(s), ${d.v} ouverture(s)\">\n          <i style=\"height:${Math.round((d.u / max) * 100)}%\"></i><span>${d.u || ''}</span></div>`).join('')}</div>\n        <div class=\"chart-x\"><span>${dShort(st.last30[0].day)}</span><span>${dShort(st.last30[15].day)}</span><span>Aujourd'hui</span></div>\n      </div>\n      <div class=\"sec card\"><h2>Détail par jour</h2>\n        <table class=\"tbl\"><tr><th>Jour</th><th>Visiteurs</th><th>dont Telegram</th><th>Ouvertures</th></tr>\n        ${st.last30.slice().reverse().map((d) => `<tr><td>${new Date(d.day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td><td><b>${d.u}</b></td><td>${d.t}</td><td>${d.v}</td></tr>`).join('')}</table>\n        <p class=\"hint\" style=\"margin-top:12px\">Total depuis le ${dShort(st.total.since)} : ${nf(st.total.views)} ouvertures · Fuseau : ${esc(st.tz)}</p>\n      </div>`;\n    $('#srefresh').onclick = () => tStats(main);\n  }\n\n  /* ================= NEWS ================= */\n  const NEWS_TAGS = { news: '📰 Actualité', promo: '🔥 Promotion', update: '🛠️ Mise à jour' };\n  function tNews(main, items = D.news || []) {\n    main.innerHTML = `<div class=\"sec card\">\n      <h2>News</h2><p class=\"hint\">Publiez actualités, promotions et mises à jour : elles apparaissent dans l'onglet <b>News</b> de la mini-app, avec un badge « nouveau » pour les clients qui ne les ont pas encore lues. Les news épinglées restent en haut.</p>\n      <div class=\"rows\" id=\"rows\">${items.map((n, i) => `<div class=\"row rev\" data-row='${esc(JSON.stringify({ id: n.id }))}' style=\"${n.published ? '' : 'opacity:.7'}\">\n        <div class=\"grid\">\n          <div class=\"f full\"><label>Titre</label><input class=\"in\" data-k=\"title\" value=\"${esc(n.title)}\" maxlength=\"100\"></div>\n          <div class=\"f\"><label>Type</label><select class=\"in\" data-k=\"tag\">${Object.entries(NEWS_TAGS).map(([k, v]) => `<option value=\"${k}\" ${n.tag === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>\n          <div class=\"f\"><label>Date</label><input class=\"in\" type=\"date\" data-k=\"date\" value=\"${esc(n.date)}\"></div>\n          <label class=\"check f\" style=\"align-self:end;min-height:42px\"><input type=\"checkbox\" data-k=\"published\" ${n.published ? 'checked' : ''}> Publiée</label>\n          <label class=\"check f\" style=\"align-self:end;min-height:42px\"><input type=\"checkbox\" data-k=\"pinned\" ${n.pinned ? 'checked' : ''}> 📌 Épinglée</label>\n          <div class=\"f full\"><label>Texte</label><textarea class=\"in\" data-k=\"body\" maxlength=\"3000\">${esc(n.body)}</textarea></div>\n          <div class=\"f\"><label>Lien (optionnel)</label><input class=\"in\" data-k=\"link\" value=\"${esc(n.link || '')}\" placeholder=\"https://…\"></div>\n          <div class=\"f full\"><label>Image (optionnel)</label>${imgField('image', n.image, { wide: true, max: 1200 })}</div>\n        </div>\n        <div class=\"ctl\" style=\"justify-content:flex-end\"><button class=\"btn ghost sm\" data-mv=\"-1\" data-i=\"${i}\" ${i ? '' : 'disabled'}>↑</button><button class=\"btn ghost sm\" data-mv=\"1\" data-i=\"${i}\" ${i < items.length - 1 ? '' : 'disabled'}>↓</button><button class=\"btn danger sm\" data-del=\"${i}\">Supprimer</button></div>\n      </div>`).join('') || '<div class=\"empty\">Aucune news — cliquez sur « Nouvelle news ».</div>'}</div>\n      <div class=\"actions\"><button class=\"btn ghost\" id=\"add\">+ Nouvelle news</button><button class=\"btn\" id=\"save\">💾 Enregistrer</button></div>\n    </div>`;\n    listControls(main, (l) => tNews(main, l), () => ({ id: '', title: '', body: '', image: '', link: '', tag: 'news', date: new Date().toISOString().slice(0, 10), pinned: false, published: true }));\n    // La nouvelle news s'ajoute en haut de liste\n    $('#add').onclick = () => { const l = readRows($('#rows')); l.unshift({ id: '', title: '', body: '', image: '', link: '', tag: 'news', date: new Date().toISOString().slice(0, 10), pinned: false, published: true }); tNews(main, l); const f = $('[data-row] [data-k=title]', main); if (f) f.focus(); };\n    $('#save').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const rows = readRows($('#rows'));\n      const bad = rows.find((r) => r.link && !/^https?:\\/\\/\\S+$/i.test(r.link.trim()));\n      if (bad) throw new Error(`Lien invalide pour « ${bad.title || 'news'} » (doit commencer par https://)`);\n      const r = await api('PUT', '/api/admin/news', { items: rows });\n      D.news = r.items;\n      tNews(main);\n      toast('News enregistrées ✓ — visibles immédiatement');\n    });\n  }\n\n  /* ================= NOTIFICATIONS ================= */\n  const NOTICE_TYPES = { info: '📢 Information', promo: '🔥 Promotion', alert: '⚠️ Alerte' };\n  function tNotices(main, items = D.notices || []) {\n    main.innerHTML = `<div class=\"layout with-preview\"><div><div class=\"sec card\">\n      <h2>Notifications de la page d'accueil</h2><p class=\"hint\">Bandeaux affichés en haut de l'accueil, dès l'ouverture de l'app. Les clients déjà connectés les reçoivent en moins d'une minute (affichage d'une alerte). Option <b>pop-up</b> : affichée en grand une seule fois par client.</p>\n      <div class=\"rows\" id=\"rows\">${items.map((n, i) => `<div class=\"row rev\" data-row='${esc(JSON.stringify({ id: n.id }))}'>\n        <div class=\"grid\">\n          <div class=\"f full\"><label>Message</label><textarea class=\"in\" data-k=\"text\" maxlength=\"240\" style=\"min-height:64px\">${esc(n.text)}</textarea></div>\n          <div class=\"f\"><label>Type</label><select class=\"in\" data-k=\"type\">${Object.entries(NOTICE_TYPES).map(([k, v]) => `<option value=\"${k}\" ${n.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>\n          <div class=\"f\"><label>Lien (optionnel)</label><input class=\"in\" data-k=\"link\" value=\"${esc(n.link || '')}\" placeholder=\"https://…\"></div>\n          <div class=\"f\"><label>Afficher jusqu'au (inclus)</label><input class=\"in\" type=\"date\" data-k=\"until\" value=\"${esc(n.until || '')}\"><small>Vide = sans limite</small></div>\n          <label class=\"check f\" style=\"align-self:end;min-height:42px\"><input type=\"checkbox\" data-k=\"active\" ${n.active ? 'checked' : ''}> Active</label>\n          <label class=\"check f\" style=\"align-self:end;min-height:42px\"><input type=\"checkbox\" data-k=\"popup\" ${n.popup ? 'checked' : ''}> Pop-up au démarrage</label>\n        </div>\n        <div class=\"ctl\" style=\"justify-content:flex-end\"><button class=\"btn ghost sm\" data-mv=\"-1\" data-i=\"${i}\" ${i ? '' : 'disabled'}>↑</button><button class=\"btn ghost sm\" data-mv=\"1\" data-i=\"${i}\" ${i < items.length - 1 ? '' : 'disabled'}>↓</button><button class=\"btn danger sm\" data-del=\"${i}\">Supprimer</button></div>\n      </div>`).join('') || '<div class=\"empty\">Aucune notification</div>'}</div>\n      <div class=\"actions\"><button class=\"btn ghost\" id=\"add\">+ Ajouter une notification</button><button class=\"btn\" id=\"save\">💾 Enregistrer</button></div>\n    </div></div>${previewPanel()}</div>`;\n    listControls(main, (l) => tNotices(main, l), () => ({ id: '', text: '', type: 'promo', link: '', active: true, popup: false, until: '' }));\n    $('#save').onclick = (e) => withBusy(e.currentTarget, async () => {\n      const rows = readRows($('#rows')).filter((r) => r.text.trim());\n      const r = await api('PUT', '/api/admin/notices', { items: rows });\n      D.notices = r.items;\n      tNotices(main);\n      toast('Notifications enregistrées ✓');\n    });\n  }\n\n  /* ================= CLIENTS ================= */\n  let cFilter = { q: '', from: '', to: '', optIn: false };\n  async function tCustomers(main) {\n    main.innerHTML = '<div class=\"empty\">Chargement…</div>';\n    let data;\n    const qs = new URLSearchParams({ from: cFilter.from, to: cFilter.to, optIn: cFilter.optIn ? 'true' : '' });\n    try { data = await api('GET', '/api/admin/customers?' + qs); } catch (e) { main.innerHTML = `<div class=\"empty\">${esc(e.message)}</div>`; return; }\n    const q = cFilter.q.toLowerCase().replace(/\\s/g, '');\n    const rows = data.customers.filter((c) => !q || (c.name + c.phone + (c.telegram || '')).toLowerCase().replace(/\\s/g, '').includes(q));\n    const dt = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });\n    // Groupement par jour de collecte\n    const groups = [];\n    for (const c of rows) {\n      const day = new Date(c.firstSeen).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });\n      if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, items: [] });\n      groups[groups.length - 1].items.push(c);\n    }\n    main.innerHTML = `<div class=\"kpis\">\n        <div class=\"kpi card\"><div class=\"muted\">Numéros enregistrés</div><div class=\"kv\">${data.total}</div><small>depuis le début</small></div>\n        <div class=\"kpi card\"><div class=\"muted\">Nouveaux aujourd'hui</div><div class=\"kv\">${data.today}</div><small>premières commandes</small></div>\n        <div class=\"kpi card\"><div class=\"muted\">Acceptent les offres</div><div class=\"kv\">${data.optIn}</div><small>sur ${data.count} affichés</small></div>\n      </div>\n      <div class=\"sec card\">\n        <h2>📥 Télécharger la liste</h2><p class=\"hint\">Chaque client qui passe commande est enregistré automatiquement (un numéro = une ligne, même s'il commande plusieurs fois). Le fichier respecte les filtres ci-dessous et est trié par date de collecte.</p>\n        <div class=\"bar\">\n          <label class=\"f\" style=\"flex:0 1 170px\"><span class=\"lab\">Collectés depuis le</span><input class=\"in\" type=\"date\" id=\"cfrom\" value=\"${esc(cFilter.from)}\"></label>\n          <label class=\"f\" style=\"flex:0 1 170px\"><span class=\"lab\">jusqu'au</span><input class=\"in\" type=\"date\" id=\"cto\" value=\"${esc(cFilter.to)}\"></label>\n          <label class=\"check\" style=\"align-self:end;min-height:42px\"><input type=\"checkbox\" id=\"coptin\" ${cFilter.optIn ? 'checked' : ''}> Seulement ceux qui acceptent les offres</label>\n        </div>\n        <div class=\"actions\" style=\"justify-content:flex-start\">\n          <button class=\"btn\" data-exp=\"csv\">📊 Excel (CSV)</button>\n          <button class=\"btn ghost\" data-exp=\"txt\">📄 Texte (1 numéro / ligne)</button>\n          <button class=\"btn ghost\" data-exp=\"vcf\">👤 Contacts (vCard)</button>\n        </div>\n        <p class=\"hint\" style=\"margin:10px 0 0\">Le CSV s'ouvre directement dans Excel / Google Sheets / Numbers. Le fichier vCard s'importe dans les contacts du téléphone (pratique pour les listes de diffusion WhatsApp).</p>\n      </div>\n      <div class=\"sec card\">\n        <div class=\"bar\"><input class=\"in\" id=\"cq\" placeholder=\"Rechercher un nom, un numéro…\" value=\"${esc(cFilter.q)}\"><button class=\"btn ghost sm\" id=\"crefresh\">↻ Actualiser</button></div>\n        ${groups.map((gr) => `<p class=\"lab\" style=\"margin:14px 0 6px;text-transform:capitalize\">${esc(gr.day)} · ${gr.items.length}</p>\n          <table class=\"tbl\"><tr><th>Téléphone</th><th>Nom</th><th>Commandes</th><th>Total</th><th>Dernière</th><th>Canal</th><th></th></tr>\n          ${gr.items.map((c) => `<tr><td><b>${esc(c.phone)}</b>${c.optIn ? ' <span title=\"Accepte les offres\">✉️</span>' : ''}</td><td>${esc(c.name)}${c.telegram ? `<br><small class=\"muted\">${esc(c.telegram)}</small>` : ''}</td><td>${c.orders}</td><td class=\"e\">${eur(c.total)}</td><td>${dt(c.lastSeen)}</td><td>${c.channel === 'signal' ? '🔵 Signal' : c.channel === 'whatsapp' ? '💬 WhatsApp' : '—'}</td>\n            <td><button class=\"btn danger sm\" data-cdel=\"${esc(c.phone)}\" title=\"Supprimer ce numéro\">✕</button></td></tr>`).join('')}</table>`).join('') || '<div class=\"empty\">Aucun client pour ces filtres.</div>'}\n        ${data.count > data.customers.length ? `<p class=\"hint\">Affichage limité aux ${data.customers.length} plus récents — le téléchargement contient les ${data.count}.</p>` : ''}\n      </div>`;\n    const refresh = () => tCustomers(main);\n    $('#cfrom').onchange = (e) => { cFilter.from = e.target.value; refresh(); };\n    $('#cto').onchange = (e) => { cFilter.to = e.target.value; refresh(); };\n    $('#coptin').onchange = (e) => { cFilter.optIn = e.target.checked; refresh(); };\n    $('#crefresh').onclick = refresh;\n    $('#cq').oninput = (e) => { cFilter.q = e.target.value; const pos = e.target.selectionStart; tCustomers(main).then(() => { const n = $('#cq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); };\n    $$('[data-exp]').forEach((b) => { b.onclick = (e) => withBusy(e.currentTarget, () => downloadExport(b.dataset.exp)); });\n    $$('[data-cdel]').forEach((b) => {\n      b.onclick = async () => {\n        if (!confirm(`Supprimer définitivement ${b.dataset.cdel} du fichier clients ?`)) return;\n        try { await api('DELETE', '/api/admin/customers/' + encodeURIComponent(b.dataset.cdel)); toast('Numéro supprimé'); refresh(); } catch (err) { toast(err.message, true); }\n      };\n    });\n  }\n\n  // Téléchargement via un lien temporaire signé (5 min) : marche dans un navigateur ET dans Telegram\n  async function downloadExport(format) {\n    const { url, fileName } = await api('POST', '/api/admin/export-link', { format, from: cFilter.from, to: cFilter.to, optIn: cFilter.optIn });\n    const abs = location.origin + url;\n    if (tg && tg.initData) {\n      try { if (tg.downloadFile) { tg.downloadFile({ url: abs, file_name: fileName }); return; } } catch (e) { /* ancienne version de Telegram */ }\n      try { tg.openLink(abs); return; } catch (e) { /* */ }\n    }\n    const a = document.createElement('a');\n    a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();\n    toast('Téléchargement lancé ✓');\n  }\n\n  boot();\n})();\n","/app.css":"/* ============ Boutique néon — mini-app Telegram ============ */\n:root {\n  --bg: #05060f;\n  --accent: #00f0ff; --accent-rgb: 0, 240, 255;\n  --accent2: #b44cff; --accent2-rgb: 180, 76, 255;\n  --gram: #00f0ff; --gram-rgb: 0, 240, 255;\n  --price: #39ff88; --price-rgb: 57, 255, 136;\n  --blur: 14px; --panel: .45; --overlay: .55; --glow: 1;\n  --text: #eef1ff; --muted: #a2abd0; --line: rgba(255, 255, 255, .1);\n  --radius: 20px;\n  --safe-b: env(safe-area-inset-bottom, 0px);\n  --display: 'Orbitron', 'Inter', system-ui, sans-serif;\n}\n* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }\nhtml { background: var(--bg); }\nbody { margin: 0; min-height: 100%; color: var(--text); }\nbody { font: 15px/1.45 'Inter', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }\nbutton, input, textarea, select { font: inherit; color: inherit; }\nbutton { cursor: pointer; }\nimg { display: block; max-width: 100%; }\n[hidden] { display: none !important; }\n\n/* ---------- fond animé ---------- */\n.bg { position: fixed; inset: 0; z-index: -2; overflow: hidden; background: var(--bg); }\n.orb { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .55; animation: float 18s ease-in-out infinite alternate; }\n.o1 { width: 55vmax; height: 55vmax; left: -20vmax; top: -22vmax; background: radial-gradient(circle, rgba(var(--accent-rgb), .55), transparent 65%); }\n.o2 { width: 50vmax; height: 50vmax; right: -22vmax; top: 18vh; background: radial-gradient(circle, rgba(var(--accent2-rgb), .55), transparent 65%); animation-duration: 22s; }\n.o3 { width: 40vmax; height: 40vmax; left: 10vw; bottom: -25vmax; background: radial-gradient(circle, rgba(var(--price-rgb), .28), transparent 65%); animation-duration: 26s; }\n.floor {\n  position: absolute; left: -50%; right: -50%; bottom: 0; height: 55vh;\n  background-image: linear-gradient(rgba(var(--accent-rgb), .16) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--accent-rgb), .16) 1px, transparent 1px);\n  background-size: 46px 46px;\n  transform: perspective(520px) rotateX(62deg); transform-origin: bottom;\n  -webkit-mask-image: linear-gradient(to top, #000 10%, transparent 85%); mask-image: linear-gradient(to top, #000 10%, transparent 85%);\n  animation: floor 3.5s linear infinite;\n}\n.bg.static .orb, .bg.static .floor { animation: none; }\n.bg.hidden-fx .orb, .bg.hidden-fx .floor { display: none; }\n@keyframes float { to { transform: translate3d(6vw, 5vh, 0) scale(1.12); } }\n@keyframes floor { to { background-position: 0 46px; } }\n.bg-image { position: fixed; inset: 0; z-index: -1; background: center / cover no-repeat; display: none; }\n.bg-image.on { display: block; }\n.bg-image::after { content: ''; position: absolute; inset: 0; background: rgba(3, 4, 12, var(--overlay)); }\n\n/* ---------- verre & mise en page ---------- */\n.glass {\n  background: rgba(14, 16, 36, var(--panel));\n  -webkit-backdrop-filter: blur(var(--blur)) saturate(150%);\n  backdrop-filter: blur(var(--blur)) saturate(150%);\n  border: 1px solid var(--line);\n  border-radius: var(--radius);\n  box-shadow: 0 12px 32px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .06);\n}\n.app { max-width: 780px; margin: 0 auto; padding: 16px 16px calc(104px + var(--safe-b)); min-height: 100vh; }\n.view { animation: in .35s ease both; }\n@keyframes in { from { opacity: 0; transform: translateY(8px); } }\nsection { margin-top: 22px; }\n.sec-head { display: flex; align-items: center; justify-content: space-between; margin: 0 2px 12px; gap: 10px; }\n.sec-head h2 {\n  margin: 0; font: 700 13px/1 var(--display); letter-spacing: .16em; text-transform: uppercase;\n  display: inline-flex; align-items: center; gap: 10px;\n  padding: 8px 12px; border-radius: 12px; background: rgba(10, 12, 28, calc(var(--panel) * .8));\n  -webkit-backdrop-filter: blur(var(--blur)); backdrop-filter: blur(var(--blur));\n}\n.sec-head h2::before { content: ''; width: 16px; height: 3px; border-radius: 3px; background: var(--accent); box-shadow: 0 0 10px var(--accent); }\n.sec-head .count { color: var(--muted); font-size: 13px; padding: 6px 10px; border-radius: 10px; background: rgba(10, 12, 28, calc(var(--panel) * .8)); -webkit-backdrop-filter: blur(var(--blur)); backdrop-filter: blur(var(--blur)); }\n.page-title { font: 900 24px/1.1 var(--display); letter-spacing: .04em; margin: 6px 2px 16px; }\n\n/* ---------- en-tête ---------- */\n.hero { display: flex; align-items: center; gap: 14px; padding: 16px; position: relative; overflow: hidden; }\n.hero::after { content: ''; position: absolute; inset: auto 0 0 0; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), var(--accent2), transparent); opacity: .8; }\n.logo { width: 60px; height: 60px; border-radius: 18px; flex: none; object-fit: cover; border: 1px solid rgba(var(--accent-rgb), .6); box-shadow: 0 0 18px rgba(var(--accent-rgb), .45); background: #0b0d20; }\n.logo.fallback { display: grid; place-items: center; font: 900 26px var(--display); color: var(--accent); text-shadow: 0 0 12px var(--accent); }\n.shop-name {\n  margin: 0; font: 900 clamp(20px, 5.6vw, 28px)/1.1 var(--display); letter-spacing: .06em; text-transform: uppercase;\n  background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; background-clip: text; color: transparent;\n  filter: drop-shadow(0 0 calc(8px * var(--glow)) rgba(var(--accent-rgb), .55));\n}\n.tagline { margin: 4px 0 0; color: var(--muted); font-size: 13px; }\n\n/* ---------- recherche ---------- */\n.search { display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 16px; margin-top: 14px; transition: border-color .2s, box-shadow .2s; }\n.search:focus-within { border-color: rgba(var(--accent-rgb), .8); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), .5), 0 0 24px rgba(var(--accent-rgb), .35); }\n.search svg { width: 20px; height: 20px; flex: none; stroke: var(--accent); fill: none; stroke-width: 2; filter: drop-shadow(0 0 5px var(--accent)); }\n.search input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; font-size: 16px; }\n.search input::placeholder { color: var(--muted); }\n.icon-btn { border: 0; background: rgba(255, 255, 255, .08); width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; }\n\n/* ---------- catégories ---------- */\n.cats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }\n.cat { position: relative; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; padding: 0; background: #0b0d20; aspect-ratio: 1 / 1.08; transition: transform .2s, box-shadow .25s, border-color .25s; }\n.cat img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s; }\n.cat:hover img { transform: scale(1.06); }\n.cat:active { transform: scale(.97); }\n.cat .label {\n  position: absolute; left: 7px; right: 7px; bottom: 7px; padding: 7px 6px; border-radius: 12px;\n  background: rgba(8, 10, 24, .5); -webkit-backdrop-filter: blur(calc(var(--blur) * .8)); backdrop-filter: blur(calc(var(--blur) * .8));\n  font-weight: 700; font-size: 13px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid rgba(255, 255, 255, .08);\n}\n.cat.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 0 26px rgba(var(--accent-rgb), .55); }\n.cat.active .label { color: var(--accent); text-shadow: 0 0 10px rgba(var(--accent-rgb), .8); }\n\n/* ---------- produits ---------- */\n.products { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 12px; }\n.card { display: flex; flex-direction: column; overflow: hidden; cursor: pointer; padding: 0; text-align: left; transition: transform .2s, box-shadow .25s, border-color .25s; }\n.card:hover { border-color: rgba(var(--accent-rgb), .45); box-shadow: 0 14px 34px rgba(0, 0, 0, .4), 0 0 22px rgba(var(--accent-rgb), .2); }\n.card:active { transform: scale(.98); }\n.card .img { position: relative; aspect-ratio: 4 / 3; background: #0b0d20; overflow: hidden; }\n.card .img img { width: 100%; height: 100%; object-fit: cover; }\n.ph { width: 100%; height: 100%; display: grid; place-items: center; font: 900 28px var(--display); color: rgba(var(--accent-rgb), .6); }\n.tag {\n  position: absolute; top: 8px; left: 8px; padding: 3px 8px; border-radius: 8px; font: 700 10px/1.4 var(--display); letter-spacing: .08em;\n  color: #05060f; background: var(--accent2); box-shadow: 0 0 14px rgba(var(--accent2-rgb), .8);\n}\n.card .body { padding: 11px 12px 12px; display: flex; flex-direction: column; gap: 8px; flex: 1; }\n.card .name { font-weight: 700; font-size: 15px; line-height: 1.25; }\n.card .cat-name { color: var(--muted); font-size: 12px; margin-top: -5px; }\n.card .row { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 6px; }\n.from { font-size: 11px; color: var(--muted); display: block; margin-bottom: 1px; }\n.add-mini {\n  flex: none; width: 36px; height: 36px; border-radius: 12px; border: 1px solid rgba(var(--accent-rgb), .6);\n  background: rgba(var(--accent-rgb), .12); color: var(--accent); font-size: 22px; line-height: 1; display: grid; place-items: center;\n  box-shadow: 0 0 14px rgba(var(--accent-rgb), .35), inset 0 0 10px rgba(var(--accent-rgb), .2); transition: transform .15s;\n}\n.add-mini:active { transform: scale(.9); }\n\n/* ---------- groupes par catégorie ---------- */\n.group { margin-bottom: 26px; scroll-margin-top: 14px; }\n.group-head { display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 10px; margin-bottom: 12px; border-left: 3px solid var(--accent); box-shadow: 0 10px 26px rgba(0, 0, 0, .3), -6px 0 18px -6px rgba(var(--accent-rgb), .6); }\n.group-head img, .gh-ph { width: 46px; height: 46px; border-radius: 13px; object-fit: cover; flex: none; border: 1px solid rgba(var(--accent-rgb), .45); box-shadow: 0 0 14px rgba(var(--accent-rgb), .35); }\n.gh-ph { display: grid; place-items: center; color: var(--accent); background: rgba(var(--accent-rgb), .1); }\n.group-head h3 { margin: 0; font: 800 17px/1.2 var(--display); letter-spacing: .04em; }\n.group-head small { color: var(--muted); font-size: 12px; }\n.group.flash .group-head { animation: flash 1.1s ease; }\n@keyframes flash { 30% { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 0 30px rgba(var(--accent-rgb), .6); } }\n.admin-btn { position: absolute; top: 10px; right: 10px; z-index: 2; border: 1px solid rgba(var(--accent2-rgb), .7); background: rgba(var(--accent2-rgb), .15); color: #fff; border-radius: 10px; padding: 5px 10px; font-size: 12px; font-weight: 700; box-shadow: 0 0 14px rgba(var(--accent2-rgb), .5); }\n\n/* ---------- valeurs lumineuses ---------- */\n.grams, .price { font-family: var(--display); font-weight: 700; letter-spacing: .02em; white-space: nowrap; animation: neon 4s ease-in-out infinite; }\n.grams { color: var(--gram); text-shadow: 0 0 calc(2px * var(--glow)) #fff8, 0 0 calc(6px * var(--glow)) rgba(var(--gram-rgb), .95), 0 0 calc(16px * var(--glow)) rgba(var(--gram-rgb), .7), 0 0 calc(30px * var(--glow)) rgba(var(--gram-rgb), .45); }\n.price { color: var(--price); text-shadow: 0 0 calc(2px * var(--glow)) #fff8, 0 0 calc(6px * var(--glow)) rgba(var(--price-rgb), .95), 0 0 calc(16px * var(--glow)) rgba(var(--price-rgb), .7), 0 0 calc(30px * var(--glow)) rgba(var(--price-rgb), .45); }\n.chip { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 12px; }\n.chip.grams { border: 1px solid rgba(var(--gram-rgb), .55); background: rgba(var(--gram-rgb), .08); box-shadow: 0 0 calc(12px * var(--glow)) rgba(var(--gram-rgb), .35), inset 0 0 10px rgba(var(--gram-rgb), .15); }\n.card .price { font-size: 16px; }\n.big { font-size: 26px; }\n@keyframes neon { 0%, 100% { opacity: 1; } 46% { opacity: 1; } 48% { opacity: .82; } 50% { opacity: 1; } 75% { opacity: .92; } }\n\n/* ---------- boutons & formulaires ---------- */\n.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 54px; border: 0; border-radius: 16px;\n  font-weight: 800; font-size: 15px; letter-spacing: .03em; color: #04050e; text-decoration: none;\n  background: linear-gradient(95deg, var(--accent), var(--accent2));\n  box-shadow: 0 0 calc(24px * var(--glow)) rgba(var(--accent-rgb), .45), 0 8px 24px rgba(0, 0, 0, .35); transition: transform .15s, filter .2s;\n}\n.btn:active { transform: scale(.98); }\n.btn:disabled { filter: grayscale(.7) brightness(.7); cursor: wait; }\n.btn.ghost { background: rgba(255, 255, 255, .06); color: var(--text); border: 1px solid var(--line); box-shadow: none; }\n.btn.wa { background: linear-gradient(95deg, #25d366, #0fbf73); box-shadow: 0 0 26px rgba(37, 211, 102, .55); }\n.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }\n.field label { font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: .03em; }\n.input { width: 100%; min-height: 50px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: rgba(255, 255, 255, .05); outline: 0; font-size: 16px; transition: border-color .2s, box-shadow .2s; }\ntextarea.input { min-height: 84px; resize: vertical; }\n.input:focus { border-color: rgba(var(--accent-rgb), .8); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), .4), 0 0 18px rgba(var(--accent-rgb), .25); }\n.stepper { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 12px; background: rgba(255, 255, 255, .04); overflow: hidden; }\n.stepper button { width: 36px; height: 36px; border: 0; background: none; font-size: 18px; }\n.stepper button:active { background: rgba(var(--accent-rgb), .15); }\n.stepper span { min-width: 26px; text-align: center; font-weight: 800; }\n\n/* ---------- feuille (modale) ---------- */\n.sheet { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; }\n.sheet-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .6); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); animation: fade .25s ease; }\n.sheet-panel {\n  position: relative; width: 100%; max-width: 780px; max-height: 92vh; overflow-y: auto; border-radius: 26px 26px 0 0; border-bottom: 0;\n  padding: 0 0 calc(18px + var(--safe-b)); background: rgba(12, 14, 32, max(var(--panel), .82)); animation: up .32s cubic-bezier(.2, .9, .3, 1);\n}\n.sheet-panel .grab { width: 44px; height: 5px; border-radius: 5px; background: rgba(255, 255, 255, .25); margin: 10px auto 0; }\n.sheet-close { position: absolute; top: 12px; right: 12px; z-index: 2; width: 36px; height: 36px; border-radius: 12px; border: 1px solid var(--line); background: rgba(8, 10, 24, .6); font-size: 18px; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }\n@keyframes up { from { transform: translateY(100%); } }\n@keyframes fade { from { opacity: 0; } }\n.pd-img { aspect-ratio: 16 / 10; max-height: 340px; width: 100%; object-fit: cover; margin-top: 10px; border-radius: 18px 18px 0 0; }\n.pd { padding: 16px 18px 0; }\n.pd h3 { margin: 0 0 6px; font: 800 22px/1.2 var(--display); letter-spacing: .02em; }\n.pd .desc { color: #cdd3ee; margin: 0 0 16px; white-space: pre-line; }\n.opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; margin-bottom: 18px; }\n.opt { padding: 12px 8px; border-radius: 16px; border: 1px solid var(--line); background: rgba(255, 255, 255, .04); display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all .2s; }\n.opt .grams { font-size: 18px; }\n.opt .price { font-size: 14px; }\n.opt.sel { border-color: var(--gram); background: rgba(var(--gram-rgb), .08); box-shadow: 0 0 calc(20px * var(--glow)) rgba(var(--gram-rgb), .45), inset 0 0 16px rgba(var(--gram-rgb), .16); }\n.pd-foot { display: flex; align-items: center; gap: 12px; }\n.pd-foot .btn { flex: 1; }\n.lbl { font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; margin: 0 0 8px; }\n\n/* ---------- panier ---------- */\n.line { display: flex; gap: 12px; padding: 10px; align-items: center; margin-bottom: 10px; }\n.line img, .line .ph { width: 64px; height: 64px; border-radius: 14px; object-fit: cover; flex: none; background: #0b0d20; font-size: 16px; }\n.line .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }\n.line .name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.line .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; }\n.line .right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }\n.del { border: 0; background: none; color: var(--muted); font-size: 12px; padding: 2px; text-decoration: underline; }\n.summary { padding: 16px; margin: 16px 0; }\n.summary .r { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; color: #d3d8f2; }\n.summary .r.total { border-top: 1px dashed var(--line); margin-top: 6px; padding-top: 12px; color: var(--text); font-weight: 800; font-size: 17px; }\n.note { font-size: 13px; color: var(--muted); padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(var(--accent-rgb), .25); background: rgba(var(--accent-rgb), .06); margin-bottom: 14px; }\n.form { padding: 16px; }\n.empty { text-align: center; padding: 40px 20px; }\n.empty .ico { font-size: 54px; filter: drop-shadow(0 0 18px rgba(var(--accent-rgb), .7)); }\n.empty h3 { font: 800 18px var(--display); margin: 12px 0 6px; }\n.empty p { color: var(--muted); margin: 0 0 18px; }\n\n/* ---------- succès ---------- */\n.success { text-align: center; padding: 30px 18px; }\n.check { width: 86px; height: 86px; margin: 0 auto 16px; border-radius: 50%; display: grid; place-items: center; font-size: 40px; color: var(--price); border: 2px solid var(--price); box-shadow: 0 0 30px rgba(var(--price-rgb), .6), inset 0 0 20px rgba(var(--price-rgb), .3); animation: pop .5s cubic-bezier(.2, 1.4, .4, 1); }\n@keyframes pop { from { transform: scale(.4); opacity: 0; } }\n.success h2 { font: 900 22px var(--display); margin: 0 0 8px; }\n.success p { color: #cdd3ee; margin: 0 0 16px; }\n.oid { font-family: var(--display); color: var(--accent); text-shadow: 0 0 12px var(--accent); }\n.stack { display: grid; gap: 10px; margin-top: 18px; }\n\n/* ---------- avis ---------- */\n.rating-hero { display: flex; align-items: center; gap: 18px; padding: 18px; margin-bottom: 14px; }\n.rating-hero .score { font: 900 46px/1 var(--display); color: #ffd84d; text-shadow: 0 0 14px rgba(255, 216, 77, .8), 0 0 34px rgba(255, 216, 77, .4); }\n.stars { color: #ffd84d; letter-spacing: 2px; text-shadow: 0 0 8px rgba(255, 216, 77, .7); }\n.stars .off { color: rgba(255, 255, 255, .18); text-shadow: none; }\n.review { padding: 14px 16px; margin-bottom: 10px; }\n.review .top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }\n.avatar { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; font-weight: 800; color: #05060f; background: linear-gradient(135deg, var(--accent), var(--accent2)); box-shadow: 0 0 14px rgba(var(--accent-rgb), .4); flex: none; }\n.review .who { flex: 1; min-width: 0; }\n.review .who b { display: block; }\n.review .who small { color: var(--muted); }\n.review p { margin: 0; color: #d8ddf5; }\n.star-pick { display: flex; gap: 6px; justify-content: center; margin: 4px 0 14px; }\n.star-pick button { border: 0; background: none; font-size: 34px; color: rgba(255, 255, 255, .2); padding: 0 2px; transition: transform .15s; }\n.star-pick button.on { color: #ffd84d; text-shadow: 0 0 14px rgba(255, 216, 77, .8); }\n.star-pick button:active { transform: scale(1.2); }\n\n/* ---------- réseaux ---------- */\n.socials { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }\n.social { --c: var(--accent); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 22px 12px; text-decoration: none; color: var(--text); text-align: center; transition: transform .2s, border-color .25s, box-shadow .25s; }\n.social:hover, .social:active { border-color: var(--c); box-shadow: 0 0 26px color-mix(in srgb, var(--c) 45%, transparent); }\n.social:active { transform: scale(.97); }\n.social .ic { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; border: 1px solid var(--c); color: var(--c); box-shadow: 0 0 20px color-mix(in srgb, var(--c) 55%, transparent), inset 0 0 14px color-mix(in srgb, var(--c) 25%, transparent); }\n.social .ic svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 6px currentColor); }\n.social b { font-size: 15px; }\n.social small { color: var(--muted); font-size: 12px; margin-top: -6px; word-break: break-all; }\n\n/* ---------- barre d'onglets ---------- */\n.tabbar {\n  position: fixed; z-index: 40; left: 50%; transform: translateX(-50%); bottom: calc(10px + var(--safe-b));\n  width: min(748px, calc(100% - 20px)); display: grid; grid-template-columns: repeat(5, 1fr); padding: 6px; border-radius: 22px;\n  background: rgba(10, 12, 28, max(var(--panel), .7));\n}\n.tab { position: relative; border: 0; background: none; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px 6px; border-radius: 16px; color: var(--muted); font-size: 11px; font-weight: 600; transition: color .2s, background .2s; }\n.tab svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; stroke-linecap: round; }\n.tab.active { color: var(--accent); background: rgba(var(--accent-rgb), .1); }\n.tab.active svg { filter: drop-shadow(0 0 6px var(--accent)); }\n.tab.active::after { content: ''; position: absolute; top: 0; width: 22px; height: 3px; border-radius: 3px; background: var(--accent); box-shadow: 0 0 10px var(--accent); }\n.badge { position: absolute; top: 3px; left: calc(50% + 6px); min-width: 19px; height: 19px; padding: 0 5px; border-radius: 10px; background: var(--accent2); color: #fff; font: 800 11px/19px 'Inter'; box-shadow: 0 0 12px rgba(var(--accent2-rgb), .9); }\n.badge.bump { animation: bump .4s ease; }\n@keyframes bump { 50% { transform: scale(1.35); } }\n\n/* ---------- divers ---------- */\n.toast {\n  position: fixed; z-index: 60; left: 50%; bottom: calc(96px + var(--safe-b)); transform: translate(-50%, 20px); opacity: 0; pointer-events: none;\n  padding: 12px 18px; border-radius: 14px; background: rgba(12, 14, 32, .92); border: 1px solid rgba(var(--accent-rgb), .5);\n  box-shadow: 0 0 22px rgba(var(--accent-rgb), .35); font-weight: 600; transition: all .3s; width: max-content; max-width: calc(100% - 32px); text-align: center;\n}\n.toast.show { opacity: 1; transform: translate(-50%, 0); }\n.toast.err { border-color: #ff4d6d; box-shadow: 0 0 22px rgba(255, 77, 109, .4); }\n.loader { min-height: 70vh; display: grid; place-content: center; justify-items: center; gap: 14px; color: var(--muted); }\n.ring { width: 46px; height: 46px; border-radius: 50%; border: 3px solid rgba(var(--accent-rgb), .2); border-top-color: var(--accent); animation: spin 1s linear infinite; box-shadow: 0 0 18px rgba(var(--accent-rgb), .4); }\n@keyframes spin { to { transform: rotate(360deg); } }\n.muted { color: var(--muted); }\n.mt { margin-top: 14px; }\n\n@media (max-width: 360px) {\n  .products { grid-template-columns: 1fr 1fr; gap: 10px; }\n  .cat .label { font-size: 12px; }\n}\n@media (min-width: 640px) {\n  .app { padding-top: 24px; }\n  .sheet { align-items: center; }\n  .sheet-panel { border-radius: 26px; border-bottom: 1px solid var(--line); max-width: 560px; }\n  .socials { grid-template-columns: repeat(3, 1fr); }\n}\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition: none !important; }\n}\n\n/* ============ Optimisation téléphone ============ */\n:root {\n  --app-w: 480px;\n  --safe-t: calc(env(safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px));\n}\nhtml { -webkit-text-size-adjust: 100%; overscroll-behavior-y: none; }\nbody { touch-action: manipulation; }\nbutton, .card, .tab, .social, .opt, .add-mini { -webkit-user-select: none; user-select: none; }\n\n/* Largeur d'un téléphone, même sur ordinateur ou dans Telegram Desktop */\n.app { max-width: var(--app-w); padding: calc(12px + var(--safe-t)) 14px calc(96px + var(--safe-b)); }\n.tabbar { width: min(calc(var(--app-w) - 20px), calc(100% - 16px)); bottom: calc(8px + var(--safe-b)); padding: 5px; border-radius: 20px; }\n.tab { padding: 7px 2px 5px; }\n.sheet-panel, .sheet-panel.glass { max-width: var(--app-w); max-height: 88vh; max-height: 88dvh; }\n.toast { bottom: calc(88px + var(--safe-b)); }\n@media (min-width: 640px) {\n  .app { padding-top: 20px; }\n  .sheet { align-items: flex-end; }\n  .sheet-panel { border-radius: 26px 26px 0 0; border-bottom: 0; }\n  .socials { grid-template-columns: repeat(2, 1fr); }\n}\n\n/* En-tête compact */\n.hero { padding: 12px 14px; gap: 12px; border-radius: 18px; }\n.logo { width: 50px; height: 50px; border-radius: 15px; }\n.logo.fallback { font-size: 22px; }\n.shop-name { font-size: clamp(17px, 5.2vw, 22px); }\n.tagline { font-size: 12px; margin-top: 3px; }\n\n/* Recherche qui reste accessible en haut pendant le défilement */\n.search {\n  position: sticky; top: calc(8px + var(--safe-t)); z-index: 20; height: 48px; margin-top: 10px; border-radius: 16px;\n  background: rgba(14, 16, 36, max(var(--panel), .78));\n}\n.search input { font-size: 16px; } /* évite le zoom automatique sur iPhone */\nsection { margin-top: 18px; }\n\n/* Produits : 2 colonnes serrées, lisibles au pouce */\n.products { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }\n.card { border-radius: 18px; }\n.card .body { padding: 10px 10px 11px; gap: 7px; }\n.card .name { font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.card .price { font-size: 15px; }\n.add-mini { width: 38px; height: 38px; }\n.group { margin-bottom: 20px; }\n.group-head { padding: 8px 12px 8px 8px; }\n.group-head img, .gh-ph { width: 40px; height: 40px; border-radius: 12px; }\n.group-head h3 { font-size: 15px; }\n\n/* Fiche produit */\n.pd { padding: 14px 16px 0; }\n.pd h3 { font-size: 20px; }\n.pd-img { border-radius: 0; margin-top: 8px; aspect-ratio: 16 / 11; }\n.opts { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }\n.opt { padding: 11px 6px; }\n.stepper button { width: 40px; height: 40px; }\n\n/* Panier */\n.page-title { font-size: 21px; margin: 4px 2px 14px; }\n.line { gap: 10px; padding: 9px; }\n.line img, .line .ph { width: 58px; height: 58px; }\n.line .right { gap: 6px; }\n.summary, .form { padding: 14px; }\n.btn { height: 52px; }\n\n/* Pas d'effets de survol « bloqués » au toucher */\n@media (hover: none) {\n  .card:hover, .social:hover { border-color: var(--line); box-shadow: 0 12px 32px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .06); }\n  .cat:hover img { transform: none; }\n}\n\n/* Très petits écrans */\n@media (max-width: 350px) {\n  .app { padding-left: 10px; padding-right: 10px; }\n  .products { gap: 8px; }\n  .card .name { font-size: 13px; }\n  .card .price { font-size: 14px; }\n  .chip { font-size: 11px; padding: 2px 7px; }\n  .tab span { font-size: 10px; }\n}\n.search::before { content: ''; position: absolute; z-index: -1; left: -16px; right: -16px; bottom: 100%; height: calc(10px + var(--safe-t)); background: linear-gradient(var(--bg) 70%, transparent); pointer-events: none; }\n\n/* Bouton « Ajouter » toujours visible en bas de la fiche produit */\n.pd-img { max-height: 34vh; max-height: 34dvh; }\n.pd-foot {\n  position: sticky; bottom: calc(-18px - var(--safe-b)); z-index: 3;\n  margin: 0 -16px; padding: 14px 16px calc(18px + var(--safe-b));\n  background: linear-gradient(rgba(12, 14, 32, 0), rgba(12, 14, 32, .96) 28%);\n}\n\n/* Panier : nom lisible sur 2 lignes, contrôles compacts */\n.line { align-items: flex-start; }\n.line .name { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 14px; line-height: 1.25; }\n.line .stepper button { width: 32px; height: 32px; }\n.line .stepper span { min-width: 22px; }\n.line .price { font-size: 14px; }\n\n/* ============ Plus aucun mouvement horizontal ============ */\nhtml, body { max-width: 100%; overflow-x: hidden; overscroll-behavior-x: none; }\nbody { touch-action: pan-y; }                 /* seul le défilement vertical est possible */\n.bg, .bg-image { width: 100%; right: auto; }  /* évite le demi-pixel de débordement */\n.app, .view, section, .group, .products, .card, .line, .summary, .form, .hero, .search, .glass { max-width: 100%; min-width: 0; }\n.search::before { left: -14px; right: -14px; }\n.card .name, .line .name, .group-head h3, .review p, .pd .desc { overflow-wrap: anywhere; }\n\n/* ---------- vidéo produit ---------- */\n.vid-dot { position: absolute; right: 8px; bottom: 8px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; color: #05060f; background: var(--accent); box-shadow: 0 0 14px rgba(var(--accent-rgb), .8); }\nvideo.pd-img { background: #000; object-fit: contain; }\n.pd-video { width: 100%; aspect-ratio: 16 / 9; max-height: 34vh; max-height: 34dvh; margin-top: 8px; background: #000; }\n.pd-video iframe { width: 100%; height: 100%; border: 0; display: block; }\n.pd-media { padding: 14px 16px 0; }\n.pd-media .lbl { margin-bottom: 8px; }\n.pd-media .pd-video, .pd-video-file { width: 100%; aspect-ratio: 16 / 9; max-height: 32vh; max-height: 32dvh; border-radius: 14px; overflow: hidden; background: #000; display: block; border: 1px solid var(--line); }\n.pd-video-file { object-fit: contain; }\n\n/* ============ v1.5 : notifications, news, choix du canal ============ */\n.notices { display: grid; gap: 10px; margin: 14px 0 4px; }\n.notice { --n: var(--accent); --n-rgb: var(--accent-rgb); display: flex; gap: 12px; align-items: flex-start; padding: 12px 12px 12px 14px; border-left: 3px solid var(--n);\n  box-shadow: 0 10px 26px rgba(0, 0, 0, .3), -6px 0 18px -6px rgba(var(--n-rgb), .7); animation: noticeIn .45s ease both; }\n.notice.promo { --n: var(--accent2); --n-rgb: var(--accent2-rgb); }\n.notice.alert { --n: #ffc94d; --n-rgb: 255, 201, 77; }\n.notice .n-ico { font-size: 20px; line-height: 1.2; flex: none; filter: drop-shadow(0 0 8px rgba(var(--n-rgb), .8)); }\n.notice .n-txt { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; word-wrap: break-word; }\n.notice .n-txt a { color: var(--n); font-weight: 700; text-decoration: none; display: inline-block; margin-top: 4px; }\n.notice .n-x { flex: none; border: 0; background: none; color: var(--muted); font-size: 15px; padding: 2px 4px; }\n@keyframes noticeIn { from { opacity: 0; transform: translateY(-8px); } }\n\n.news-item { padding: 0; margin-bottom: 12px; overflow: hidden; }\n.news-item img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }\n.news-item .nb { padding: 14px 16px; }\n.news-item h3 { font: 800 17px/1.25 var(--display); margin: 8px 0 6px; letter-spacing: .02em; }\n.news-item p { margin: 0; color: #d8ddf5; white-space: pre-line; }\n.news-item .meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--muted); }\n.news-item.unread { border-color: rgba(var(--accent-rgb), .6); box-shadow: 0 0 22px rgba(var(--accent-rgb), .2); }\n.ntag { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; border: 1px solid rgba(var(--accent-rgb), .55); color: var(--accent); }\n.ntag.promo { border-color: rgba(var(--accent2-rgb), .7); color: #e2b8ff; }\n.ntag.update { border-color: rgba(255, 201, 77, .6); color: #ffd97a; }\n.ntag.new { background: var(--accent2); border-color: transparent; color: #fff; }\n\n.channels { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }\n.channel { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 10px; border-radius: 16px; border: 1px solid var(--line); background: rgba(255, 255, 255, .04); color: var(--text); font-weight: 700; transition: border-color .2s, box-shadow .2s; }\n.channel svg { width: 26px; height: 26px; }\n.channel small { color: var(--muted); font-weight: 500; font-size: 11px; }\n.channel.wa.sel { border-color: #25d366; box-shadow: 0 0 0 1px #25d366, 0 0 22px rgba(37, 211, 102, .45); }\n.channel.sg.sel { border-color: #3a76f0; box-shadow: 0 0 0 1px #3a76f0, 0 0 22px rgba(58, 118, 240, .5); }\n.channel.wa svg { color: #25d366; } .channel.sg svg { color: #6b9bff; }\n.btn.sg { background: linear-gradient(95deg, #3a76f0, #2c5fd1); color: #fff; box-shadow: 0 0 26px rgba(58, 118, 240, .55); }\n.optin { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--muted); margin: 0 0 14px; cursor: pointer; }\n.optin input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--accent); flex: none; }\n.steps { text-align: left; margin: 0 0 6px; padding-left: 20px; color: #cdd3ee; font-size: 14px; }\n.steps li { margin-bottom: 4px; }\n","/app.js":"/* Boutique néon — mini-app Telegram (client) */\n(() => {\n  'use strict';\n\n  const tg = window.Telegram && window.Telegram.WebApp;\n  if (tg) {\n    try { tg.ready(); tg.expand(); tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) { /* hors Telegram */ }\n  }\n\n  const $ = (s, r = document) => r.querySelector(s);\n  const app = $('#app');\n  const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));\n  const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });\n  const eur = (n) => eurFmt.format(n || 0);\n  const g = (n) => new Intl.NumberFormat('fr-FR').format(n || 0) + ' g';\n  const norm = (s) => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();\n  const haptic = (t = 'light') => { try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred(t); } catch (e) { /* */ } };\n  const store = {\n    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },\n    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } },\n  };\n\n  const S = {\n    data: null,\n    isAdmin: false,\n    view: 'home',\n    cat: '',\n    q: '',\n    cart: store.get('cart', []), // [{ pid, grams, qty }]\n    sheet: null,\n    order: null,\n    busy: false,\n    channel: store.get('channel', 'whatsapp'), // canal de commande préféré : whatsapp | signal\n    hidden: store.get('noticesHidden', []), // notifications fermées par le client\n    newsSeen: store.get('newsSeen', ''), // date de la dernière news lue\n  };\n\n  /* ---------------- thème ---------------- */\n  const hexRgb = (h) => { const n = parseInt(String(h).slice(1), 16); return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`; };\n  function applyTheme(s) {\n    const t = s.theme || {};\n    const r = document.documentElement.style;\n    const set = (k, v) => { if (v) { r.setProperty('--' + k, v); r.setProperty('--' + k + '-rgb', hexRgb(v)); } };\n    set('accent', t.accent); set('accent2', t.accent2); set('gram', t.gramColor); set('price', t.priceColor);\n    r.setProperty('--bg', t.bgColor || '#05060f');\n    r.setProperty('--blur', (t.blur ?? 14) + 'px');\n    r.setProperty('--panel', t.panelOpacity ?? 0.45);\n    r.setProperty('--overlay', t.overlay ?? 0.55);\n    r.setProperty('--glow', t.glow ?? 1);\n    const bgi = $('#bgImage');\n    bgi.classList.toggle('on', !!t.bgImage);\n    bgi.style.backgroundImage = t.bgImage ? `url(\"${t.bgImage}\")` : '';\n    $('#bg').classList.toggle('hidden-fx', !!t.bgImage && !t.animatedBg);\n    $('#bg').classList.toggle('static', !t.animatedBg);\n    document.title = s.shopName || 'Boutique';\n    const meta = document.querySelector('meta[name=theme-color]');\n    if (meta) meta.content = t.bgColor || '#05060f';\n    try { if (tg) { tg.setHeaderColor(t.bgColor || '#05060f'); tg.setBackgroundColor(t.bgColor || '#05060f'); } } catch (e) { /* */ }\n  }\n\n  /* ---------------- données ---------------- */\n  async function load() {\n    try {\n      const r = await fetch('/api/shop', { cache: 'no-store' });\n      if (!r.ok) throw new Error();\n      S.data = await r.json();\n      applyTheme(S.data.settings);\n      pruneCart();\n      render();\n      newsBadge();\n      showPopupNotice();\n    } catch (e) {\n      app.innerHTML = `<div class=\"empty view\"><div class=\"ico\">📡</div><h3>Connexion impossible</h3><p>Vérifiez votre connexion puis réessayez.</p><button class=\"btn\" data-act=\"reload\">Réessayer</button></div>`;\n    }\n  }\n  const product = (id) => S.data.products.find((p) => p.id === id);\n  const category = (id) => S.data.categories.find((c) => c.id === id);\n  const minOpt = (p) => p.options.reduce((a, o) => (o.price < a.price ? o : a), p.options[0]);\n\n  /* ---------------- panier ---------------- */\n  function pruneCart() {\n    S.cart = S.cart.filter((it) => { const p = product(it.pid); return p && p.options.some((o) => o.grams === it.grams); });\n    saveCart(false);\n  }\n  function saveCart(bump = true) {\n    store.set('cart', S.cart);\n    const n = S.cart.reduce((a, it) => a + it.qty, 0);\n    const b = $('#cartBadge');\n    b.hidden = !n;\n    b.textContent = n > 99 ? '99+' : n;\n    if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }\n  }\n  function addToCart(pid, grams, qty) {\n    const it = S.cart.find((x) => x.pid === pid && x.grams === grams);\n    if (it) it.qty = Math.min(99, it.qty + qty); else S.cart.push({ pid, grams, qty });\n    saveCart();\n    haptic('medium');\n    const p = product(pid);\n    toast(`✓ ${p.name} · ${g(grams)} ajouté au panier`);\n  }\n  function cartLines() {\n    return S.cart.map((it) => {\n      const p = product(it.pid);\n      const o = p.options.find((x) => x.grams === it.grams);\n      return { ...it, p, price: o.price, total: o.price * it.qty };\n    });\n  }\n  function totals() {\n    const s = S.data.settings;\n    const lines = cartLines();\n    const subtotal = Math.round(lines.reduce((a, l) => a + l.total, 0) * 100) / 100;\n    const delivery = !lines.length ? 0 : s.freeDeliveryFrom > 0 && subtotal >= s.freeDeliveryFrom ? 0 : s.deliveryFee;\n    return { lines, subtotal, delivery, total: subtotal + delivery, grams: lines.reduce((a, l) => a + l.grams * l.qty, 0) };\n  }\n\n  /* ---------------- vues ---------------- */\n  const imgOr = (src, alt, cls = '') => (src ? `<img class=\"${cls}\" src=\"${esc(src)}\" alt=\"${esc(alt)}\" loading=\"lazy\">` : `<div class=\"ph ${cls}\">${esc((alt || '?').slice(0, 1))}</div>`);\n\n  function vHome() {\n    const s = S.data.settings;\n    return `<div class=\"view\">\n      <header class=\"hero glass\">\n        ${S.isAdmin ? '<button class=\"admin-btn\" data-act=\"admin\">⚙️ Admin</button>' : ''}\n        ${s.logo ? `<img class=\"logo\" src=\"${esc(s.logo)}\" alt=\"Logo\" data-act=\"logo-tap\">` : `<div class=\"logo fallback\" data-act=\"logo-tap\">${esc(s.shopName.slice(0, 1))}</div>`}\n        <div><h1 class=\"shop-name\">${esc(s.shopName)}</h1>${s.tagline ? `<p class=\"tagline\">${esc(s.tagline)}</p>` : ''}</div>\n      </header>\n      <div class=\"notices\" id=\"notices\">${noticesHtml()}</div>\n      <label class=\"search glass\">\n        <svg viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/></svg>\n        <input id=\"search\" type=\"search\" placeholder=\"Rechercher un produit…\" value=\"${esc(S.q)}\" autocomplete=\"off\" enterkeyhint=\"search\">\n        <button class=\"icon-btn\" data-act=\"clear-search\" ${S.q ? '' : 'hidden'} aria-label=\"Effacer\">✕</button>\n      </label>\n      <section>\n        <div class=\"sec-head\"><h2 id=\"prodTitle\">Produits</h2><span class=\"count\" id=\"prodCount\"></span></div>\n        <div id=\"products\"></div>\n      </section>\n    </div>`;\n  }\n\n  /* ---------------- notifications d'accueil ---------------- */\n  const NOTICE_ICO = { info: '📢', promo: '🔥', alert: '⚠️' };\n  const visibleNotices = () => (S.data.notices || []).filter((n) => !S.hidden.includes(n.id));\n  function noticesHtml() {\n    return visibleNotices().map((n) => `<div class=\"notice glass ${esc(n.type)}\" data-nid=\"${esc(n.id)}\">\n      <span class=\"n-ico\">${NOTICE_ICO[n.type] || '📢'}</span>\n      <div class=\"n-txt\">${esc(n.text)}${n.link ? `<br><a href=\"${esc(n.link)}\" data-act=\"link\">En savoir plus →</a>` : ''}</div>\n      <button class=\"n-x\" data-act=\"notice-x\" data-id=\"${esc(n.id)}\" aria-label=\"Masquer\">✕</button>\n    </div>`).join('');\n  }\n  function refreshNotices() {\n    const el = $('#notices');\n    if (el) el.innerHTML = noticesHtml();\n  }\n  // Notification « pop-up » : affichée une seule fois au démarrage\n  function showPopupNotice() {\n    const seen = store.get('popupSeen', []);\n    const n = visibleNotices().find((x) => x.popup && !seen.includes(x.id));\n    if (!n || S.view !== 'home' || !$('#sheet').hidden) return;\n    store.set('popupSeen', seen.concat(n.id).slice(-50));\n    openSheet(`<div class=\"pd\" style=\"padding-top:30px;text-align:center\">\n      <div style=\"font-size:44px;filter:drop-shadow(0 0 16px var(--accent))\">${NOTICE_ICO[n.type] || '📢'}</div>\n      <h3 style=\"margin:10px 0 8px\">${n.type === 'promo' ? 'Promotion' : n.type === 'alert' ? 'Important' : 'Information'}</h3>\n      <p class=\"desc\">${esc(n.text)}</p>\n      <div class=\"stack\">${n.link ? `<a class=\"btn\" href=\"${esc(n.link)}\" data-act=\"link\">En savoir plus</a>` : ''}<button class=\"btn ghost\" data-act=\"close\">OK</button></div>\n    </div>`);\n  }\n\n  /* ---------------- news ---------------- */\n  const latestNews = () => (S.data.news || []).reduce((a, n) => (n.date > a ? n.date : a), '');\n  function newsBadge() {\n    const b = $('#newsBadge');\n    if (!b || !S.data) return;\n    const n = (S.data.news || []).filter((x) => x.date > S.newsSeen).length;\n    b.hidden = !n || S.view === 'news';\n    b.textContent = n > 9 ? '9+' : n;\n  }\n  const NEWS_TAG = { news: 'Actu', promo: 'Promo', update: 'Mise à jour' };\n  function vNews() {\n    const list = S.data.news || [];\n    const seen = S.newsSeen;\n    const date = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } };\n    // marquer comme lues\n    S.newsSeen = latestNews() || S.newsSeen;\n    store.set('newsSeen', S.newsSeen);\n    setTimeout(newsBadge);\n    return `<div class=\"view\"><h1 class=\"page-title\">News</h1>\n      <p class=\"muted\" style=\"margin:-8px 2px 16px\">Actualités, promotions et nouveautés de la boutique.</p>\n      ${list.length ? list.map((n) => `<article class=\"news-item glass ${n.date > seen ? 'unread' : ''}\">\n        ${n.image ? `<img src=\"${esc(n.image)}\" alt=\"\" loading=\"lazy\">` : ''}\n        <div class=\"nb\">\n          <div class=\"meta\">${n.pinned ? '<span>📌</span>' : ''}<span class=\"ntag ${esc(n.tag)}\">${NEWS_TAG[n.tag] || 'Actu'}</span>${n.date > seen ? '<span class=\"ntag new\">Nouveau</span>' : ''}<span>${esc(date(n.date))}</span></div>\n          <h3>${esc(n.title)}</h3>\n          ${n.body ? `<p>${esc(n.body)}</p>` : ''}\n          ${n.link ? `<a class=\"btn ghost\" style=\"margin-top:12px;width:100%\" href=\"${esc(n.link)}\" data-act=\"link\">Voir →</a>` : ''}\n        </div>\n      </article>`).join('') : '<div class=\"empty glass\"><div class=\"ico\">📰</div><h3>Aucune actualité</h3><p>Les prochaines news apparaîtront ici.</p></div>'}\n    </div>`;\n  }\n\n  // Temps réel : on interroge le serveur toutes les 60 s (seulement quand l'app est visible)\n  async function pollFeed() {\n    if (document.hidden || !S.data) return;\n    try {\n      const r = await fetch('/api/feed', { cache: 'no-store' });\n      if (!r.ok) return;\n      const f = await r.json();\n      const oldIds = new Set((S.data.notices || []).map((n) => n.id));\n      const fresh = f.notices.filter((n) => !oldIds.has(n.id) && !S.hidden.includes(n.id));\n      const hadNews = latestNews();\n      S.data.notices = f.notices;\n      S.data.news = f.news;\n      refreshNotices();\n      newsBadge();\n      if (fresh.length) { toast(`${NOTICE_ICO[fresh[0].type] || '📢'} ${fresh[0].text.slice(0, 80)}`); haptic('medium'); }\n      else if (latestNews() > hadNews) toast('📰 Nouvelle actualité disponible');\n      if (S.view === 'news') render();\n    } catch (e) { /* hors ligne */ }\n  }\n  setInterval(pollFeed, 60 * 1000);\n  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollFeed(); });\n\n  /* ---------------- compteur de visites ---------------- */\n  function trackVisit() {\n    try {\n      // Pas de comptage pour l'aperçu du panel admin (iframe sur le même site)\n      if (window.top !== window) { try { if (window.parent.location.origin === location.origin) return; } catch (e) { /* iframe Telegram Web : on compte */ } }\n      let vid = store.get('vid', '');\n      if (!vid) { vid = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join(''); store.set('vid', vid); }\n      // Une ouverture comptée au plus toutes les 30 min par appareil\n      const last = store.get('vLast', 0);\n      if (Date.now() - last < 30 * 60 * 1000 && store.get('vDay', '') === new Date().toDateString()) return;\n      store.set('vLast', Date.now()); store.set('vDay', new Date().toDateString());\n      fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,\n        body: JSON.stringify({ vid, initData: (tg && tg.initData) || '', tg: !!(tg && tg.initData) }) }).catch(() => {});\n    } catch (e) { /* */ }\n  }\n\n  function filteredProducts() {\n    const q = norm(S.q.trim());\n    return S.data.products.filter((p) => {\n      if (S.cat && p.categoryId !== S.cat) return false;\n      if (!q) return true;\n      const c = category(p.categoryId);\n      return norm(p.name + ' ' + p.description + ' ' + (c ? c.name : '') + ' ' + p.badge).includes(q);\n    });\n  }\n\n  const cardHtml = (p) => {\n    const o = minOpt(p);\n    return `<article class=\"card glass\" data-act=\"open\" data-id=\"${esc(p.id)}\">\n      <div class=\"img\">${imgOr(p.image, p.name)}${p.badge ? `<span class=\"tag\">${esc(p.badge)}</span>` : ''}${p.video ? '<span class=\"vid-dot\">▶</span>' : ''}</div>\n      <div class=\"body\">\n        <div class=\"name\">${esc(p.name)}</div>\n        <div><span class=\"chip grams\">${g(o.grams)}</span></div>\n        <div class=\"row\">\n          <div>${p.options.length > 1 ? '<span class=\"from\">à partir de</span>' : ''}<span class=\"price\">${eur(o.price)}</span></div>\n          <button class=\"add-mini\" data-act=\"quick-add\" data-id=\"${esc(p.id)}\" aria-label=\"Ajouter\">+</button>\n        </div>\n      </div>\n    </article>`;\n  };\n\n  // Chaque catégorie affiche ses produits juste en dessous\n  function renderProducts() {\n    const el = $('#products');\n    if (!el) return;\n    const list = filteredProducts();\n    $('#prodCount').textContent = `${list.length} article${list.length > 1 ? 's' : ''}`;\n    if (!list.length) {\n      el.innerHTML = `<div class=\"empty glass\"><div class=\"ico\">🔍</div><h3>Aucun résultat</h3><p>Essayez un autre mot-clé.</p></div>`;\n      return;\n    }\n    const groups = S.data.categories.map((c) => ({ c, items: list.filter((p) => p.categoryId === c.id) }));\n    const other = list.filter((p) => !category(p.categoryId));\n    if (other.length) groups.push({ c: { id: 'autres', name: 'Autres produits', image: '' }, items: other });\n    el.innerHTML = groups.filter((gr) => gr.items.length).map(({ c, items }) => `<div class=\"group\" id=\"grp-${esc(c.id)}\">\n      <div class=\"group-head glass\">\n        ${c.image ? `<img src=\"${esc(c.image)}\" alt=\"\">` : '<span class=\"gh-ph\">✦</span>'}\n        <div><h3>${esc(c.name)}</h3><small>${items.length} produit${items.length > 1 ? 's' : ''}</small></div>\n      </div>\n      <div class=\"products\">${items.map(cardHtml).join('')}</div>\n    </div>`).join('');\n  }\n\n  function vCart() {\n    const t = totals();\n    const s = S.data.settings;\n    if (!t.lines.length) {\n      return `<div class=\"view\"><h1 class=\"page-title\">Panier</h1>\n        <div class=\"empty glass\"><div class=\"ico\">🛒</div><h3>Votre panier est vide</h3><p>Découvrez nos produits et ajoutez vos favoris.</p>\n        <button class=\"btn\" data-act=\"nav\" data-view=\"home\">Voir la boutique</button></div></div>`;\n    }\n    const c = store.get('customer', {});\n    const tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;\n    const name = c.name || (tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') : '');\n    const missing = s.freeDeliveryFrom > 0 && t.delivery > 0 ? s.freeDeliveryFrom - t.subtotal : 0;\n    return `<div class=\"view\"><h1 class=\"page-title\">Panier</h1>\n      ${t.lines.map((l) => `<div class=\"line glass\">\n        ${imgOr(l.p.image, l.p.name)}\n        <div class=\"info\">\n          <div class=\"name\">${esc(l.p.name)}</div>\n          <div class=\"sub\"><span class=\"chip grams\">${g(l.grams)}</span><span class=\"muted\">× ${eur(l.price)}</span></div>\n          <button class=\"del\" data-act=\"cart-del\" data-id=\"${esc(l.pid)}\" data-g=\"${l.grams}\" style=\"align-self:flex-start\">Retirer</button>\n        </div>\n        <div class=\"right\">\n          <span class=\"price\">${eur(l.total)}</span>\n          <div class=\"stepper\"><button data-act=\"cart-qty\" data-d=\"-1\" data-id=\"${esc(l.pid)}\" data-g=\"${l.grams}\">−</button><span>${l.qty}</span><button data-act=\"cart-qty\" data-d=\"1\" data-id=\"${esc(l.pid)}\" data-g=\"${l.grams}\">+</button></div>\n        </div>\n      </div>`).join('')}\n      <div class=\"summary glass\">\n        <div class=\"r\"><span>Poids total</span><span class=\"grams\">${g(t.grams)}</span></div>\n        <div class=\"r\"><span>Sous-total</span><span class=\"price\">${eur(t.subtotal)}</span></div>\n        <div class=\"r\"><span>Livraison</span>${t.delivery ? `<span class=\"price\">${eur(t.delivery)}</span>` : '<span class=\"price\">Offerte</span>'}</div>\n        ${missing > 0 ? `<div class=\"r muted\" style=\"font-size:13px\"><span>Plus que ${eur(missing)} pour la livraison offerte</span></div>` : ''}\n        <div class=\"r total\"><span>Total</span><span class=\"price big\">${eur(t.total)}</span></div>\n      </div>\n      <form class=\"form glass\" id=\"checkout\" novalidate>\n        <p class=\"lbl\">Vos coordonnées</p>\n        <div class=\"field\"><label for=\"f-name\">Nom complet *</label><input class=\"input\" id=\"f-name\" name=\"name\" required maxlength=\"80\" value=\"${esc(name)}\" autocomplete=\"name\"></div>\n        <div class=\"field\"><label for=\"f-phone\">Téléphone *</label><input class=\"input\" id=\"f-phone\" name=\"phone\" type=\"tel\" required maxlength=\"30\" value=\"${esc(c.phone || '')}\" autocomplete=\"tel\" placeholder=\"+33 6 12 34 56 78\"></div>\n        <div class=\"field\"><label for=\"f-address\">Adresse de livraison</label><textarea class=\"input\" id=\"f-address\" name=\"address\" maxlength=\"300\" autocomplete=\"street-address\" placeholder=\"N°, rue, code postal, ville\">${esc(c.address || '')}</textarea></div>\n        <div class=\"field\"><label for=\"f-note\">Note (facultatif)</label><input class=\"input\" id=\"f-note\" name=\"note\" maxlength=\"500\" placeholder=\"Créneau, instructions…\"></div>\n        ${channelPicker()}\n        <label class=\"optin\"><input type=\"checkbox\" name=\"optIn\" ${c.optIn ? 'checked' : ''}> J'accepte de recevoir les promotions et nouveautés de la boutique</label>\n        ${s.cartNote ? `<div class=\"note\">${esc(s.cartNote)}</div>` : ''}\n        ${orderBtnHtml(t.total)}\n      </form>\n    </div>`;\n  }\n\n  const waIcon = '<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"currentColor\"><path d=\"M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z\"/></svg>';\n\n  const sgIcon = '<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z\"/><circle cx=\"8\" cy=\"12\" r=\".6\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\".6\" fill=\"currentColor\"/><circle cx=\"16\" cy=\"12\" r=\".6\" fill=\"currentColor\"/></svg>';\n  const CH = { whatsapp: ['WhatsApp', 'wa', () => waIcon], signal: ['Signal', 'sg', () => sgIcon] };\n\n  // Canaux proposés par la boutique (configurés dans le panel admin)\n  function channelsAvail() {\n    const c = S.data.channels || { whatsapp: true };\n    return Object.keys(CH).filter((k) => c[k]);\n  }\n  function curChannel() {\n    const av = channelsAvail();\n    return av.includes(S.channel) ? S.channel : av[0] || '';\n  }\n  function channelPicker() {\n    const av = channelsAvail();\n    if (av.length < 2) return '';\n    const cur = curChannel();\n    return `<p class=\"lbl\">Recevoir ma commande via</p>\n      <div class=\"channels\" role=\"radiogroup\">${av.map((k) => `<button type=\"button\" role=\"radio\" aria-checked=\"${k === cur}\" class=\"channel ${CH[k][1]} ${k === cur ? 'sel' : ''}\" data-act=\"channel\" data-ch=\"${k}\">\n        ${CH[k][2]()}${CH[k][0]}<small>${k === 'signal' ? 'Chiffré, récap copié' : 'Message pré-rempli'}</small></button>`).join('')}</div>`;\n  }\n  function orderBtnHtml(total) {\n    const ch = curChannel();\n    const [name, cls, ico] = CH[ch] || CH.whatsapp;\n    return `<button class=\"btn ${cls}\" type=\"submit\" id=\"orderBtn\">${ico()} Commander via ${ch ? name : 'la boutique'} · ${eur(total)}</button>`;\n  }\n\n  async function copyText(t) {\n    try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* repli */ }\n    try {\n      const ta = document.createElement('textarea');\n      ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';\n      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;\n    } catch (e) { return false; }\n  }\n\n  function vSuccess() {\n    const o = S.order;\n    if (o.channel === 'signal') {\n      return `<div class=\"view\"><div class=\"success glass\">\n        <div class=\"check\">✓</div>\n        <h2>Commande enregistrée !</h2>\n        <p>Référence <span class=\"oid\">#${esc(o.orderId)}</span> · Total <span class=\"price\">${eur(o.total)}</span></p>\n        <ol class=\"steps\"><li>Appuyez sur le bouton : le récapitulatif est <b>copié</b> et Signal s'ouvre.</li><li>Dans la conversation, faites <b>Coller</b> puis <b>Envoyer</b>.</li></ol>\n        <div class=\"stack\">\n          ${o.signalLink ? `<button class=\"btn sg\" data-act=\"open-signal\">${sgIcon} Copier & ouvrir Signal</button>` : ''}\n          <button class=\"btn ghost\" data-act=\"copy-order\">📋 Copier le récapitulatif</button>\n          <button class=\"btn ghost\" data-act=\"nav\" data-view=\"home\">Retour à la boutique</button>\n        </div>\n      </div></div>`;\n    }\n    return vSuccessWa();\n  }\n\n  function vSuccessWa() {\n    const o = S.order;\n    const auto = o.whatsappSent;\n    return `<div class=\"view\"><div class=\"success glass\">\n      <div class=\"check\">✓</div>\n      <h2>Commande ${auto ? 'envoyée' : 'enregistrée'} !</h2>\n      <p>Référence <span class=\"oid\">#${esc(o.orderId)}</span> · Total <span class=\"price\">${eur(o.total)}</span></p>\n      <p>${auto\n        ? 'Vos détails de commande ont été transmis automatiquement sur WhatsApp. Nous vous recontactons très vite pour finaliser.'\n        : 'Dernière étape : envoyez le récapitulatif sur WhatsApp pour finaliser le paiement et la livraison.'}</p>\n      <div class=\"stack\">\n        ${o.waLink ? `<button class=\"btn wa\" data-act=\"open-wa\">${waIcon} ${auto ? 'Discuter sur WhatsApp' : 'Envoyer sur WhatsApp'}</button>` : ''}\n        <button class=\"btn ghost\" data-act=\"nav\" data-view=\"home\">Retour à la boutique</button>\n      </div>\n    </div></div>`;\n  }\n\n  const stars = (n) => `<span class=\"stars\">${'★'.repeat(n)}<span class=\"off\">${'★'.repeat(5 - n)}</span></span>`;\n\n  function vReviews() {\n    const r = S.data.reviews;\n    const avg = r.length ? r.reduce((a, x) => a + x.rating, 0) / r.length : 0;\n    const date = (d) => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } };\n    return `<div class=\"view\"><h1 class=\"page-title\">Avis clients</h1>\n      <div class=\"rating-hero glass\">\n        <div class=\"score\">${avg ? avg.toFixed(1).replace('.', ',') : '–'}</div>\n        <div>${stars(Math.round(avg))}<div class=\"muted\" style=\"font-size:13px;margin-top:4px\">${r.length} avis vérifié${r.length > 1 ? 's' : ''}</div></div>\n      </div>\n      ${S.data.settings.reviewsEnabled ? '<button class=\"btn\" data-act=\"review-new\" style=\"margin-bottom:16px\">★ Laisser un avis</button>' : ''}\n      ${r.length ? r.map((x) => `<div class=\"review glass\">\n        <div class=\"top\"><div class=\"avatar\">${esc(x.name.slice(0, 1).toUpperCase())}</div>\n        <div class=\"who\"><b>${esc(x.name)}</b><small>${esc(date(x.date))}</small></div>${stars(x.rating)}</div>\n        <p>${esc(x.text)}</p></div>`).join('') : '<div class=\"empty glass\"><div class=\"ico\">💬</div><h3>Pas encore d\\'avis</h3><p>Soyez le premier à donner votre avis !</p></div>'}\n    </div>`;\n  }\n\n  const SOCIAL = {\n    instagram: ['#ff3fa4', '<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"17.5\" cy=\"6.5\" r=\".6\" fill=\"currentColor\"/>'],\n    tiktok: ['#25f4ee', '<path d=\"M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5\"/><path d=\"M14 3c.5 2.6 2.3 4.3 5 4.5\"/>'],\n    telegram: ['#2aabee', '<path d=\"m21 4-18 7.2 6 2.3L18 7l-7 7.6.3 5.4 3-4 4.2 3z\"/>'],\n    snapchat: ['#fffc00', '<path d=\"M12 3c3 0 5 2.2 5 5v2.4l1.8-.5c.5 0 .8.6.3.9l-2 1.2c.6 1.8 2 3.1 3.6 3.6-.3.8-1.5 1-2.5 1.1l-.4 1.3-1.9-.2c-1.2 0-2 1.2-3.9 1.2s-2.7-1.2-3.9-1.2l-1.9.2-.4-1.3c-1-.1-2.2-.3-2.5-1.1 1.6-.5 3-1.8 3.6-3.6l-2-1.2c-.5-.3-.2-.9.3-.9l1.8.5V8c0-2.8 2-5 5-5z\"/>'],\n    whatsapp: ['#25d366', '<path d=\"M4 20l1.3-4A8 8 0 1 1 8 18.7z\"/><path d=\"M9 9.5c.3 2 2.5 4.3 5 5l1-1.3-1.8-.9-.8.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.8-.9-1.8z\"/>'],\n    facebook: ['#3b8bff', '<path d=\"M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z\"/>'],\n    x: ['#e8ecff', '<path d=\"M4 4l16 16M20 4 4 20\"/>'],\n    youtube: ['#ff2d55', '<rect x=\"2.5\" y=\"5.5\" width=\"19\" height=\"13\" rx=\"4\"/><path d=\"m10 9 5 3-5 3z\" fill=\"currentColor\"/>'],\n    signal: ['#4d8dff', '<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M5 19l-1.5 2 3-.7\"/>'],\n    website: ['var(--accent)', '<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z\"/>'],\n  };\n\n  function vSocials() {\n    const list = S.data.socials;\n    return `<div class=\"view\"><h1 class=\"page-title\">Nos réseaux</h1>\n      <p class=\"muted\" style=\"margin:-8px 2px 16px\">Suivez-nous pour les nouveautés, promos et arrivages.</p>\n      ${list.length ? `<div class=\"socials\">${list.map((s) => {\n        const [c, ic] = SOCIAL[s.type] || SOCIAL.website;\n        return `<a class=\"social glass\" style=\"--c:${c}\" href=\"${esc(s.url)}\" data-act=\"link\" target=\"_blank\" rel=\"noopener\">\n          <span class=\"ic\"><svg viewBox=\"0 0 24 24\">${ic}</svg></span><b>${esc(s.label)}</b>${s.handle ? `<small>${esc(s.handle)}</small>` : ''}</a>`;\n      }).join('')}</div>` : '<div class=\"empty glass\"><div class=\"ico\">🔗</div><h3>Bientôt disponible</h3><p>Nos réseaux arrivent très vite.</p></div>'}\n    </div>`;\n  }\n\n  function render() {\n    if (!S.data) return;\n    const views = { home: vHome, cart: vCart, reviews: vReviews, socials: vSocials, success: vSuccess, news: vNews };\n    app.innerHTML = (views[S.view] || vHome)();\n    if (S.view === 'home') renderProducts();\n    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === (S.view === 'success' ? 'cart' : S.view)));\n    syncBack();\n  }\n\n  function go(view) {\n    if (S.view === view && view === 'home') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }\n    S.view = view;\n    render();\n    window.scrollTo(0, 0);\n  }\n\n  /* ---------------- feuilles ---------------- */\n  function openSheet(html) {\n    $('#sheetPanel').innerHTML = `<div class=\"grab\"></div><button class=\"sheet-close\" data-act=\"close\" aria-label=\"Fermer\">✕</button>${html}`;\n    $('#sheet').hidden = false;\n    $('#sheetPanel').scrollTop = 0;\n    document.body.style.overflow = 'hidden';\n    syncBack();\n  }\n  function closeSheet() {\n    const v = $('#sheetPanel video');\n    if (v) { try { v.pause(); } catch (e) { /* */ } }\n    $('#sheetPanel').innerHTML = '';\n    $('#sheet').hidden = true;\n    S.sheet = null;\n    document.body.style.overflow = '';\n    syncBack();\n  }\n\n  const ytId = (u) => (String(u).match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/)|youtu\\.be\\/)([\\w-]{6,})/) || [])[1];\n  const vimeoId = (u) => (String(u).match(/vimeo\\.com\\/(?:video\\/)?(\\d+)/) || [])[1];\n\n  function mediaHtml(p) {\n    const img = p.image ? `<img class=\"pd-img\" src=\"${esc(p.image)}\" alt=\"${esc(p.name)}\">` : '';\n    const v = p.video;\n    if (!v) return img;\n    const frame = (src) => `<div class=\"pd-video\"><iframe src=\"${esc(src)}\" allow=\"accelerometer; autoplay; encrypted-media; picture-in-picture\" allowfullscreen loading=\"lazy\"></iframe></div>`;\n    const player = ytId(v) ? frame(`https://www.youtube.com/embed/${ytId(v)}?rel=0&playsinline=1`)\n      : vimeoId(v) ? frame(`https://player.vimeo.com/video/${vimeoId(v)}`)\n      : `<video class=\"pd-video-file\" src=\"${esc(v)}\" ${p.image ? `poster=\"${esc(p.image)}\"` : ''} controls playsinline preload=\"metadata\"></video>`;\n    // L'image ET la vidéo sont affichées, l'une après l'autre\n    return `${img}<div class=\"pd-media\"><p class=\"lbl\">🎬 Vidéo du produit</p>${player}</div>`;\n  }\n\n  function renderProductSheet() {\n    const { pid, grams, qty } = S.sheet;\n    const p = product(pid);\n    const o = p.options.find((x) => x.grams === grams);\n    const c = category(p.categoryId);\n    openSheet(`${mediaHtml(p)}\n      <div class=\"pd\">\n        ${c ? `<p class=\"lbl\" style=\"color:var(--accent)\">${esc(c.name)}</p>` : ''}\n        <h3>${esc(p.name)}</h3>\n        ${p.description ? `<p class=\"desc\">${esc(p.description)}</p>` : ''}\n        <p class=\"lbl\">Quantité</p>\n        <div class=\"opts\">${p.options.map((x) => `<button class=\"opt ${x.grams === grams ? 'sel' : ''}\" data-act=\"pick\" data-g=\"${x.grams}\">\n          <span class=\"grams\">${g(x.grams)}</span><span class=\"price\">${eur(x.price)}</span></button>`).join('')}</div>\n        <div class=\"pd-foot\">\n          <div class=\"stepper\"><button data-act=\"sheet-qty\" data-d=\"-1\">−</button><span>${qty}</span><button data-act=\"sheet-qty\" data-d=\"1\">+</button></div>\n          <button class=\"btn\" data-act=\"sheet-add\">Ajouter · ${eur(o.price * qty)}</button>\n        </div>\n      </div>`);\n  }\n\n  function renderReviewSheet(rating = 5) {\n    openSheet(`<form class=\"pd\" id=\"reviewForm\" style=\"padding-top:26px\">\n      <h3>Votre avis</h3><p class=\"muted\" style=\"margin:0 0 12px\">Il sera publié après validation.</p>\n      <div class=\"star-pick\" id=\"starPick\">${[1, 2, 3, 4, 5].map((n) => `<button type=\"button\" data-act=\"star\" data-n=\"${n}\" class=\"${n <= rating ? 'on' : ''}\">★</button>`).join('')}</div>\n      <input type=\"hidden\" name=\"rating\" value=\"${rating}\">\n      <div class=\"field\"><label>Prénom</label><input class=\"input\" name=\"name\" required maxlength=\"40\" value=\"${esc((tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name) || '')}\"></div>\n      <div class=\"field\"><label>Votre avis</label><textarea class=\"input\" name=\"text\" required maxlength=\"1000\" placeholder=\"Qualité, livraison, service…\"></textarea></div>\n      <button class=\"btn\" type=\"submit\">Envoyer mon avis</button>\n    </form>`);\n  }\n\n  /* ---------------- Telegram BackButton ---------------- */\n  function syncBack() {\n    if (!tg || !tg.BackButton) return;\n    try { (!$('#sheet').hidden || S.view !== 'home') ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) { /* */ }\n  }\n  if (tg && tg.BackButton) tg.BackButton.onClick(() => { if (!$('#sheet').hidden) closeSheet(); else go('home'); });\n\n  function openLink(url) {\n    try {\n      if (tg && tg.initData) {\n        if (/^https:\\/\\/t\\.me\\//.test(url)) return tg.openTelegramLink(url);\n        return tg.openLink(url);\n      }\n    } catch (e) { /* */ }\n    window.open(url, '_blank', 'noopener');\n  }\n\n  /* ---------------- toast ---------------- */\n  let toastT;\n  function toast(msg, err) {\n    const t = $('#toast');\n    t.textContent = msg;\n    t.classList.toggle('err', !!err);\n    t.classList.add('show');\n    clearTimeout(toastT);\n    toastT = setTimeout(() => t.classList.remove('show'), 2400);\n  }\n\n  /* ---------------- actions ---------------- */\n  const A = {\n    reload: load,\n    nav: (el) => { closeSheet(); go(el.dataset.view); },\n    close: closeSheet,\n    cat: (el) => {\n      haptic();\n      const grp = document.getElementById('grp-' + el.dataset.id);\n      if (!grp) return toast(S.q ? 'Aucun résultat dans cette catégorie' : 'Aucun produit dans cette catégorie pour le moment');\n      grp.scrollIntoView({ behavior: 'smooth', block: 'start' });\n      grp.classList.remove('flash'); void grp.offsetWidth; grp.classList.add('flash');\n    },\n    admin: goAdmin,\n    'logo-tap': () => { // accès discret : 5 appuis rapides sur le logo\n      const now = Date.now();\n      S.taps = (S.taps || []).filter((t) => now - t < 2000).concat(now);\n      if (S.taps.length >= 5) { S.taps = []; goAdmin(); }\n    },\n    'clear-search': (el, e) => { e.preventDefault(); S.q = ''; $('#search').value = ''; el.hidden = true; renderProducts(); },\n    open: (el) => { const p = product(el.dataset.id); S.sheet = { pid: p.id, grams: minOpt(p).grams, qty: 1 }; haptic(); renderProductSheet(); },\n    'quick-add': (el, e) => {\n      e.stopPropagation();\n      const p = product(el.dataset.id);\n      if (p.options.length > 1) return A.open(el);\n      addToCart(p.id, p.options[0].grams, 1);\n    },\n    pick: (el) => { S.sheet.grams = Number(el.dataset.g); haptic('soft'); renderProductSheet(); },\n    'sheet-qty': (el) => { S.sheet.qty = Math.max(1, Math.min(99, S.sheet.qty + Number(el.dataset.d))); haptic('soft'); renderProductSheet(); },\n    'sheet-add': () => { const { pid, grams, qty } = S.sheet; addToCart(pid, grams, qty); closeSheet(); },\n    'cart-qty': (el) => {\n      const it = S.cart.find((x) => x.pid === el.dataset.id && x.grams === Number(el.dataset.g));\n      if (!it) return;\n      it.qty += Number(el.dataset.d);\n      if (it.qty < 1) S.cart.splice(S.cart.indexOf(it), 1);\n      it.qty = Math.min(99, it.qty);\n      saveCart(false); haptic('soft'); keepForm(render);\n    },\n    'cart-del': (el) => { S.cart = S.cart.filter((x) => !(x.pid === el.dataset.id && x.grams === Number(el.dataset.g))); saveCart(false); haptic(); keepForm(render); },\n    'open-wa': () => openLink(S.order.waLink),\n    'open-signal': async () => {\n      const ok = await copyText(S.order.message);\n      toast(ok ? '📋 Récapitulatif copié — collez-le dans Signal' : 'Copiez le récapitulatif puis collez-le dans Signal', !ok);\n      setTimeout(() => openLink(S.order.signalLink), ok ? 700 : 1500);\n    },\n    'copy-order': async () => { const ok = await copyText(S.order.message); toast(ok ? '📋 Récapitulatif copié' : 'Copie impossible sur cet appareil', !ok); },\n    channel: (el) => {\n      S.channel = el.dataset.ch; store.set('channel', S.channel); haptic('soft');\n      document.querySelectorAll('.channel').forEach((b) => { const on = b === el; b.classList.toggle('sel', on); b.setAttribute('aria-checked', on); });\n      const btn = $('#orderBtn'); if (btn) btn.outerHTML = orderBtnHtml(totals().total);\n    },\n    'notice-x': (el) => {\n      S.hidden = S.hidden.concat(el.dataset.id).slice(-50); store.set('noticesHidden', S.hidden);\n      const n = el.closest('.notice'); if (n) n.remove();\n    },\n    'review-new': () => renderReviewSheet(),\n    star: (el) => { const n = Number(el.dataset.n); document.querySelectorAll('#starPick button').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) <= n)); $('#reviewForm [name=rating]').value = n; haptic('soft'); },\n    link: (el, e) => { e.preventDefault(); openLink(el.href); },\n  };\n\n  // Garde les champs saisis quand le panier est re-rendu\n  function keepForm(fn) {\n    const f = $('#checkout');\n    const vals = f ? Object.fromEntries(new FormData(f)) : null;\n    fn();\n    const nf = $('#checkout');\n    if (vals && nf) {\n      for (const [k, v] of Object.entries(vals)) { const el = nf.elements[k]; if (!el) continue; if (el.type === 'checkbox') el.checked = true; else el.value = v; }\n      if (nf.elements.optIn && !('optIn' in vals)) nf.elements.optIn.checked = false;\n    }\n  }\n\n  document.addEventListener('click', (e) => {\n    const el = e.target.closest('[data-act]');\n    if (!el || el.tagName === 'INPUT') return;\n    const fn = A[el.dataset.act];\n    if (fn) fn(el, e);\n  });\n\n  document.addEventListener('input', (e) => {\n    if (e.target.id !== 'search') return;\n    S.q = e.target.value;\n    const clr = $('[data-act=clear-search]');\n    if (clr) clr.hidden = !S.q;\n    renderProducts();\n  });\n\n  document.addEventListener('keydown', (e) => {\n    if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();\n    if (e.key === 'Enter' && e.target.id === 'search') e.target.blur();\n  });\n\n  document.addEventListener('submit', async (e) => {\n    e.preventDefault();\n    if (e.target.id === 'checkout') return submitOrder(e.target);\n    if (e.target.id === 'reviewForm') return submitReview(e.target);\n  });\n\n  async function submitOrder(form) {\n    if (S.busy) return;\n    const f = Object.fromEntries(new FormData(form));\n    for (const k of ['name', 'phone', 'address', 'note']) f[k] = String(f[k] || '').trim();\n    const optIn = !!form.elements.optIn && form.elements.optIn.checked;\n    delete f.optIn;\n    if (!f.name) { toast('Merci d\\'indiquer votre nom', true); return form.elements.name.focus(); }\n    if (f.phone.replace(/\\D/g, '').length < 6) { toast('Numéro de téléphone invalide', true); return form.elements.phone.focus(); }\n    store.set('customer', { name: f.name, phone: f.phone, address: f.address, optIn });\n    const btn = $('#orderBtn');\n    S.busy = true;\n    btn.disabled = true;\n    btn.textContent = 'Envoi en cours…';\n    try {\n      const r = await fetch('/api/order', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({\n          items: S.cart.map((it) => ({ productId: it.pid, grams: it.grams, qty: it.qty })),\n          customer: f,\n          channel: curChannel(),\n          optIn,\n          initData: (tg && tg.initData) || '',\n        }),\n      });\n      const j = await r.json().catch(() => ({}));\n      if (!r.ok) throw new Error(j.error || 'Erreur lors de la commande');\n      S.order = j;\n      S.cart = [];\n      saveCart(false);\n      try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success'); } catch (er) { /* */ }\n      go('success');\n      if (j.channel === 'whatsapp' && !j.whatsappSent && j.waLink) setTimeout(() => openLink(j.waLink), 600);\n      if (j.channel === 'signal' && j.message) copyText(j.message); // copie anticipée (le bouton recopie si besoin)\n    } catch (err) {\n      toast(err.message, true);\n      try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('error'); } catch (er) { /* */ }\n      btn.disabled = false;\n      btn.outerHTML = orderBtnHtml(totals().total);\n    } finally {\n      S.busy = false;\n    }\n  }\n\n  async function submitReview(form) {\n    const f = Object.fromEntries(new FormData(form));\n    if (!String(f.name).trim() || !String(f.text).trim()) return toast('Merci de remplir tous les champs', true);\n    const btn = form.querySelector('button[type=submit]');\n    btn.disabled = true;\n    try {\n      const r = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });\n      const j = await r.json().catch(() => ({}));\n      if (!r.ok) throw new Error(j.error || 'Erreur');\n      closeSheet();\n      toast('Merci ! Votre avis sera publié après validation ✨');\n    } catch (err) { toast(err.message, true); btn.disabled = false; }\n  }\n\n  // Aperçu en direct depuis le panel admin (iframe même origine)\n  window.addEventListener('message', (e) => {\n    if (e.origin !== location.origin || !e.data || e.data.type !== 'preview' || !S.data) return;\n    S.data.settings = { ...S.data.settings, ...e.data.settings, theme: { ...S.data.settings.theme, ...(e.data.settings.theme || {}) } };\n    applyTheme(S.data.settings);\n    if (e.data.reload) return load();\n    render();\n  });\n\n  function goAdmin() {\n    try { if (tg && tg.initData) sessionStorage.setItem('tg_init', tg.initData); } catch (e) { /* */ }\n    location.href = '/admin';\n  }\n\n  // Reconnaît l'admin quand la mini-app est ouverte depuis son compte Telegram\n  async function checkAdmin() {\n    if (!tg || !tg.initData) return;\n    try {\n      const r = await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });\n      const j = await r.json();\n      if (j.isAdmin) { S.isAdmin = true; if (S.view === 'home') render(); }\n    } catch (e) { /* */ }\n  }\n\n  saveCart(false);\n  load().then(checkAdmin);\n  trackVisit();\n})();\n","/index.html":"<!doctype html>\n<html lang=\"fr\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover\">\n  <meta name=\"theme-color\" content=\"#05060f\">\n  <title>Boutique</title>\n  <script src=\"https://telegram.org/js/telegram-web-app.js\"></script>\n  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@500;700;900&display=swap\" rel=\"stylesheet\">\n  <link rel=\"stylesheet\" href=\"/app.css\">\n</head>\n<body>\n  <div class=\"bg\" id=\"bg\" aria-hidden=\"true\">\n    <div class=\"orb o1\"></div><div class=\"orb o2\"></div><div class=\"orb o3\"></div>\n    <div class=\"floor\"></div>\n  </div>\n  <div class=\"bg-image\" id=\"bgImage\" aria-hidden=\"true\"></div>\n\n  <main id=\"app\" class=\"app\">\n    <div class=\"loader\"><div class=\"ring\"></div><p>Chargement…</p></div>\n  </main>\n\n  <nav class=\"tabbar glass\" id=\"tabbar\">\n    <button data-act=\"nav\" data-view=\"home\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z\"/></svg><span>Accueil</span>\n    </button>\n    <button data-act=\"nav\" data-view=\"news\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"M4 5h13v14H6a2 2 0 0 1-2-2z\"/><path d=\"M17 9h3v8a2 2 0 0 1-2 2h-1\"/><path d=\"M7.5 9h6M7.5 12.5h6M7.5 16h3.5\"/></svg><span>News</span>\n      <b class=\"badge\" id=\"newsBadge\" hidden>0</b>\n    </button>\n    <button data-act=\"nav\" data-view=\"reviews\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z\"/></svg><span>Avis</span>\n    </button>\n    <button data-act=\"nav\" data-view=\"socials\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"m8.6 13.5 6.8 4M15.4 6.5l-6.8 4\"/></svg><span>Réseaux</span>\n    </button>\n    <button data-act=\"nav\" data-view=\"cart\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2\"/><circle cx=\"10\" cy=\"20.5\" r=\"1.3\"/><circle cx=\"17\" cy=\"20.5\" r=\"1.3\"/></svg><span>Panier</span>\n      <b class=\"badge\" id=\"cartBadge\" hidden>0</b>\n    </button>\n  </nav>\n\n  <div class=\"sheet\" id=\"sheet\" hidden>\n    <div class=\"sheet-backdrop\" data-act=\"close\"></div>\n    <div class=\"sheet-panel glass\" id=\"sheetPanel\" role=\"dialog\" aria-modal=\"true\"></div>\n  </div>\n  <div class=\"toast\" id=\"toast\" role=\"status\"></div>\n\n  <script src=\"/app.js\"></script>\n</body>\n</html>\n","/":"<!doctype html>\n<html lang=\"fr\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover\">\n  <meta name=\"theme-color\" content=\"#05060f\">\n  <title>Boutique</title>\n  <script src=\"https://telegram.org/js/telegram-web-app.js\"></script>\n  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@500;700;900&display=swap\" rel=\"stylesheet\">\n  <link rel=\"stylesheet\" href=\"/app.css\">\n</head>\n<body>\n  <div class=\"bg\" id=\"bg\" aria-hidden=\"true\">\n    <div class=\"orb o1\"></div><div class=\"orb o2\"></div><div class=\"orb o3\"></div>\n    <div class=\"floor\"></div>\n  </div>\n  <div class=\"bg-image\" id=\"bgImage\" aria-hidden=\"true\"></div>\n\n  <main id=\"app\" class=\"app\">\n    <div class=\"loader\"><div class=\"ring\"></div><p>Chargement…</p></div>\n  </main>\n\n  <nav class=\"tabbar glass\" id=\"tabbar\">\n    <button data-act=\"nav\" data-view=\"home\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z\"/></svg><span>Accueil</span>\n    </button>\n    <button data-act=\"nav\" data-view=\"news\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"M4 5h13v14H6a2 2 0 0 1-2-2z\"/><path d=\"M17 9h3v8a2 2 0 0 1-2 2h-1\"/><path d=\"M7.5 9h6M7.5 12.5h6M7.5 16h3.5\"/></svg><span>News</span>\n      <b class=\"badge\" id=\"newsBadge\" hidden>0</b>\n    </button>\n    <button data-act=\"nav\" data-view=\"reviews\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z\"/></svg><span>Avis</span>\n    </button>\n    <button data-act=\"nav\" data-view=\"socials\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"m8.6 13.5 6.8 4M15.4 6.5l-6.8 4\"/></svg><span>Réseaux</span>\n    </button>\n    <button data-act=\"nav\" data-view=\"cart\" class=\"tab\">\n      <svg viewBox=\"0 0 24 24\"><path d=\"M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2\"/><circle cx=\"10\" cy=\"20.5\" r=\"1.3\"/><circle cx=\"17\" cy=\"20.5\" r=\"1.3\"/></svg><span>Panier</span>\n      <b class=\"badge\" id=\"cartBadge\" hidden>0</b>\n    </button>\n  </nav>\n\n  <div class=\"sheet\" id=\"sheet\" hidden>\n    <div class=\"sheet-backdrop\" data-act=\"close\"></div>\n    <div class=\"sheet-panel glass\" id=\"sheetPanel\" role=\"dialog\" aria-modal=\"true\"></div>\n  </div>\n  <div class=\"toast\" id=\"toast\" role=\"status\"></div>\n\n  <script src=\"/app.js\"></script>\n</body>\n</html>\n","/admin":"<!doctype html>\n<html lang=\"fr\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <meta name=\"robots\" content=\"noindex\">\n  <title>Panel admin</title>\n  <script src=\"https://telegram.org/js/telegram-web-app.js\"></script>\n  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@700;900&display=swap\" rel=\"stylesheet\">\n  <link rel=\"stylesheet\" href=\"/admin.css\">\n</head>\n<body>\n  <div id=\"root\"></div>\n  <div class=\"modal\" id=\"modal\" hidden><div class=\"modal-bg\" data-act=\"modal-close\"></div><div class=\"modal-box\" id=\"modalBox\"></div></div>\n  <div class=\"toast\" id=\"toast\"></div>\n  <script src=\"/admin.js\"></script>\n</body>\n</html>\n","/admin/":"<!doctype html>\n<html lang=\"fr\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <meta name=\"robots\" content=\"noindex\">\n  <title>Panel admin</title>\n  <script src=\"https://telegram.org/js/telegram-web-app.js\"></script>\n  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@700;900&display=swap\" rel=\"stylesheet\">\n  <link rel=\"stylesheet\" href=\"/admin.css\">\n</head>\n<body>\n  <div id=\"root\"></div>\n  <div class=\"modal\" id=\"modal\" hidden><div class=\"modal-bg\" data-act=\"modal-close\"></div><div class=\"modal-box\" id=\"modalBox\"></div></div>\n  <div class=\"toast\" id=\"toast\"></div>\n  <script src=\"/admin.js\"></script>\n</body>\n</html>\n"};
let EMBEDDED_DB = {"settings":{"shopName":"SAM COFFEE SHOP","tagline":"Boutique premium • Livraison rapide","logo":"","whatsapp":"","deliveryFee":4.9,"freeDeliveryFrom":60,"minOrder":0,"cartNote":"Après validation, votre commande est transmise sur WhatsApp pour finaliser le paiement et la livraison.","reviewsEnabled":true,"adminTelegramIds":[],"theme":{"preset":"cyber","accent":"#00f0ff","accent2":"#b44cff","gramColor":"#00f0ff","priceColor":"#39ff88","bgColor":"#05060f","bgImage":"","overlay":0.55,"blur":14,"panelOpacity":0.45,"glow":1,"animatedBg":true}},"categories":[{"id":"c-the","name":"Thés","image":"/uploads/demo-the.svg"},{"id":"c-cafe","name":"Cafés","image":"/uploads/demo-cafe.svg"},{"id":"c-epices","name":"Épices","image":"/uploads/demo-epices.svg"}],"products":[{"id":"p-matcha","name":"Matcha Cérémonial","categoryId":"c-the","description":"Matcha japonais grade cérémonial, broyé à la meule de pierre. Notes végétales intenses et douceur umami.","image":"/uploads/demo-p-matcha.svg","video":"","options":[{"grams":30,"price":18},{"grams":100,"price":49}],"badge":"TOP","active":true},{"id":"p-sencha","name":"Sencha Premium","categoryId":"c-the","description":"Thé vert japonais aux notes fraîches et iodées. Parfait infusé à 70 °C pendant 1 minute.","image":"/uploads/demo-p-sencha.svg","video":"","options":[{"grams":50,"price":9.9},{"grams":100,"price":17.9},{"grams":250,"price":39}],"badge":"","active":true},{"id":"p-ethiopie","name":"Éthiopie Yirgacheffe","categoryId":"c-cafe","description":"Café de spécialité torréfié artisanalement. Arômes floraux, agrumes et bergamote.","image":"/uploads/demo-p-ethiopie.svg","video":"","options":[{"grams":250,"price":14.5},{"grams":500,"price":26},{"grams":1000,"price":48}],"badge":"NOUVEAU","active":true},{"id":"p-espresso","name":"Espresso Neon Blend","categoryId":"c-cafe","description":"Assemblage intense pour espresso : chocolat noir, noisette grillée, crema dense.","image":"/uploads/demo-p-espresso.svg","video":"","options":[{"grams":250,"price":12.9},{"grams":1000,"price":44}],"badge":"","active":true},{"id":"p-safran","name":"Safran d'Iran","categoryId":"c-epices","description":"Pistils de safran catégorie I, récolte manuelle. Pouvoir colorant et aromatique exceptionnel.","image":"/uploads/demo-p-safran.svg","video":"","options":[{"grams":1,"price":9.9},{"grams":5,"price":42}],"badge":"RARE","active":true},{"id":"p-kampot","name":"Poivre de Kampot","categoryId":"c-epices","description":"Poivre noir IGP du Cambodge, notes chaudes et florales. À moudre au dernier moment.","image":"/uploads/demo-p-kampot.svg","video":"","options":[{"grams":50,"price":8.5},{"grams":100,"price":15}],"badge":"","active":true}],"reviews":[{"id":"r1","name":"Sarah M.","rating":5,"text":"Livraison ultra rapide et produits de très grande qualité. Le matcha est incroyable !","date":"2026-09-02","approved":true},{"id":"r2","name":"Karim B.","rating":5,"text":"Commande simple via WhatsApp, réponse en quelques minutes. Je recommande à 100 %.","date":"2026-08-27","approved":true},{"id":"r3","name":"Julie D.","rating":4,"text":"Très bon café, bien emballé. Petit délai de livraison mais service au top.","date":"2026-08-15","approved":true},{"id":"r4","name":"Lucas P.","rating":5,"text":"Le safran est d'une qualité rare. Boutique sérieuse, je repasserai commande.","date":"2026-07-30","approved":true}],"socials":[{"id":"s1","type":"instagram","label":"Instagram","handle":"@neonleaf","url":"https://instagram.com/"},{"id":"s2","type":"tiktok","label":"TikTok","handle":"@neonleaf","url":"https://tiktok.com/"},{"id":"s3","type":"telegram","label":"Canal Telegram","handle":"@neonleaf","url":"https://t.me/"},{"id":"s4","type":"snapchat","label":"Snapchat","handle":"neonleaf","url":"https://snapchat.com/"}],"orders":[],"auth":{"phone":"+212777300420","passwordHash":"scrypt$f930b4b5786785cf60443194fa5a9ac7$1ca1df76638062c54250c76e8694c0d33b03d38b8d8d292bff4250e442e363a9"}};

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------------------------------------------------------------ utils */

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const uid = (n = 6) => crypto.randomBytes(n).toString('hex');
const round2 = (n) => Math.round(n * 100) / 100;
const digits = (s) => String(s || '').replace(/\D/g, '');
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const bool = (v) => v === true || v === 'true' || v === 1 || v === 'on';
const num = (v, min = 0, max = 1e7) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const color = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : d);
// URLs d'images autorisées : fichiers locaux ou https, sans caractères pouvant casser le CSS/HTML
const imgUrl = (v) => {
  v = str(v, 1000);
  if (!v || /["'()<>\s\\]/.test(v)) return '';
  return v.startsWith('/uploads/') || v.startsWith('/img/') || v.startsWith('https://') ? v : '';
};
const videoUrl = (v) => {
  v = str(v, 1000);
  if (!v || /["'()<>\s\\]/.test(v)) return '';
  return v.startsWith('/uploads/') || v.startsWith('https://') ? v : '';
};
const linkUrl = (v) => {
  v = str(v, 1000);
  return /^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(v) && !/["'<>\s]/.test(v) ? v : '';
};
const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';
const fmtG = (g) => String(g).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' g';
const httpError = (status, message) => Object.assign(new Error(message), { status });

/* ------------------------------------------------- dates (fuseau boutique) */

const TZ = process.env.TZ || 'Europe/Paris';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
/** Jour local AAAA-MM-JJ (fuseau de la boutique, pas UTC) */
function dayKey(d = new Date()) { return dayFmt.format(d); }
function addDays(key, n) { return new Date(Date.parse(key + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
function weekStart(key) { const dow = new Date(key + 'T12:00:00Z').getUTCDay(); return addDays(key, -((dow + 6) % 7)); } // lundi

/* ------------------------------------------------------- fichier clients */

/** Numéro au format international (+33612345678) à partir d'une saisie libre */
function normPhone(raw, cc = '33') {
  const t = String(raw || '').trim();
  let d = digits(t);
  if (!d) return '';
  if (t.startsWith('+')) return '+' + d;
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.startsWith('0') && cc) return '+' + cc + d.slice(1);
  return d.length >= 11 ? '+' + d : d;
}

/** Ajoute / met à jour le client d'une commande dans d.customers (clé = numéro normalisé) */
function upsertCustomer(d, o) {
  const cc = (d.settings && d.settings.countryCode) || '33';
  const key = normPhone(o.customer && o.customer.phone, cc);
  if (!key || digits(key).length < 6) return null;
  const c = d.customers[key] || (d.customers[key] = { phone: key, name: '', firstSeen: o.createdAt, lastSeen: o.createdAt, orders: 0, total: 0, channel: '', telegram: '', optIn: false });
  c.name = o.customer.name || c.name;
  c.raw = o.customer.phone;
  if (o.createdAt < c.firstSeen) c.firstSeen = o.createdAt;
  if (o.createdAt > c.lastSeen) c.lastSeen = o.createdAt;
  c.orders += 1;
  c.total = round2(c.total + (o.status === 'annulée' ? 0 : o.total || 0));
  if (o.channel) c.channel = o.channel;
  if (o.telegram) c.telegram = o.telegram.username ? '@' + o.telegram.username : String(o.telegram.id);
  if (o.optIn) c.optIn = true;
  return c;
}

/* --------------------------------------------------------------- database */

const SOCIAL_TYPES = ['instagram', 'tiktok', 'telegram', 'snapchat', 'whatsapp', 'facebook', 'x', 'youtube', 'signal', 'website'];
const ORDER_STATUSES = ['nouvelle', 'confirmée', 'expédiée', 'livrée', 'annulée'];

function defaultSettings() {
  return {
    shopName: 'NEON LEAF',
    tagline: 'Boutique premium • Livraison rapide',
    logo: '',
    whatsapp: process.env.WHATSAPP_NUMBER || '',
    signal: process.env.SIGNAL_NUMBER || '', // numéro (+33…) ou lien https://signal.me/#eu/…
    orderChannels: { whatsapp: true, signal: true },
    countryCode: '33', // indicatif ajouté aux numéros clients saisis en format local (06…)
    deliveryFee: 4.9,
    freeDeliveryFrom: 60,
    minOrder: 0,
    cartNote: 'Après validation, votre commande est transmise sur WhatsApp ou Signal (au choix) pour finaliser le paiement et la livraison.',
    reviewsEnabled: true,
    adminTelegramIds: [],
    theme: {
      preset: 'cyber',
      accent: '#00f0ff',
      accent2: '#b44cff',
      gramColor: '#00f0ff',
      priceColor: '#39ff88',
      bgColor: '#05060f',
      bgImage: '',
      overlay: 0.55,
      blur: 14,
      panelOpacity: 0.45,
      glow: 1,
      animatedBg: true,
    },
  };
}

function svgArt(emoji, h1, h2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},85%,16%)"/><stop offset="1" stop-color="hsl(${h2},90%,6%)"/></linearGradient>
<radialGradient id="r" cx=".5" cy=".47" r=".5"><stop offset="0" stop-color="hsl(${h1},100%,62%)" stop-opacity=".6"/><stop offset="1" stop-color="hsl(${h1},100%,60%)" stop-opacity="0"/></radialGradient>
<pattern id="p" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="hsl(${h2},100%,72%)" stroke-opacity=".13"/></pattern>
</defs>
<rect width="400" height="300" fill="url(#g)"/><rect width="400" height="300" fill="url(#p)"/>
<circle cx="200" cy="142" r="150" fill="url(#r)"/>
<circle cx="200" cy="142" r="80" fill="none" stroke="hsl(${h1},100%,72%)" stroke-opacity=".55" stroke-width="2"/>
<circle cx="200" cy="142" r="96" fill="none" stroke="hsl(${h2},100%,72%)" stroke-opacity=".25" stroke-width="1" stroke-dasharray="4 8"/>
<text x="200" y="170" font-size="82" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text>
</svg>`;
}

// (Re)crée les images de démonstration manquantes dans public/uploads
function seedImages(d) {
  const arts = { 'demo-the': ['🍵', 155, 200], 'demo-cafe': ['☕', 28, 320], 'demo-epices': ['🌶️', 350, 275],
    'demo-p-matcha': ['🍵', 120, 170], 'demo-p-sencha': ['🌿', 140, 210], 'demo-p-ethiopie': ['☕', 30, 340],
    'demo-p-espresso': ['⚡', 10, 300], 'demo-p-safran': ['🌸', 330, 270], 'demo-p-kampot': ['🌶️', 0, 290] };
  const used = new Set([...d.categories, ...d.products].map((x) => x.image));
  for (const [name, [emoji, h1, h2]] of Object.entries(arts)) {
    const file = path.join(UPLOAD_DIR, name + '.svg');
    if (used.has(`/uploads/${name}.svg`) && !fs.existsSync(file)) fs.writeFileSync(file, svgArt(emoji, h1, h2));
  }
}

function seed() {
  const art = (name, emoji, h1, h2) => {
    const file = `demo-${name}.svg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), svgArt(emoji, h1, h2));
    return `/uploads/${file}`;
  };
  const cats = [
    { id: 'c-the', name: 'Thés', image: art('the', '🍵', 155, 200) },
    { id: 'c-cafe', name: 'Cafés', image: art('cafe', '☕', 28, 320) },
    { id: 'c-epices', name: 'Épices', image: art('epices', '🌶️', 350, 275) },
  ];
  const P = (id, name, categoryId, emoji, h1, h2, description, options, extra = {}) => ({
    id, name, categoryId, description, image: art(id, emoji, h1, h2),
    options: options.map(([grams, price]) => ({ grams, price })),
    badge: '', active: true, ...extra,
  });
  return {
    settings: defaultSettings(),
    categories: cats,
    products: [
      P('p-matcha', 'Matcha Cérémonial', 'c-the', '🍵', 120, 170, 'Matcha japonais grade cérémonial, broyé à la meule de pierre. Notes végétales intenses et douceur umami.', [[30, 18], [100, 49]], { badge: 'TOP' }),
      P('p-sencha', 'Sencha Premium', 'c-the', '🌿', 140, 210, 'Thé vert japonais aux notes fraîches et iodées. Parfait infusé à 70 °C pendant 1 minute.', [[50, 9.9], [100, 17.9], [250, 39]]),
      P('p-ethiopie', 'Éthiopie Yirgacheffe', 'c-cafe', '☕', 30, 340, 'Café de spécialité torréfié artisanalement. Arômes floraux, agrumes et bergamote.', [[250, 14.5], [500, 26], [1000, 48]], { badge: 'NOUVEAU' }),
      P('p-espresso', 'Espresso Neon Blend', 'c-cafe', '⚡', 10, 300, 'Assemblage intense pour espresso : chocolat noir, noisette grillée, crema dense.', [[250, 12.9], [1000, 44]]),
      P('p-safran', "Safran d'Iran", 'c-epices', '🌸', 330, 270, 'Pistils de safran catégorie I, récolte manuelle. Pouvoir colorant et aromatique exceptionnel.', [[1, 9.9], [5, 42]], { badge: 'RARE' }),
      P('p-kampot', 'Poivre de Kampot', 'c-epices', '🌶️', 0, 290, 'Poivre noir IGP du Cambodge, notes chaudes et florales. À moudre au dernier moment.', [[50, 8.5], [100, 15]]),
    ],
    reviews: [
      { id: 'r1', name: 'Sarah M.', rating: 5, text: 'Livraison ultra rapide et produits de très grande qualité. Le matcha est incroyable !', date: '2026-09-02', approved: true },
      { id: 'r2', name: 'Karim B.', rating: 5, text: 'Commande simple via WhatsApp, réponse en quelques minutes. Je recommande à 100 %.', date: '2026-08-27', approved: true },
      { id: 'r3', name: 'Julie D.', rating: 4, text: 'Très bon café, bien emballé. Petit délai de livraison mais service au top.', date: '2026-08-15', approved: true },
      { id: 'r4', name: 'Lucas P.', rating: 5, text: 'Le safran est d\'une qualité rare. Boutique sérieuse, je repasserai commande.', date: '2026-07-30', approved: true },
    ],
    socials: [
      { id: 's1', type: 'instagram', label: 'Instagram', handle: '@neonleaf', url: 'https://instagram.com/' },
      { id: 's2', type: 'tiktok', label: 'TikTok', handle: '@neonleaf', url: 'https://tiktok.com/' },
      { id: 's3', type: 'telegram', label: 'Canal Telegram', handle: '@neonleaf', url: 'https://t.me/' },
      { id: 's4', type: 'snapchat', label: 'Snapchat', handle: 'neonleaf', url: 'https://snapchat.com/' },
    ],
    orders: [],
    auth: { phone: '', passwordHash: '' },
  };
}

function migrate(d) {
  const def = defaultSettings();
  d.settings = { ...def, ...(d.settings || {}), theme: { ...def.theme, ...((d.settings || {}).theme || {}) } };
  d.settings.orderChannels = { ...def.orderChannels, ...(d.settings.orderChannels || {}) };
  for (const k of ['categories', 'products', 'reviews', 'socials', 'orders', 'news', 'notices']) if (!Array.isArray(d[k])) d[k] = [];
  d.auth = { phone: '', passwordHash: '', ...(d.auth || {}) };
  if (!d.visits || typeof d.visits !== 'object' || !d.visits.days) d.visits = { days: {} };
  // Fichier clients : rempli à partir des commandes déjà existantes lors de la première migration
  if (!d.customers || typeof d.customers !== 'object' || Array.isArray(d.customers)) {
    d.customers = {};
    for (const o of [...d.orders].reverse()) upsertCustomer(d, o);
  }
  return d;
}

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try { return migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); }
    catch (e) { console.error('❌ data/db.json illisible :', e.message); process.exit(1); }
  }
  const d = EMBEDDED_DB ? migrate(JSON.parse(JSON.stringify(EMBEDDED_DB))) : seed();
  if (EMBEDDED_DB) seedImages(d);
  writeDb(d);
  console.log('✨ Base de données créée avec des produits de démonstration');
  return d;
}

function writeDb(d = db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

let db = loadDb();

/* ------------------------------------------------------------ normalizers */

function normSettings(input, cur) {
  const i = input || {};
  const t = i.theme || {};
  const ct = cur.theme;
  return {
    shopName: 'shopName' in i ? str(i.shopName, 60) || 'Ma Boutique' : cur.shopName,
    tagline: 'tagline' in i ? str(i.tagline, 140) : cur.tagline,
    logo: 'logo' in i ? imgUrl(i.logo) : cur.logo,
    whatsapp: 'whatsapp' in i ? str(i.whatsapp, 30) : cur.whatsapp,
    signal: 'signal' in i ? (/^https:\/\/signal\.me\//i.test(str(i.signal, 300)) ? linkUrl(i.signal) : str(i.signal, 30)) : cur.signal,
    orderChannels: 'orderChannels' in i
      ? { whatsapp: bool((i.orderChannels || {}).whatsapp), signal: bool((i.orderChannels || {}).signal) }
      : cur.orderChannels,
    countryCode: 'countryCode' in i ? digits(i.countryCode).slice(0, 4) : cur.countryCode,
    deliveryFee: 'deliveryFee' in i ? round2(num(i.deliveryFee, 0, 1000)) : cur.deliveryFee,
    freeDeliveryFrom: 'freeDeliveryFrom' in i ? round2(num(i.freeDeliveryFrom, 0, 100000)) : cur.freeDeliveryFrom,
    minOrder: 'minOrder' in i ? round2(num(i.minOrder, 0, 100000)) : cur.minOrder,
    cartNote: 'cartNote' in i ? str(i.cartNote, 400) : cur.cartNote,
    reviewsEnabled: 'reviewsEnabled' in i ? bool(i.reviewsEnabled) : cur.reviewsEnabled,
    adminTelegramIds: 'adminTelegramIds' in i
      ? [...new Set((Array.isArray(i.adminTelegramIds) ? i.adminTelegramIds.join(',') : String(i.adminTelegramIds || '')).split(/[\s,;]+/).filter((x) => /^\d{3,20}$/.test(x)))].slice(0, 20)
      : cur.adminTelegramIds || [],
    theme: {
      preset: 'preset' in t ? str(t.preset, 20) : ct.preset,
      accent: color(t.accent, ct.accent),
      accent2: color(t.accent2, ct.accent2),
      gramColor: color(t.gramColor, ct.gramColor),
      priceColor: color(t.priceColor, ct.priceColor),
      bgColor: color(t.bgColor, ct.bgColor),
      bgImage: 'bgImage' in t ? imgUrl(t.bgImage) : ct.bgImage,
      overlay: 'overlay' in t ? num(t.overlay, 0, 0.95) : ct.overlay,
      blur: 'blur' in t ? Math.round(num(t.blur, 0, 40)) : ct.blur,
      panelOpacity: 'panelOpacity' in t ? num(t.panelOpacity, 0, 1) : ct.panelOpacity,
      glow: 'glow' in t ? num(t.glow, 0, 2) : ct.glow,
      animatedBg: 'animatedBg' in t ? bool(t.animatedBg) : ct.animatedBg,
    },
  };
}

const normCategory = (c) => ({ id: str(c.id, 40) || 'c-' + uid(4), name: str(c.name, 40) || 'Catégorie', image: imgUrl(c.image) });

function normProduct(p) {
  const seen = new Set();
  const options = (Array.isArray(p.options) ? p.options : [])
    .map((o) => ({ grams: Math.round(num(o.grams, 0, 1000000)), price: round2(num(o.price, 0, 1000000)) }))
    .filter((o) => o.grams > 0 && !seen.has(o.grams) && seen.add(o.grams))
    .sort((a, b) => a.grams - b.grams)
    .slice(0, 20);
  return {
    id: str(p.id, 40) || 'p-' + uid(4),
    name: str(p.name, 80) || 'Produit',
    categoryId: str(p.categoryId, 40),
    description: str(p.description, 2000),
    image: imgUrl(p.image),
    video: videoUrl(p.video),
    options,
    badge: str(p.badge, 16),
    active: p.active === undefined ? true : bool(p.active),
  };
}

const normReview = (r) => ({
  id: str(r.id, 40) || 'r-' + uid(4),
  name: str(r.name, 40) || 'Client',
  rating: Math.round(num(r.rating, 1, 5)),
  text: str(r.text, 1000),
  date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : new Date().toISOString().slice(0, 10),
  approved: bool(r.approved),
});

const normSocial = (s) => ({
  id: str(s.id, 40) || 's-' + uid(4),
  type: SOCIAL_TYPES.includes(s.type) ? s.type : 'website',
  label: str(s.label, 40) || 'Lien',
  handle: str(s.handle, 60),
  url: linkUrl(s.url),
});

const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const NEWS_TAGS = ['news', 'promo', 'update'];
const normNews = (n) => ({
  id: str(n.id, 40) || 'n-' + uid(4),
  title: str(n.title, 100) || 'Actualité',
  body: str(n.body, 3000),
  image: imgUrl(n.image),
  link: linkUrl(n.link),
  tag: NEWS_TAGS.includes(n.tag) ? n.tag : 'news',
  date: isDay(n.date) ? n.date : dayKey(),
  pinned: bool(n.pinned),
  published: n.published === undefined ? true : bool(n.published),
});
const NOTICE_TYPES = ['info', 'promo', 'alert'];
const normNotice = (n) => ({
  id: str(n.id, 40) || 'a-' + uid(4),
  text: str(n.text, 240),
  type: NOTICE_TYPES.includes(n.type) ? n.type : 'info',
  link: linkUrl(n.link),
  active: n.active === undefined ? true : bool(n.active),
  popup: bool(n.popup),
  until: isDay(n.until) ? n.until : '',
});

const list = (v, fn, max) => (Array.isArray(v) ? v.slice(0, max).map((x) => fn(x || {})) : null);

/* -------------------------------------------------------------- telegram */

async function tgApi(method, body) {
  if (!CFG.botToken) throw new Error('BOT_TOKEN manquant');
  const r = await fetch(`https://api.telegram.org/bot${CFG.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(method === 'getUpdates' ? 40000 : 15000),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || 'Erreur Telegram');
  return j.result;
}

/** Vérifie la signature initData envoyée par Telegram.WebApp — renvoie l'utilisateur ou null */
function verifyInitData(initData) {
  if (!initData || !CFG.botToken) return null;
  try {
    const params = new URLSearchParams(String(initData));
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheck = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(CFG.botToken).digest();
    const calc = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
    if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
    if (Date.now() / 1000 - Number(params.get('auth_date')) > 86400) return null;
    return JSON.parse(params.get('user') || 'null');
  } catch { return null; }
}

let botInfo = null;
async function startBot() {
  if (!CFG.botToken) { console.log('ℹ️  BOT_TOKEN non défini : bot Telegram désactivé (la mini-app fonctionne quand même)'); return; }
  try {
    botInfo = await tgApi('getMe');
    await tgApi('deleteWebhook', { drop_pending_updates: false });
    await tgApi('setMyCommands', { commands: [
      { command: 'start', description: 'Ouvrir la boutique' },
      { command: 'id', description: 'Afficher mon ID Telegram' },
      { command: 'admin', description: 'Accès administrateur' },
    ] });
    if (CFG.webappUrl.startsWith('https://')) {
      await tgApi('setChatMenuButton', { menu_button: { type: 'web_app', text: '🛍️ Boutique', web_app: { url: CFG.webappUrl + '/' } } });
    } else {
      console.log('⚠️  WEBAPP_URL doit être une URL https:// pour ouvrir la mini-app depuis Telegram');
    }
    console.log(`🤖 Bot Telegram connecté : @${botInfo.username}`);
  } catch (e) {
    console.error('❌ Bot Telegram :', e.message);
    return;
  }
  let offset = 0;
  for (;;) {
    try {
      const updates = await tgApi('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        handleUpdate(u).catch((e) => console.error('Bot :', e.message));
      }
    } catch (e) {
      if (!/aborted|timeout/i.test(e.message)) console.error('Bot polling :', e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function handleUpdate(u) {
  const m = u.message;
  if (!m || typeof m.text !== 'string') return;
  const chatId = m.chat.id;
  const cmd = m.text.trim().split(/[\s@]/)[0].toLowerCase();
  const ok = CFG.webappUrl.startsWith('https://');
  const admin = isTgAdmin(m.from);
  if (cmd === '/id') return tgApi('sendMessage', { chat_id: chatId, text: `🆔 Votre ID Telegram : ${m.from.id}\n\n• Pour l'accès admin : ajoutez-le dans Admin → Général → « Accès admin Telegram » (ou ADMIN_TELEGRAM_IDS).\n• Pour recevoir les commandes ici : mettez ${chatId} dans TELEGRAM_ADMIN_CHAT_ID.` });
  if (cmd === '/admin') {
    if (!admin) return tgApi('sendMessage', { chat_id: chatId, text: '⛔ Accès réservé à l\'administrateur.' });
    return tgApi('sendMessage', {
      chat_id: chatId,
      text: ok ? '⚙️ Panel administrateur — connexion automatique, sans mot de passe.' : '⚙️ WEBAPP_URL (https) doit être configuré pour ouvrir le panel ici.',
      reply_markup: ok ? { inline_keyboard: [[{ text: '⚙️ Ouvrir le panel admin', web_app: { url: CFG.webappUrl + '/admin' } }]] } : undefined,
    });
  }
  const s = db.settings;
  const kb = [[{ text: '🛍️ Ouvrir la boutique', web_app: { url: CFG.webappUrl + '/' } }]];
  if (admin) kb.push([{ text: '⚙️ Panel admin', web_app: { url: CFG.webappUrl + '/admin' } }]);
  return tgApi('sendMessage', {
    chat_id: chatId,
    text: `✨ Bienvenue chez ${s.shopName} !\n${s.tagline}\n\n${ok ? '👇 Appuyez sur le bouton pour ouvrir la boutique.' : '⚙️ La boutique n\'est pas encore configurée (WEBAPP_URL).'}`,
    reply_markup: ok ? { inline_keyboard: kb } : undefined,
  });
}

async function notifyTelegram(text) {
  if (!CFG.botToken || !CFG.adminChatId) return { ok: false, error: 'non configuré' };
  await tgApi('sendMessage', { chat_id: CFG.adminChatId, text: text.replace(/\*/g, '') });
  return { ok: true };
}

/* -------------------------------------------------------------- whatsapp */

async function sendWhatsApp(text) {
  const to = digits(db.settings.whatsapp);
  const p = CFG.wa.provider;
  if (!to) return { ok: false, error: 'Numéro WhatsApp non configuré (Admin → Général)' };
  if (p === 'callmebot') {
    if (!CFG.wa.callmebotKey) return { ok: false, error: 'CALLMEBOT_APIKEY manquant' };
    const url = `https://api.callmebot.com/whatsapp.php?phone=${to}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(CFG.wa.callmebotKey)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await r.text();
    const ok = r.ok && /queued|sent|delivered/i.test(body) && !/error|invalid/i.test(body);
    return ok ? { ok } : { ok, error: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) };
  }
  if (p === 'cloud') {
    if (!CFG.wa.cloudToken || !CFG.wa.cloudPhoneId) return { ok: false, error: 'WHATSAPP_CLOUD_TOKEN / WHATSAPP_CLOUD_PHONE_ID manquants' };
    const r = await fetch(`https://graph.facebook.com/v21.0/${CFG.wa.cloudPhoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CFG.wa.cloudToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000) } }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: j.error?.message || 'Erreur WhatsApp Cloud' };
  }
  return { ok: false, mode: 'link' };
}

/* ---------------------------------------------------------------- signal */

/** Lien Signal de la boutique : https://signal.me/#p/+33… (numéro) ou lien signal.me collé tel quel (pseudo) */
function signalLink() {
  const v = String(db.settings.signal || '').trim();
  if (/^https:\/\/signal\.me\//i.test(v)) return v;
  const d = digits(v).replace(/^00/, '');
  return d.length >= 6 ? `https://signal.me/#p/+${d}` : '';
}
function orderChannels() {
  const oc = db.settings.orderChannels || {};
  return {
    whatsapp: oc.whatsapp !== false && !!digits(db.settings.whatsapp),
    signal: oc.signal !== false && !!signalLink(),
  };
}
const CHANNEL_NAMES = { whatsapp: 'WhatsApp', signal: 'Signal' };

/* ---------------------------------------------------------------- orders */

function orderMessage(o) {
  const d = new Date(o.createdAt).toLocaleString('fr-FR', { timeZone: process.env.TZ || 'Europe/Paris' });
  const L = [
    `🛒 *NOUVELLE COMMANDE #${o.id}*`,
    `🏪 ${db.settings.shopName} — ${d}`,
    '',
    '👤 *Client*',
    `Nom : ${o.customer.name}`,
    `Téléphone : ${o.customer.phone}`,
  ];
  if (o.channel) L.splice(2, 0, `📲 Canal choisi : ${CHANNEL_NAMES[o.channel] || o.channel}`);
  if (o.customer.address) L.push(`Adresse : ${o.customer.address}`);
  if (o.telegram) L.push(`Telegram : ${o.telegram.username ? '@' + o.telegram.username : ''} (ID ${o.telegram.id})`.replace(':  (', ': ('));
  if (o.customer.note) L.push(`Note : ${o.customer.note}`);
  L.push('', '📦 *Articles*');
  for (const it of o.items) L.push(`• ${it.name} — ${fmtG(it.grams)} × ${it.qty} = ${eur(it.lineTotal)}`);
  L.push('', `Sous-total : ${eur(o.subtotal)}`, `Livraison : ${o.delivery ? eur(o.delivery) : 'offerte'}`, `⚖️ Poids total : ${fmtG(o.totalGrams)}`, `💶 *TOTAL : ${eur(o.total)}*`);
  return L.join('\n');
}

async function createOrder(body) {
  const s = db.settings;
  const lines = [];
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 50) : []) {
    const p = db.products.find((x) => x.id === it.productId && x.active);
    const opt = p && p.options.find((o) => o.grams === Number(it.grams));
    if (!opt) continue;
    const qty = Math.min(99, Math.max(1, parseInt(it.qty, 10) || 1));
    lines.push({ productId: p.id, name: p.name, grams: opt.grams, unitPrice: opt.price, qty, lineTotal: round2(opt.price * qty) });
  }
  if (!lines.length) throw httpError(400, 'Panier vide ou produits indisponibles');
  const c = body.customer || {};
  const customer = { name: str(c.name, 80), phone: str(c.phone, 30), address: str(c.address, 300), note: str(c.note, 500) };
  if (!customer.name || digits(customer.phone).length < 6) throw httpError(400, 'Nom et numéro de téléphone obligatoires');
  const user = verifyInitData(body.initData);
  if (CFG.requireTelegram && !user) throw httpError(403, 'Les commandes se passent uniquement depuis Telegram');

  const subtotal = round2(lines.reduce((a, l) => a + l.lineTotal, 0));
  if (s.minOrder > 0 && subtotal < s.minOrder) throw httpError(400, `Minimum de commande : ${eur(s.minOrder)}`);
  const delivery = s.freeDeliveryFrom > 0 && subtotal >= s.freeDeliveryFrom ? 0 : s.deliveryFee;
  // Canal choisi par le client (WhatsApp ou Signal) — repli sur le premier canal disponible
  const avail = orderChannels();
  const channel = avail[body.channel] ? body.channel : avail.whatsapp ? 'whatsapp' : avail.signal ? 'signal' : '';
  customer.phoneIntl = normPhone(customer.phone, s.countryCode);
  const order = {
    id: uid(3).toUpperCase(),
    createdAt: new Date().toISOString(),
    status: 'nouvelle',
    channel,
    optIn: bool(body.optIn),
    customer,
    telegram: user ? { id: user.id, username: user.username || '', name: [user.first_name, user.last_name].filter(Boolean).join(' ') } : null,
    items: lines,
    subtotal,
    delivery,
    total: round2(subtotal + delivery),
    totalGrams: lines.reduce((a, l) => a + l.grams * l.qty, 0),
    delivered: { whatsapp: false, telegram: false },
  };
  db.orders.unshift(order);
  db.orders = db.orders.slice(0, 5000);
  upsertCustomer(db, order); // le numéro est conservé même si la commande est supprimée plus tard
  writeDb();

  const text = orderMessage(order);
  const [wa, tg] = await Promise.all([
    sendWhatsApp(text).catch((e) => ({ ok: false, error: e.message })),
    notifyTelegram(text).catch((e) => ({ ok: false, error: e.message })),
  ]);
  if (!wa.ok && wa.error) console.error(`WhatsApp (commande ${order.id}) :`, wa.error);
  order.delivered = { whatsapp: !!wa.ok, telegram: !!tg.ok };
  writeDb();

  if (user && CFG.botToken) {
    tgApi('sendMessage', { chat_id: user.id, text: `✅ Commande #${order.id} reçue !\nTotal : ${eur(order.total)}\n\nNous vous recontactons très vite sur ${CHANNEL_NAMES[channel] || 'WhatsApp'} pour finaliser.` }).catch(() => {});
  }
  const to = digits(s.whatsapp);
  return {
    ok: true,
    orderId: order.id,
    total: order.total,
    whatsappSent: !!wa.ok && channel === 'whatsapp',
    channel,
    waLink: to && avail.whatsapp ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : '',
    // Signal n'accepte pas de texte pré-rempli : le client colle le récapitulatif (copié automatiquement)
    signalLink: avail.signal ? signalLink() : '',
    message: text.replace(/\*/g, ''),
  };
}

/* ---------------------------------------------------------------- visites */
/*
 * Un visiteur = un identifiant anonyme (aléatoire, stocké sur son téléphone) ou son ID Telegram vérifié,
 * haché (SHA-256 tronqué) : aucune IP ni ID en clair n'est enregistré.
 * Par jour : u = visiteurs uniques, v = ouvertures de l'app, t = visiteurs venus de Telegram, ids = empreintes.
 * Les empreintes sont gardées 62 jours (pour compter les uniques semaine / mois), les totaux pour toujours.
 * Écriture disque groupée toutes les 30 s : aucune lenteur même avec beaucoup de trafic.
 */
const VISIT_KEEP_IDS = 62;
const visitSets = new Map(); // jour -> Set(empreintes), reconstruit à la demande
let visitsDirty = false;

function visitDay(key) {
  const days = db.visits.days;
  if (!days[key]) days[key] = { u: 0, v: 0, t: 0, ids: [] };
  if (!visitSets.has(key)) visitSets.set(key, new Set(days[key].ids || []));
  return days[key];
}

function recordVisit(req, body) {
  const user = verifyInitData(body.initData);
  const vid = String(body.vid || '');
  const raw = user ? 'tg:' + user.id : /^[a-z0-9]{8,40}$/i.test(vid) ? 'v:' + vid : 'ip:' + clientIp(req) + (req.headers['user-agent'] || '');
  const fp = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
  const key = dayKey();
  const d = visitDay(key);
  d.v += 1;
  const set = visitSets.get(key);
  if (!set.has(fp)) {
    set.add(fp);
    d.ids.push(fp);
    d.u += 1;
    if (user || body.tg) d.t += 1;
  }
  visitsDirty = true;
}

function pruneVisits() {
  const limit = addDays(dayKey(), -VISIT_KEEP_IDS);
  for (const [k, d] of Object.entries(db.visits.days)) {
    if (k < limit && d.ids) { delete d.ids; visitSets.delete(k); }
  }
}

function uniqueBetween(from, to) {
  const all = new Set();
  for (let k = from; k <= to; k = addDays(k, 1)) {
    const d = db.visits.days[k];
    if (d && d.ids) for (const id of d.ids) all.add(id);
    else if (d) return null; // empreintes expirées : unique non calculable
  }
  return all.size;
}

function visitStats() {
  const today = dayKey();
  const yest = addDays(today, -1);
  const days = db.visits.days;
  const get = (k) => days[k] || { u: 0, v: 0, t: 0 };
  const sum = (from, to, f) => { let n = 0; for (let k = from; k <= to; k = addDays(k, 1)) n += get(k)[f] || 0; return n; };
  const wk = weekStart(today);
  const mo = today.slice(0, 8) + '01';
  const last30 = [];
  for (let i = 29; i >= 0; i--) { const k = addDays(today, -i); const d = get(k); last30.push({ day: k, u: d.u, v: d.v, t: d.t || 0 }); }
  const block = (from, to) => ({ unique: uniqueBetween(from, to) ?? sum(from, to, 'u'), views: sum(from, to, 'v'), from, to });
  const allKeys = Object.keys(days).sort();
  return {
    today: block(today, today),
    yesterday: block(yest, yest),
    week: block(wk, today),
    month: block(mo, today),
    lastWeek: block(addDays(wk, -7), addDays(wk, -1)),
    total: { views: allKeys.reduce((a, k) => a + days[k].v, 0), since: allKeys[0] || today },
    last30,
    tz: TZ,
  };
}

/* ------------------------------------------------- export des numéros */

const exportTokens = new Map(); // jeton -> { exp, q }

function customersList(q = {}) {
  let rows = Object.values(db.customers);
  if (isDay(q.from)) rows = rows.filter((c) => dayKey(new Date(c.firstSeen)) >= q.from);
  if (isDay(q.to)) rows = rows.filter((c) => dayKey(new Date(c.firstSeen)) <= q.to);
  if (bool(q.optIn)) rows = rows.filter((c) => c.optIn);
  return rows.sort((a, b) => (a.firstSeen < b.firstSeen ? 1 : -1)); // plus récents d'abord
}

function exportCustomers(q) {
  const rows = customersList(q);
  const fmt = ['csv', 'txt', 'vcf'].includes(q.format) ? q.format : 'csv';
  const stamp = dayKey();
  const dt = (iso) => new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
  if (fmt === 'txt') {
    return { name: `numeros-clients-${stamp}.txt`, type: 'text/plain; charset=utf-8', body: rows.map((c) => c.phone).join('\r\n') + '\r\n' };
  }
  if (fmt === 'vcf') {
    const v = (s) => String(s || '').replace(/[\;,]/g, (m) => '\\' + m).replace(/\r?\n/g, ' ');
    const body = rows.map((c) => ['BEGIN:VCARD', 'VERSION:3.0', `FN:${v(c.name || c.phone)}`, `TEL;TYPE=CELL:${c.phone}`,
      `NOTE:${v(`Client ${db.settings.shopName} depuis le ${dt(c.firstSeen)} · ${c.orders} commande(s)`)}`, 'END:VCARD'].join('\r\n')).join('\r\n');
    return { name: `contacts-clients-${stamp}.vcf`, type: 'text/vcard; charset=utf-8', body: body + '\r\n' };
  }
  // CSV « Excel France » : séparateur ; + BOM UTF-8 pour les accents
  const cell = (x) => { const t = String(x ?? ''); return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const head = ['Date de collecte', 'Téléphone', 'Nom', 'Nb commandes', 'Total (€)', 'Dernière commande', 'Canal', 'Telegram', 'Accepte les offres', 'Saisie d\'origine'];
  const lines = rows.map((c) => [dt(c.firstSeen), c.phone, c.name, c.orders, String(c.total.toFixed(2)).replace('.', ','), dt(c.lastSeen),
    CHANNEL_NAMES[c.channel] || '', c.telegram, c.optIn ? 'oui' : 'non', c.raw || ''].map(cell).join(';'));
  return { name: `clients-${stamp}.csv`, type: 'text/csv; charset=utf-8', body: '﻿' + [head.join(';'), ...lines].join('\r\n') + '\r\n' };
}

/* ------------------------------------------------------------------ http */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
};

function send(res, status, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Requête invalide'); }
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  const ext0 = path.extname(rel).toLowerCase();
  if (EMBEDDED_FILES && EMBEDDED_FILES[rel] !== undefined) {
    const body = Buffer.from(EMBEDDED_FILES[rel], 'utf8');
    res.writeHead(200, { 'Content-Type': MIME[ext0] || 'text/plain; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Interdit');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Introuvable');
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': rel.startsWith('/uploads/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };
    if (ext === '.svg') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      let start = range[1] ? parseInt(range[1], 10) : 0;
      let end = range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      end = Math.min(end, st.size - 1);
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function readBody(req, limit = 200 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(httpError(413, 'Fichier ou requête trop volumineux')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(httpError(400, 'JSON invalide')); }
    });
    req.on('error', reject);
  });
}

const hits = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 10000) hits.clear();
  return arr.length > max;
}
const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

const sessions = new Map(); // token -> expiration
function isAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
}
// Mot de passe stocké haché (scrypt) : jamais en clair dans data/db.json
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(pw), salt, 32).toString('hex')}`;
}
function checkPassword(pw) {
  const stored = (db.auth && db.auth.passwordHash) || '';
  if (!stored) return safeEqual(pw || '', CFG.adminPassword); // aucun changement : valeur de ADMIN_PASSWORD
  const [, salt, hash] = stored.split('$');
  const calc = crypto.scryptSync(String(pw || ''), salt, 32).toString('hex');
  return calc.length === hash.length && crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash));
}
const adminPhone = () => ((db.auth && db.auth.phone) || CFG.adminPhone || '');

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isTgAdmin(user) {
  if (!user || !user.id) return false;
  const id = String(user.id);
  return CFG.adminTgIds.includes(id) || (db.settings.adminTelegramIds || []).includes(id);
}

function newSession() {
  const token = uid(24);
  sessions.set(token, Date.now() + 7 * 24 * 3600 * 1000);
  return token;
}

// Accepte +212777300420, 00212777300420 ou 0777300420 pour le même numéro
function samePhone(input, expected) {
  const exp = digits(expected).replace(/^00/, '');
  if (!exp) return true;
  let d = digits(input).replace(/^00/, '');
  const candidates = [d];
  // numéro local : 0777300420 ↔ 212777300420
  if (d.startsWith('0') && d.length > 1 && exp.length >= d.length) candidates.push(exp.slice(0, exp.length - (d.length - 1)) + d.slice(1));
  return candidates.some((c) => c.length >= 6 && safeEqual(c, exp));
}

// News publiées (épinglées d'abord) + notifications actives et non expirées
function publicFeed() {
  const today = dayKey();
  return {
    news: db.news.filter((n) => n.published)
      .sort((a, b) => (b.pinned - a.pinned) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 100),
    notices: db.notices.filter((n) => n.active && n.text && (!n.until || n.until >= today)),
  };
}

function publicShop() {
  const productsCats = new Set(db.categories.map((c) => c.id));
  return {
    settings: { ...db.settings, adminTelegramIds: undefined },
    categories: db.categories,
    products: db.products.filter((p) => p.active && p.options.length).map((p) => ({ ...p, categoryId: productsCats.has(p.categoryId) ? p.categoryId : '' })),
    reviews: db.reviews.filter((r) => r.approved),
    socials: db.socials.filter((s) => s.url),
    ...publicFeed(),
    channels: orderChannels(),
    whatsappMode: CFG.wa.provider === 'link' ? 'link' : 'auto',
    version: APP_VERSION,
  };
}

async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const ip = clientIp(req);

  // ---- public
  if (m === 'GET' && p === '/api/shop') return send(res, 200, publicShop());

  // Rafraîchissement léger (toutes les 60 s) : notifications + news en temps réel
  if (m === 'GET' && p === '/api/feed') return send(res, 200, publicFeed());

  if (m === 'POST' && p === '/api/visit') {
    if (!rateLimited('visit:' + ip, 40, 10 * 60 * 1000)) recordVisit(req, await readBody(req, 8 * 1024));
    return send(res, 200, { ok: true });
  }

  // Téléchargement de la liste clients via un lien temporaire (fonctionne aussi depuis Telegram)
  const ex = p.match(/^\/api\/export\/([a-f0-9]{40})$/);
  if (m === 'GET' && ex) {
    const t = exportTokens.get(ex[1]);
    if (!t || t.exp < Date.now()) throw httpError(410, 'Lien expiré : relancez le téléchargement depuis le panel admin');
    const f = exportCustomers(t.q);
    const body = Buffer.from(f.body, 'utf8');
    res.writeHead(200, {
      'Content-Type': f.type,
      'Content-Length': body.length,
      'Content-Disposition': `attachment; filename="${f.name}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(body);
  }

  if (m === 'POST' && p === '/api/order') {
    if (rateLimited('order:' + ip, 8, 10 * 60 * 1000)) throw httpError(429, 'Trop de commandes, réessayez dans quelques minutes');
    return send(res, 200, await createOrder(await readBody(req)));
  }

  if (m === 'POST' && p === '/api/reviews') {
    if (!db.settings.reviewsEnabled) throw httpError(403, 'Avis désactivés');
    if (rateLimited('review:' + ip, 3, 60 * 60 * 1000)) throw httpError(429, 'Trop d\'avis envoyés, réessayez plus tard');
    const b = await readBody(req);
    if (!str(b.text) || !str(b.name)) throw httpError(400, 'Nom et avis obligatoires');
    db.reviews.unshift(normReview({ ...b, id: '', date: '', approved: false }));
    writeDb();
    return send(res, 200, { ok: true });
  }

  // Accès admin spécial : l'admin ouvert depuis Telegram est reconnu par sa signature
  if (m === 'POST' && p === '/api/me') {
    const user = verifyInitData((await readBody(req)).initData);
    return send(res, 200, { isAdmin: isTgAdmin(user) });
  }
  if (m === 'POST' && p === '/api/admin/tg-login') {
    if (rateLimited('login:' + ip, 20, 15 * 60 * 1000)) throw httpError(429, 'Trop de tentatives, réessayez dans 15 minutes');
    const user = verifyInitData((await readBody(req)).initData);
    if (!isTgAdmin(user)) throw httpError(403, 'Ce compte Telegram n\'a pas l\'accès admin');
    return send(res, 200, { token: newSession(), name: user.first_name || '' });
  }

  if (m === 'POST' && p === '/api/admin/login') {
    if (rateLimited('login:' + ip, 10, 15 * 60 * 1000)) throw httpError(429, 'Trop de tentatives, réessayez dans 15 minutes');
    const b = await readBody(req);
    const expected = adminPhone();
    const phoneOk = !expected || samePhone(b.phone, expected);
    const passOk = checkPassword(b.password);
    if (!phoneOk || !passOk) throw httpError(401, 'Numéro ou mot de passe incorrect');
    return send(res, 200, { token: newSession() });
  }

  // ---- admin
  if (!p.startsWith('/api/admin/')) throw httpError(404, 'Route inconnue');
  if (!isAdmin(req)) throw httpError(401, 'Non autorisé');

  if (m === 'GET' && p === '/api/admin/data') {
    const { orders, auth, visits, customers, ...rest } = db;
    return send(res, 200, {
      ...rest,
      newOrders: orders.filter((o) => o.status === 'nouvelle').length,
      credentials: { phone: adminPhone(), custom: !!auth.passwordHash },
    });
  }
  if (m === 'PUT' && p === '/api/admin/settings') {
    db.settings = normSettings(await readBody(req), db.settings);
    writeDb();
    return send(res, 200, { settings: db.settings });
  }
  const collections = { categories: [normCategory, 50], products: [normProduct, 1000], reviews: [normReview, 1000], socials: [normSocial, 30], news: [normNews, 300], notices: [normNotice, 20] };
  const cm = p.match(/^\/api\/admin\/(categories|products|reviews|socials|news|notices)$/);
  if (m === 'PUT' && cm) {
    const [fn, max] = collections[cm[1]];
    const arr = list((await readBody(req, 2 * 1024 * 1024)).items, fn, max);
    if (!arr) throw httpError(400, 'Format invalide');
    db[cm[1]] = arr;
    writeDb();
    return send(res, 200, { items: arr });
  }
  if (m === 'POST' && p === '/api/admin/upload') {
    const b = await readBody(req, 12 * 1024 * 1024);
    const mm = String(b.dataUrl || '').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
    if (!mm) throw httpError(400, 'Image invalide (PNG, JPG, WEBP ou GIF)');
    const buf = Buffer.from(mm[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) throw httpError(413, 'Image trop lourde (8 Mo max)');
    const name = `${Date.now().toString(36)}-${uid(4)}.${mm[1] === 'jpeg' ? 'jpg' : mm[1]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return send(res, 200, { url: `/uploads/${name}` });
  }
  // L'admin change lui-même son numéro et son mot de passe
  if (m === 'PUT' && p === '/api/admin/credentials') {
    const b = await readBody(req);
    if (!checkPassword(b.currentPassword)) throw httpError(403, 'Mot de passe actuel incorrect');
    const phone = str(b.phone, 30);
    if (phone && digits(phone).length < 6) throw httpError(400, 'Numéro de téléphone invalide');
    const np = String(b.newPassword || '');
    if (np) {
      if (np.length < 6) throw httpError(400, 'Le nouveau mot de passe doit faire au moins 6 caractères');
      if (np !== String(b.confirmPassword || '')) throw httpError(400, 'Les deux mots de passe ne sont pas identiques');
    }
    db.auth = { phone: digits(phone) ? phone : '', passwordHash: np ? hashPassword(np) : db.auth.passwordHash };
    writeDb();
    // Toutes les autres sessions ouvertes sont déconnectées
    const me = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    for (const t of [...sessions.keys()]) if (t !== me) sessions.delete(t);
    return send(res, 200, { ok: true, credentials: { phone: adminPhone(), custom: !!db.auth.passwordHash } });
  }

  // Import d'un fichier (image ou vidéo) envoyé en binaire, sans base64
  if (m === 'POST' && (p === '/api/admin/upload-file' || p === '/api/admin/upload-video')) {
    const TYPES = {
      'image/png': ['png', 10], 'image/jpeg': ['jpg', 10], 'image/webp': ['webp', 10], 'image/gif': ['gif', 10],
      'video/mp4': ['mp4', 80], 'video/webm': ['webm', 80], 'video/quicktime': ['mov', 80], 'video/x-m4v': ['m4v', 80],
    };
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const info = TYPES[ct];
    if (!info) throw httpError(400, `Format non accepté (${ct || 'inconnu'}) — images PNG/JPG/WEBP/GIF, vidéos MP4/WEBM/MOV`);
    const [ext, mb] = info;
    const MAX = mb * 1024 * 1024;
    if (Number(req.headers['content-length'] || 0) > MAX) throw httpError(413, `Fichier trop lourd (${mb} Mo maximum)`);
    const name = `${Date.now().toString(36)}-${uid(4)}.${ext}`;
    const dest = path.join(UPLOAD_DIR, name);
    await new Promise((resolve, reject) => {
      let size = 0;
      const out = fs.createWriteStream(dest);
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX) { req.destroy(); out.destroy(); fs.unlink(dest, () => {}); reject(httpError(413, `Fichier trop lourd (${mb} Mo maximum)`)); }
      });
      req.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      req.pipe(out);
    });
    return send(res, 200, { url: `/uploads/${name}` });
  }

  // ---- statistiques de visites
  if (m === 'GET' && p === '/api/admin/stats') return send(res, 200, visitStats());

  // ---- fichier clients
  if (m === 'GET' && p === '/api/admin/customers') {
    const rows = customersList(Object.fromEntries(url.searchParams));
    const today = dayKey();
    return send(res, 200, {
      customers: rows.slice(0, 2000),
      count: rows.length,
      total: Object.keys(db.customers).length,
      today: rows.filter((c) => dayKey(new Date(c.firstSeen)) === today).length,
      optIn: rows.filter((c) => c.optIn).length,
    });
  }
  const cdel = p.match(/^\/api\/admin\/customers\/(\+?\d{4,20})$/);
  if (m === 'DELETE' && cdel) {
    if (!db.customers[cdel[1]]) throw httpError(404, 'Client introuvable');
    delete db.customers[cdel[1]];
    writeDb();
    return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/admin/export-link') {
    const b = await readBody(req);
    const token = crypto.randomBytes(20).toString('hex');
    for (const [k, v] of exportTokens) if (v.exp < Date.now()) exportTokens.delete(k);
    exportTokens.set(token, { exp: Date.now() + 5 * 60 * 1000, q: { format: str(b.format, 5), from: str(b.from, 10), to: str(b.to, 10), optIn: bool(b.optIn) } });
    const f = exportCustomers({ format: str(b.format, 5) });
    return send(res, 200, { url: `/api/export/${token}`, fileName: f.name });
  }

  if (m === 'GET' && p === '/api/admin/orders') return send(res, 200, { orders: db.orders, statuses: ORDER_STATUSES });
  const om = p.match(/^\/api\/admin\/orders\/([A-Z0-9]+)$/);
  if (om) {
    const idx = db.orders.findIndex((o) => o.id === om[1]);
    if (idx < 0) throw httpError(404, 'Commande introuvable');
    if (m === 'PATCH') {
      const b = await readBody(req);
      if (!ORDER_STATUSES.includes(b.status)) throw httpError(400, 'Statut invalide');
      db.orders[idx].status = b.status;
      writeDb();
      return send(res, 200, { order: db.orders[idx] });
    }
    if (m === 'DELETE') { db.orders.splice(idx, 1); writeDb(); return send(res, 200, { ok: true }); }
  }
  if (m === 'GET' && p === '/api/admin/status') {
    return send(res, 200, {
      version: APP_VERSION,
      bot: botInfo ? { username: botInfo.username } : null,
      botTokenSet: !!CFG.botToken,
      webappUrl: CFG.webappUrl,
      adminChatId: !!CFG.adminChatId,
      adminTgCount: new Set([...CFG.adminTgIds, ...(db.settings.adminTelegramIds || [])]).size,
      requireTelegram: CFG.requireTelegram,
      whatsapp: { provider: CFG.wa.provider, number: db.settings.whatsapp, callmebotKey: !!CFG.wa.callmebotKey, cloud: !!(CFG.wa.cloudToken && CFG.wa.cloudPhoneId) },
      signal: { link: signalLink(), channels: orderChannels() },
      defaultPassword: !db.auth.passwordHash && CFG.adminPassword === 'admin123',
      customCredentials: !!db.auth.passwordHash,
      adminPhone: adminPhone(),
    });
  }
  if (m === 'POST' && p === '/api/admin/test') {
    const text = `✅ Test de connexion — ${db.settings.shopName}\nLes commandes arriveront ici.`;
    const [wa, tg] = await Promise.all([
      sendWhatsApp(text).catch((e) => ({ ok: false, error: e.message })),
      notifyTelegram(text).catch((e) => ({ ok: false, error: e.message })),
    ]);
    return send(res, 200, { whatsapp: wa, telegram: tg });
  }
  throw httpError(404, 'Route inconnue');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non autorisée');
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Erreur serveur' });
  }
});

// Écriture groupée des visites + nettoyage quotidien des empreintes
setInterval(() => { if (visitsDirty) { visitsDirty = false; pruneVisits(); writeDb(); } }, 30 * 1000);
// Render / Docker envoient SIGTERM avant l'arrêt : on sauvegarde les visites en attente
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { try { if (visitsDirty) writeDb(); } catch (e) { /* */ } process.exit(0); });
}

server.listen(CFG.port, () => {
  console.log(`\n🛍️  Boutique : http://localhost:${CFG.port}`);
  console.log(`🔐 Admin     : http://localhost:${CFG.port}/admin`);
  if (CFG.adminPassword === 'admin123') console.log('⚠️  Mot de passe admin par défaut (admin123) — changez ADMIN_PASSWORD dans .env');
  console.log(`💬 WhatsApp  : mode "${CFG.wa.provider}"${db.settings.whatsapp ? ' → ' + db.settings.whatsapp : ' (numéro à définir dans l\'admin)'}\n`);
  startBot();
});
