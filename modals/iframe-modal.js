/*! rq-iframe-modal v1.0.1 | MIT */
(function () {
  "use strict";

  // ---- Create (or reuse) style + modal shell --------------------------------
  function ensureStyle() {
    if (document.getElementById("rq-iframe-modal-style")) return;
    var css = `
:root {
  --rq-modal-bg: rgba(0,0,0,.65);
  --rq-modal-max-w: 1000px;
  --rq-modal-radius: 16px;
}
.rq-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:99999}
.rq-modal.is-open{display:flex}
.rq-modal__overlay{position:absolute;inset:0;background:var(--rq-modal-bg)}
.rq-modal__dialog{position:relative;width:min(96vw,var(--rq-modal-max-w));max-height:90vh;background:#000;border-radius:var(--rq-modal-radius);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.rq-modal__close{position:absolute;top:8px;right:8px;width:40px;height:40px;border:0;border-radius:999px;background:#fff;color:#111;font-size:20px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.rq-modal__body{position:relative;width:100%;height:min(70vh,56.25vw);background:#000}
.rq-modal__iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.rq-modal__spinner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.rq-modal__spinner::after{content:"";width:42px;height:42px;border-radius:50%;border:4px solid rgba(255,255,255,.35);border-top-color:#fff;animation:rqspin 1s linear infinite}
@keyframes rqspin{to{transform:rotate(360deg)}}
@media (max-width:767px){.rq-modal__dialog{width:100vw;height:100vh;border-radius:0}.rq-modal__body{width:100%;height:calc(100vh - 56px)}.rq-modal__close{top:10px;right:10px}}
.rq-noscroll{position:fixed;width:100%;overflow:hidden}
`.trim();
    var s = document.createElement("style");
    s.id = "rq-iframe-modal-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ensureModal() {
    var el = document.getElementById("rq-iframe-modal");
    if (el) return el;
    var wrap = document.createElement("div");
    wrap.className = "rq-modal";
    wrap.id = "rq-iframe-modal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = [
      '<div class="rq-modal__overlay" data-model-close></div>',
      '<div class="rq-modal__dialog" role="document">',
      '  <button class="rq-modal__close" type="button" aria-label="Close" title="Close" data-model-close>✕</button>',
      '  <div class="rq-modal__body" id="rq-modal-body">',
      '    <div class="rq-modal__spinner" id="rq-modal-spinner" hidden></div>',
      "  </div>",
      "</div>"
    ].join("");
    document.body.appendChild(wrap);
    return wrap;
  }

  ensureStyle();
  var MODAL = ensureModal();
  var BODY  = document.getElementById("rq-modal-body");
  var SPIN  = document.getElementById("rq-modal-spinner");
  var lastFocused = null;
  var scrollY = 0;

  // ---- Utilities -------------------------------------------------------------
  function cssEscape(id) {
    if (window.CSS && CSS.escape) return CSS.escape(id);
    return String(id).replace(/("|'|\\|#|\.|\[|\]|:|,|=|\*|\^|\$|~|\+)/g, "\\$&");
  }
  function isOpen(){ return MODAL.classList.contains("is-open"); }

  function trapFocus(e) {
    var focusables = MODAL.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    focusables = Array.prototype.slice.call(focusables).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function resolveUrl(name, triggerEl) {
    // 1) URL on trigger
    var url = triggerEl.getAttribute("model-iframe_url");
    if (url) return url;

    // 2) Mapped element: [model-iframe_url][model-for="name"]
    if (name) {
      var q = document.querySelector('[model-iframe_url][model-for="'+ cssEscape(name) +'"]');
      if (q) return q.getAttribute("model-iframe_url");
    }

    // 3) Nearest descendant with model-iframe_url
    var node = triggerEl;
    while (node) {
      if (node.querySelector) {
        var near = node.querySelector("[model-iframe_url]");
        if (near) return near.getAttribute("model-iframe_url");
      }
      node = node.parentElement;
    }

    // 4) First on page
    var first = document.querySelector("[model-iframe_url]");
    return first ? first.getAttribute("model-iframe_url") : null;
  }

  function resolveAspect(triggerEl, name) {
    var a = triggerEl.getAttribute("model-aspect");
    if (a) return a;
    if (name) {
      var mapped = document.querySelector('[model-iframe_url][model-for="'+ cssEscape(name) +'"]');
      if (mapped && mapped.getAttribute("model-aspect")) return mapped.getAttribute("model-aspect");
    }
    var first = document.querySelector("[model-iframe_url][model-aspect]");
    return first ? first.getAttribute("model-aspect") : "16/9";
  }

  // ---- Popup (for XFO/CSP-blocked pages like judge.me) -----------------------
  function openPopup(url, w, h) {
    w = w || 960; h = h || 640;
    var dualLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    var dualTop  = window.screenTop  !== undefined ? window.screenTop  : window.screenY;
    var width  = window.innerWidth  || document.documentElement.clientWidth  || screen.width;
    var height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    var left = dualLeft + (width  - w) / 2;
    var top  = dualTop  + (height - h) / 2;
    var spec = "scrollbars=yes,resizable=yes,width="+w+",height="+h+",top="+top+",left="+left;
    var win = window.open(url, "_blank", spec);
    if (!win) { window.location.href = url; } // hard fallback if popup blocked
    else { win.opener = null; }
  }

  function isJudgeMeHost(hostname) {
    if (!hostname) return false;
    hostname = hostname.toLowerCase();
    return hostname === "judge.me" || hostname.endsWith(".judge.me");
  }

  // ---- Open/close ------------------------------------------------------------
  function openModal(url, aspect, triggerEl) {
    lastFocused = document.activeElement;

    // scroll lock
    scrollY = window.scrollY || window.pageYOffset;
    document.body.classList.add("rq-noscroll");
    document.body.style.top = (-scrollY) + "px";

    // aspect
    try { BODY.style.aspectRatio = aspect; } catch(e){}

    // spinner
    SPIN.hidden = false;

    // inject iframe
    var iframe = document.createElement("iframe");
    iframe.className = "rq-modal__iframe";
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("loading", "eager");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen");
    iframe.src = url;

    var settled = false;
    var fallbackTimer = setTimeout(function () {
      if (settled) return;
      settled = true;
      // likely blocked by X-Frame-Options/CSP -> fallback to popup
      closeModal();
      openPopup(url);
    }, 1500);

    iframe.addEventListener("load", function(){
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);
      SPIN.hidden = true;
    }, { once: true });

    iframe.addEventListener("error", function(){
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);
      SPIN.hidden = true;
      closeModal();
      openPopup(url);
    }, { once: true });

    BODY.appendChild(iframe);

    MODAL.classList.add("is-open");
    MODAL.setAttribute("aria-hidden", "false");
    var closeBtn = MODAL.querySelector(".rq-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    var iframe = MODAL.querySelector(".rq-modal__iframe");
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    SPIN.hidden = true;

    MODAL.classList.remove("is-open");
    MODAL.setAttribute("aria-hidden", "true");
    document.body.classList.remove("rq-noscroll");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);

    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  // ---- Events ---------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[model-trigger]");
    if (!t) return;
    e.preventDefault();

    var name = t.getAttribute("model-trigger") || "";
    var url  = resolveUrl(name, t);
    if (!url) { console.warn("[rq-iframe-modal] No URL for trigger", t); return; }
    var aspect = resolveAspect(t, name);

    // Decide open mode
    var openPref = (t.getAttribute("model-open") || "").toLowerCase(); // "popup" | "iframe"
    var host = null;
    try { host = new URL(url, location.href).hostname; } catch(e){}

    var forcePopup = openPref === "popup" || isJudgeMeHost(host);
    if (forcePopup) { openPopup(url); return; }

    openModal(url, aspect, t);
  });

  MODAL.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-model-close")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); closeModal(); }
    if (e.key === "Tab") trapFocus(e);
  });

  // ---- Public API -----------------------------------------------------------
  window.RQ_IFRAME_MODAL = {
    open: function (url, aspect) { openModal(url, aspect || "16/9", document.body); },
    close: closeModal
  };

})();
