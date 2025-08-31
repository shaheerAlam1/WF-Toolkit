<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
<script>
/*! ruqflow-cms-modal v1.0.0 | MIT */
(function () {
  "use strict";

  // ---------- Styles & Shell (created once) ----------
  function ensureStyle() {
    if (document.getElementById("rf-cms-modal-style")) return;
    var css = `
:root{
  --rf-modal-bg: rgba(0,0,0,.6);
  --rf-modal-radius: 16px;
  --rf-modal-maxw: 960px;
  --rf-drawer-w: 520px;
}
.rf-cms-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:99999}
.rf-cms-modal.is-open{display:flex}
.rf-cms-modal__overlay{position:absolute;inset:0;background:var(--rf-modal-bg)}
.rf-cms-modal__panel{position:relative;background:#fff;border-radius:var(--rf-modal-radius);max-width:var(--rf-modal-maxw);width:min(96vw,var(--rf-modal-maxw));max-height:90vh;overflow:auto;box-shadow:0 12px 32px rgba(0,0,0,.35)}
.rf-cms-modal__panel--drawer{border-radius:0;max-width:none;width:var(--rf-drawer-w);height:100vh;max-height:100vh}
@media (max-width:767px){.rf-cms-modal__panel{width:100vw;height:100vh;max-height:100vh;border-radius:0}.rf-cms-modal__panel--drawer{width:100vw}}
.rf-cms-modal__close{position:absolute;top:10px;right:10px;width:40px;height:40px;border:0;border-radius:999px;background:#111;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer}
.rf-noscroll{position:fixed;width:100%;overflow:hidden}
    `.trim();
    var s = document.createElement("style");
    s.id = "rf-cms-modal-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ensureShell() {
    var el = document.getElementById("rf-cms-modal");
    if (el) return el;
    var wrap = document.createElement("div");
    wrap.className = "rf-cms-modal";
    wrap.id = "rf-cms-modal";
    wrap.setAttribute("role","dialog");
    wrap.setAttribute("aria-modal","true");
    wrap.setAttribute("aria-hidden","true");
    wrap.innerHTML = [
      '<div class="rf-cms-modal__overlay" data-rf-close></div>',
      '<div class="rf-cms-modal__panel" id="rf-cms-panel" role="document">',
      '  <button class="rf-cms-modal__close" type="button" aria-label="Close" data-rf-close>✕</button>',
      '  <div id="rf-cms-slot"></div>',
      '</div>'
    ].join("");
    document.body.appendChild(wrap);
    return wrap;
  }

  ensureStyle();
  var MODAL = ensureShell();
  var PANEL = document.getElementById("rf-cms-panel");
  var SLOT  = document.getElementById("rf-cms-slot");
  var lastFocused=null, scrollY=0, openTl=null;

  // ---------- Helpers ----------
  function getAnimFrom(el){
    // Accept on trigger OR template: modal-anim="[center|drawer-left|drawer-right|drawer-top|drawer-bottom]"
    var a = (el.getAttribute("modal-anim") || "").toLowerCase().trim();
    return a || "center";
  }
  function getTemplateIdFrom(el){
    // fallback: #rf-cms-template
    return el.getAttribute("modal-template") || "#rf-cms-template";
  }
  function collectPropsFrom(trigger){
    // Props come from data-prop-*, e.g. data-prop-title, data-prop-image, etc.
    // Bind these in Webflow to CMS fields.
    var props = {};
    Array.prototype.forEach.call(trigger.attributes, function(attr){
      if (attr.name.indexOf("data-prop-")===0){
        var key = attr.name.replace("data-prop-","").trim();
        props[key]=attr.value;
      }
    });
    // Optional JSON blob: data-props='{"price":"$19"}'
    var json = trigger.getAttribute("data-props");
    if (json){
      try { Object.assign(props, JSON.parse(json)); } catch(e){}
    }
    return props;
  }

  function cloneTemplate(templateId){
    // Prefer <template> if present, else hidden div with [modal-cms-template]
    var tpl = document.querySelector(templateId);
    if (!tpl){
      // try attribute fallback
      tpl = document.querySelector('[modal-cms-template]');
    }
    if (!tpl){
      console.warn("[ruqflow-cms-modal] Template not found:", templateId);
      return null;
    }
    // If it's a <template>, use content; else clone node’s children
    var frag = document.createDocumentFragment();
    if (tpl.tagName && tpl.tagName.toLowerCase()==="template"){
      frag.appendChild(tpl.content.cloneNode(true));
    } else {
      frag.appendChild(tpl.cloneNode(true));
      // remove the template’s identifying attributes/classes if wanted
      if (frag.firstElementChild){
        frag.firstElementChild.removeAttribute("modal-cms-template");
        frag.firstElementChild.id = ""; // avoid dup IDs
        frag.firstElementChild.style.display = ""; // ensure visible
      }
    }
    return frag;
  }

  function bindProps(root, props){
    if (!root) return;
    // Text content: [modal-bind="title"]
    root.querySelectorAll("[modal-bind]").forEach(function(el){
      var key = el.getAttribute("modal-bind");
      if (key in props) el.textContent = props[key];
    });
    // HTML: [modal-bind-html="description"]
    root.querySelectorAll("[modal-bind-html]").forEach(function(el){
      var key = el.getAttribute("modal-bind-html");
      if (key in props) el.innerHTML = props[key];
    });
    // src/href/bg/alt/srcset
    root.querySelectorAll("[modal-bind-src]").forEach(function(el){
      var key = el.getAttribute("modal-bind-src");
      if (key in props){ el.setAttribute("src", props[key]); el.setAttribute("loading","lazy"); }
    });
    root.querySelectorAll("[modal-bind-srcset]").forEach(function(el){
      var key = el.getAttribute("modal-bind-srcset");
      if (key in props){ el.setAttribute("srcset", props[key]); }
    });
    root.querySelectorAll("[modal-bind-href]").forEach(function(el){
      var key = el.getAttribute("modal-bind-href");
      if (key in props) el.setAttribute("href", props[key]);
    });
    root.querySelectorAll("[modal-bind-alt]").forEach(function(el){
      var key = el.getAttribute("modal-bind-alt");
      if (key in props) el.setAttribute("alt", props[key]);
    });
    root.querySelectorAll("[modal-bind-bg]").forEach(function(el){
      var key = el.getAttribute("modal-bind-bg");
      if (key in props) el.style.backgroundImage = "url('"+props[key]+"')";
    });
    // Inputs (if your template has form fields)
    root.querySelectorAll("[modal-bind-value]").forEach(function(el){
      var key = el.getAttribute("modal-bind-value");
      if (key in props) el.value = props[key];
    });
  }

  // ---------- Open/Close with GSAP ----------
  function openModal(anim){
    lastFocused = document.activeElement;
    // lock scroll
    scrollY = window.scrollY || window.pageYOffset;
    document.body.classList.add("rf-noscroll");
    document.body.style.top = (-scrollY)+"px";

    // Animate
    MODAL.style.display = "flex";
    MODAL.classList.add("is-open");
    MODAL.setAttribute("aria-hidden","false");

    // prep classes for drawers
    PANEL.classList.remove("rf-cms-modal__panel--drawer","rf-left","rf-right","rf-top","rf-bottom");
    if (anim.startsWith("drawer")){
      PANEL.classList.add("rf-cms-modal__panel--drawer");
      if (anim==="drawer-left") PANEL.classList.add("rf-left");
      if (anim==="drawer-right") PANEL.classList.add("rf-right");
      if (anim==="drawer-top") PANEL.classList.add("rf-top");
      if (anim==="drawer-bottom") PANEL.classList.add("rf-bottom");
    }

    if (window.gsap){
      openTl && openTl.kill();
      openTl = gsap.timeline({ defaults:{ duration:0.35, ease:"power2.out" }});
      // overlay
      openTl.fromTo(".rf-cms-modal__overlay",{ opacity:0 },{ opacity:1 },0);

      if (anim==="center"){
        openTl.fromTo(PANEL, { y:16, scale:0.96, opacity:0 }, { y:0, scale:1, opacity:1 }, 0);
      } else if (anim==="drawer-left"){
        openTl.fromTo(PANEL, { x:"-100%" }, { x:"0%" }, 0);
      } else if (anim==="drawer-right"){
        openTl.fromTo(PANEL, { x:"100%" }, { x:"0%" }, 0);
      } else if (anim==="drawer-top"){
        openTl.fromTo(PANEL, { y:"-100%" }, { y:"0%" }, 0);
      } else if (anim==="drawer-bottom"){
        openTl.fromTo(PANEL, { y:"100%" }, { y:"0%" }, 0);
      } else {
        // default center
        openTl.fromTo(PANEL, { y:16, scale:0.96, opacity:0 }, { y:0, scale:1, opacity:1 }, 0);
      }
    }
    // focus close button
    var btn = MODAL.querySelector(".rf-cms-modal__close");
    if (btn) btn.focus();
  }

  function closeModal(){
    if (window.gsap){
      var anim = getCurrentAnim();
      // reverse animation
      var tl = gsap.timeline({ defaults:{ duration:0.25, ease:"power2.in" },
        onComplete: hardClose
      });
      tl.to(".rf-cms-modal__overlay",{ opacity:0 },0);
      if (anim==="center"){
        tl.to(PANEL,{ y:16, scale:0.96, opacity:0 },0);
      } else if (anim==="drawer-left"){
        tl.to(PANEL,{ x:"-100%" },0);
      } else if (anim==="drawer-right"){
        tl.to(PANEL,{ x:"100%" },0);
      } else if (anim==="drawer-top"){
        tl.to(PANEL,{ y:"-100%" },0);
      } else if (anim==="drawer-bottom"){
        tl.to(PANEL,{ y:"100%" },0);
      } else {
        tl.to(PANEL,{ y:16, scale:0.96, opacity:0 },0);
      }
    } else {
      hardClose();
    }
  }

  function hardClose(){
    // cleanup content
    while (SLOT.firstChild) SLOT.removeChild(SLOT.firstChild);

    MODAL.classList.remove("is-open");
    MODAL.setAttribute("aria-hidden","true");
    MODAL.style.display = "none";

    // unlock scroll & restore position
    document.body.classList.remove("rf-noscroll");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);

    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function getCurrentAnim(){
    // If panel has drawer class, detect side
    if (PANEL.classList.contains("rf-cms-modal__panel--drawer")){
      if (PANEL.classList.contains("rf-left")) return "drawer-left";
      if (PANEL.classList.contains("rf-right")) return "drawer-right";
      if (PANEL.classList.contains("rf-top")) return "drawer-top";
      if (PANEL.classList.contains("rf-bottom")) return "drawer-bottom";
    }
    return "center";
  }

  // ---------- Events ----------
  document.addEventListener("click", function(e){
    // Open
    var t = e.target.closest("[modal-cms-trigger]");
    if (t){
      e.preventDefault();
      var templateId = getTemplateIdFrom(t);
      var anim = getAnimFrom(t);
      var props = collectPropsFrom(t);

      var frag = cloneTemplate(templateId);
      if (!frag) return;

      // Bind props inside fragment
      var root = document.createElement("div");
      root.appendChild(frag);
      bindProps(root, props);

      // Mount into modal slot
      while (root.firstChild) SLOT.appendChild(root.firstChild);

      openModal(anim);
      return;
    }

    // Close
    if (e.target && e.target.hasAttribute("data-rf-close")){
      e.preventDefault();
      closeModal();
    }
  });

  document.addEventListener("keydown", function(e){
    if (MODAL.classList.contains("is-open")){
      if (e.key==="Escape"){ e.preventDefault(); closeModal(); }
      // focus trap
      if (e.key==="Tab"){
        var focusables = MODAL.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])');
        var list = Array.prototype.slice.call(focusables).filter(function(el){ return el.offsetParent !== null; });
        if (!list.length) return;
        var first = list[0], last = list[list.length-1];
        if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
  });

  // ---------- Public API ----------
  window.RUQFLOW_CMS_MODAL = {
    openWith: function(props, options){
      // Open programmatically
      var templateId = (options && options.template) || "#rf-cms-template";
      var anim = (options && options.anim) || "center";
      var frag = cloneTemplate(templateId);
      if (!frag) return;
      var root = document.createElement("div");
      root.appendChild(frag);
      bindProps(root, props);
      while (root.firstChild) SLOT.appendChild(root.firstChild);
      openModal(anim);
    },
    close: closeModal
  };
})();
</script>
