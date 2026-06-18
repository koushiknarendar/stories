/* Storis embed widget — storis.in/embed.js
 *
 * Usage:
 *   <script src="https://storis.in/embed.js"></script>
 *
 * Options (data attributes on the script tag):
 *   data-position="bottom-right"  (default) | bottom-left | top-right | top-left
 *   data-label="Story cards"      Button label
 *   data-auto="true"              Auto-open on page load
 */
(function () {
  'use strict';

  var BASE = 'https://storis.in';

  // Bail on Storis itself
  try { if (window.location.hostname === new URL(BASE).hostname) return; } catch (_) {}

  // Read config from the script tag
  var script = document.currentScript || (function () {
    var tags = document.getElementsByTagName('script');
    return tags[tags.length - 1];
  })();

  var cfg = {
    position: (script && script.getAttribute('data-position')) || 'bottom-right',
    label:    (script && script.getAttribute('data-label'))    || 'Story cards',
    auto:     script && script.getAttribute('data-auto') === 'true',
  };

  // ─── State ──────────────────────────────────────────────────────────────────
  var cards      = null;
  var cardTitle  = '';
  var cardIndex  = 0;
  var isOpen     = false;
  var overlayEl  = null;

  // ─── Styles ─────────────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#storis-trigger{position:fixed;z-index:2147483640;display:flex;align-items:center;gap:7px;padding:10px 18px;background:#7C5CFF;color:#fff;border:none;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(124,92,255,.42);transition:transform .15s,box-shadow .15s;user-select:none;letter-spacing:-.01em}',
    '#storis-trigger:hover{transform:translateY(-2px);box-shadow:0 8px 26px rgba(124,92,255,.54)}',
    '#storis-trigger:active{transform:translateY(0)}',
    '#storis-trigger svg{flex-shrink:0}',

    '#storis-overlay{position:fixed;inset:0;z-index:2147483641;background:rgba(0,0,0,.76);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .22s}',
    '#storis-overlay.storis-open{opacity:1;pointer-events:auto}',

    '#storis-modal{position:relative;width:min(390px,93vw);height:min(580px,88vh);background:#0e0e10;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.07);transform:scale(.94) translateY(8px);transition:transform .22s}',
    '#storis-overlay.storis-open #storis-modal{transform:scale(1) translateY(0)}',

    '#storis-close{position:absolute;top:13px;right:13px;z-index:10;width:30px;height:30px;background:rgba(255,255,255,.1);border:none;border-radius:50%;color:rgba(255,255,255,.85);font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;padding:0}',
    '#storis-close:hover{background:rgba(255,255,255,.2)}',

    /* Card area */
    '#storis-card-area{flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column}',
    '#storis-cover{position:absolute;inset:0;background-size:cover;background-position:center}',
    '#storis-cover-fade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(14,14,16,.18) 0%,rgba(14,14,16,.0) 28%,rgba(14,14,16,.72) 55%,rgba(14,14,16,.98) 100%)}',
    '#storis-card-body{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:18px 20px 16px}',

    /* Progress */
    '#storis-progress{display:flex;gap:5px;margin-bottom:16px}',
    '.storis-dot{flex:1;height:3px;border-radius:99px;background:rgba(255,255,255,.18);transition:background .2s}',
    '.storis-dot.s-done{background:rgba(255,255,255,.9)}',
    '.storis-dot.s-active{background:rgba(255,255,255,.55)}',

    /* Headline & bullets */
    '#storis-headline{margin:0 0 11px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:19px;font-weight:700;color:#fff;line-height:1.25;letter-spacing:-.015em}',
    '#storis-bullets{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}',
    '#storis-bullets li{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13.5px;color:rgba(255,255,255,.8);line-height:1.5;display:flex;gap:8px;align-items:flex-start}',
    '#storis-bullets li:before{content:"·";color:#7C5CFF;font-size:19px;line-height:1.15;flex-shrink:0;margin-top:-1px}',

    /* Footer */
    '#storis-footer{padding:12px 16px;background:rgba(255,255,255,.04);border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0}',
    '#storis-nav{display:flex;gap:6px}',
    '.s-nav-btn{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:rgba(255,255,255,.85);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;font-family:inherit}',
    '.s-nav-btn:hover:not(:disabled){background:rgba(255,255,255,.15)}',
    '.s-nav-btn:disabled{opacity:.28;cursor:default}',
    '#storis-deep-link{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;color:#9b80ff;text-decoration:none;font-weight:600;white-space:nowrap}',
    '#storis-deep-link:hover{text-decoration:underline}',

    /* Loading / error states */
    '.storis-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;color:rgba(255,255,255,.65);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.55}',
    '.storis-spinner{width:30px;height:30px;border:2.5px solid rgba(124,92,255,.25);border-top-color:#7C5CFF;border-radius:50%;animation:storis-spin .72s linear infinite}',
    '@keyframes storis-spin{to{transform:rotate(360deg)}}',
    '.storis-err-icon{font-size:30px}',
    '.storis-err-link{color:#9b80ff;text-decoration:underline;font-weight:600;font-size:13px}',
  ].join('');
  document.head.appendChild(styleEl);

  // ─── Trigger button ──────────────────────────────────────────────────────────
  var trigger = document.createElement('button');
  trigger.id = 'storis-trigger';
  trigger.setAttribute('aria-label', 'Open story cards');
  trigger.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<rect x="6.5" y="4.5" width="11" height="15" rx="2.6" transform="rotate(-9 12 12)" fill="white" opacity="0.45"/>' +
      '<rect x="6.5" y="4.5" width="11" height="15" rx="2.6" transform="rotate(7 12 12)" fill="white"/>' +
    '</svg>' + cfg.label;

  var pos = cfg.position;
  trigger.style.bottom = pos.includes('top')  ? 'auto' : '22px';
  trigger.style.top    = pos.includes('top')  ? '22px' : 'auto';
  trigger.style.right  = pos.includes('left') ? 'auto' : '22px';
  trigger.style.left   = pos.includes('left') ? '22px' : 'auto';

  document.body.appendChild(trigger);
  trigger.addEventListener('click', open);

  // ─── Build modal DOM (once) ──────────────────────────────────────────────────
  function buildOverlay() {
    var el = document.createElement('div');
    el.id = 'storis-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Story cards');

    el.innerHTML =
      '<div id="storis-modal">' +
        '<button id="storis-close" aria-label="Close">&#x2715;</button>' +
        '<div id="storis-card-area">' +
          '<div id="storis-loading" class="storis-state">' +
            '<div class="storis-spinner"></div>' +
            '<span>Building story cards…</span>' +
          '</div>' +
        '</div>' +
        '<div id="storis-footer">' +
          '<div id="storis-nav">' +
            '<button class="s-nav-btn" id="storis-prev" aria-label="Previous card" disabled>&#8592;</button>' +
            '<button class="s-nav-btn" id="storis-next" aria-label="Next card" disabled>&#8594;</button>' +
          '</div>' +
          '<a id="storis-deep-link" href="' + BASE + '/?url=' + encodeURIComponent(window.location.href) + '" target="_blank" rel="noopener noreferrer">Open in Storis ↗</a>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);

    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    el.querySelector('#storis-close').addEventListener('click', close);
    el.querySelector('#storis-prev').addEventListener('click', function () { navigate(-1); });
    el.querySelector('#storis-next').addEventListener('click', function () { navigate(1); });

    // Touch swipe
    var touchX = 0;
    var modal = el.querySelector('#storis-modal');
    modal.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    modal.addEventListener('touchend',   function (e) {
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 48) navigate(dx < 0 ? 1 : -1);
    }, { passive: true });

    return el;
  }

  // ─── Open / close ────────────────────────────────────────────────────────────
  function open() {
    if (!overlayEl) overlayEl = buildOverlay();

    // Trigger CSS transition
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlayEl.classList.add('storis-open'); });
    });

    isOpen = true;
    document.body.style.overflow = 'hidden';

    if (!cards) {
      fetchCards();
    } else {
      renderCard();
    }
  }

  function close() {
    if (!overlayEl) return;
    overlayEl.classList.remove('storis-open');
    isOpen = false;
    document.body.style.overflow = '';
  }

  // ─── Keyboard nav ────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape')                             { close();       return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(-1);
  });

  // ─── Fetch ───────────────────────────────────────────────────────────────────
  function fetchCards() {
    setAreaHtml(
      '<div class="storis-state">' +
        '<div class="storis-spinner"></div>' +
        '<span>Building story cards…</span>' +
      '</div>'
    );

    fetch(BASE + '/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: window.location.href }),
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok || !r.data.cards || !r.data.cards.length) throw new Error(r.data.error || 'No cards');
        cards     = r.data.cards;
        cardTitle = r.data.title || document.title;
        cardIndex = 0;
        buildCardShell();
        renderCard();
      })
      .catch(function () { showError(); });
  }

  // ─── DOM helpers ─────────────────────────────────────────────────────────────
  function setAreaHtml(html) {
    var area = document.getElementById('storis-card-area');
    if (area) area.innerHTML = html;
  }

  function buildCardShell() {
    setAreaHtml(
      '<div id="storis-cover"></div>' +
      '<div id="storis-cover-fade"></div>' +
      '<div id="storis-card-body">' +
        '<div id="storis-progress"></div>' +
        '<h2 id="storis-headline"></h2>' +
        '<ul id="storis-bullets"></ul>' +
      '</div>'
    );
  }

  function showError() {
    setAreaHtml(
      '<div class="storis-state">' +
        '<span class="storis-err-icon">😕</span>' +
        '<span>Couldn’t generate cards for this page.</span>' +
        '<a class="storis-err-link" href="' + BASE + '/?url=' + encodeURIComponent(window.location.href) + '" target="_blank" rel="noopener">Try on Storis →</a>' +
      '</div>'
    );
    disableNav();
  }

  function disableNav() {
    var p = document.getElementById('storis-prev');
    var n = document.getElementById('storis-next');
    if (p) p.disabled = true;
    if (n) n.disabled = true;
  }

  // ─── Render current card ─────────────────────────────────────────────────────
  function renderCard() {
    if (!cards || !cards.length) return;
    var card = cards[cardIndex];

    // Progress dots
    var prog = document.getElementById('storis-progress');
    if (prog) {
      prog.innerHTML = cards.map(function (_, i) {
        var cls = i < cardIndex ? 's-done' : i === cardIndex ? 's-active' : '';
        return '<div class="storis-dot ' + cls + '"></div>';
      }).join('');
    }

    // Headline
    var hl = document.getElementById('storis-headline');
    if (hl) hl.textContent = card.headline || '';

    // Bullets
    var bl = document.getElementById('storis-bullets');
    if (bl) {
      bl.innerHTML = (card.bullets || []).map(function (b) {
        return '<li>' + escHtml(b) + '</li>';
      }).join('');
    }

    // Nav buttons
    var prev = document.getElementById('storis-prev');
    var next = document.getElementById('storis-next');
    if (prev) prev.disabled = cardIndex === 0;
    if (next) next.disabled = cardIndex === cards.length - 1;
  }

  function navigate(dir) {
    if (!cards) return;
    var idx = cardIndex + dir;
    if (idx < 0 || idx >= cards.length) return;
    cardIndex = idx;
    renderCard();
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Auto-open ───────────────────────────────────────────────────────────────
  if (cfg.auto) {
    if (document.readyState === 'complete') {
      setTimeout(open, 600);
    } else {
      window.addEventListener('load', function () { setTimeout(open, 600); });
    }
  }

})();
