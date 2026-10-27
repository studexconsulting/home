/* Studex Consulting — interacciones y movimiento del sitio (sin dependencias) */
(function () {
  'use strict';

  var doc = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var slice = function (list) { return Array.prototype.slice.call(list); };

  /* Titular: separa las palabras para que entren una a una */
  slice(document.querySelectorAll('[data-split]')).forEach(function (el) {
    var i = 0;
    (function walk(node) {
      slice(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span');
            var inner = document.createElement('span');
            w.className = 'w';
            inner.className = 'w-i';
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    el.classList.add('is-split');
  });

  /* Cabecera: se oculta al bajar, vuelve al subir; botón flotante de WhatsApp; parallax */
  var header = document.querySelector('.site-header');
  var waFloat = document.querySelector('.wa-float');
  var hero = document.querySelector('.hero, .page-hero');
  var parallax = reduce ? [] : slice(document.querySelectorAll('[data-parallax]'));
  var desktop = window.matchMedia('(min-width: 961px)');
  var lastY = window.scrollY || 0;
  var lockUntil = 0;
  var ticking = false;

  function updateParallax() {
    var vh = window.innerHeight;
    parallax.forEach(function (el) {
      if (!desktop.matches) { el.style.transform = ''; return; }
      var box = el.parentElement.getBoundingClientRect();
      if (box.bottom < -120 || box.top > vh + 120) return;
      var factor = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      var offset = box.top + box.height / 2 - vh / 2;
      el.style.transform = 'translate3d(0,' + (-offset * factor).toFixed(1) + 'px,0)';
    });
  }

  function onScroll() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    if (header) {
      var delta = y - lastY;
      header.classList.toggle('is-scrolled', y > 8);
      if (reduce || y < 400 || Date.now() < lockUntil || body.classList.contains('menu-open') || header.contains(document.activeElement)) {
        header.classList.remove('is-hidden');
      } else if (delta > 6) {
        header.classList.add('is-hidden');
      } else if (delta < -6) {
        header.classList.remove('is-hidden');
      }
    }
    if (waFloat) {
      var limit = hero ? hero.offsetTop + hero.offsetHeight * 0.6 : 480;
      waFloat.classList.toggle('is-visible', y > limit);
    }
    updateParallax();
    lastY = y;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', updateParallax);
  onScroll();

  /* Al pulsar un enlace interno, la cabecera se queda visible durante el desplazamiento */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (a && a.pathname === window.location.pathname) lockUntil = Date.now() + 1200;
  });

  /* Menú móvil */
  var toggle = document.querySelector('.menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? (toggle.getAttribute('data-close') || 'Cerrar menú') : (toggle.getAttribute('data-open') || 'Abrir menú'));
    }
    if (mobileNav) mobileNav.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open && header) header.classList.remove('is-hidden');
  }
  if (toggle && mobileNav) {
    toggle.setAttribute('data-open', toggle.getAttribute('aria-label') || 'Abrir menú');
    toggle.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });
    mobileNav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 960 && body.classList.contains('menu-open')) setMenu(false);
    });
  }

  /* Navegación: marca la sección que se está leyendo */
  var navLinks = slice(document.querySelectorAll('.nav a[href^="#"]'));
  if (hasIO && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (a) {
      var section = document.getElementById(a.getAttribute('href').slice(1));
      if (section) byId[section.id] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = byId[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach(function (x) { x.classList.remove('is-active'); });
          link.classList.add('is-active');
        } else {
          link.classList.remove('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { spy.observe(document.getElementById(id)); });
  }

  /* Plazos: próximo plazo, tarjeta del hero y línea de "hoy" en el calendario */
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  function parseDate(str) {
    var p = str.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  var timeline = document.querySelector('[data-timeline]');
  var card = document.querySelector('[data-deadline-card]');
  if (timeline) {
    var next = null;
    slice(timeline.querySelectorAll('li[data-date]')).forEach(function (li) {
      var d = parseDate(li.getAttribute('data-date'));
      li.classList.remove('is-next', 'is-past');
      if (d < today) {
        li.classList.add('is-past');
      } else if (!next && li.hasAttribute('data-deadline')) {
        next = { li: li, date: d };
        li.classList.add('is-next');
      }
    });
    if (card) {
      if (!next) {
        card.hidden = true;
      } else {
        var days = Math.round((next.date - today) / 86400000);
        var dateEl = card.querySelector('[data-deadline-date]');
        var textEl = card.querySelector('[data-deadline-text]');
        var countEl = card.querySelector('[data-deadline-count]');
        if (dateEl) dateEl.textContent = next.li.getAttribute('data-long');
        if (textEl) textEl.textContent = next.li.getAttribute('data-desc');
        if (countEl) {
          var tpl = days === 0 ? card.getAttribute('data-today')
            : days === 1 ? card.getAttribute('data-one')
            : card.getAttribute('data-many');
          countEl.innerHTML = (tpl || '').replace('{n}', '<strong>' + days + '</strong>');
        }
      }
    }
  }
  var timelineWrap = timeline && timeline.closest('.timeline-wrap');
  function placeToday() {
    if (!timelineWrap) return;
    var items = slice(timeline.querySelectorAll('li[data-date]'));
    if (!items.length) return;
    var dates = items.map(function (li) { return parseDate(li.getAttribute('data-date')); });
    var xs = items.map(function (li) { return li.offsetLeft + 7.5; });
    var x = xs[0];
    if (today >= dates[dates.length - 1]) {
      x = xs[xs.length - 1];
    } else {
      for (var k = 0; k < dates.length - 1; k++) {
        if (today >= dates[k] && today < dates[k + 1]) {
          x = xs[k] + (xs[k + 1] - xs[k]) * (today - dates[k]) / (dates[k + 1] - dates[k]);
          break;
        }
      }
    }
    timelineWrap.style.setProperty('--today-x', x.toFixed(1) + 'px');
  }
  placeToday();
  window.addEventListener('resize', placeToday);

  /* Mapa: resalta la ciudad al pasar por la lista (y al revés); los puntos llevan a su ficha */
  var pins = slice(document.querySelectorAll('.pin[data-city]'));
  var cityItems = slice(document.querySelectorAll('[data-city-item]'));
  function highlight(city, on) {
    pins.forEach(function (p) { p.classList.toggle('is-active', on && p.getAttribute('data-city') === city); });
    cityItems.forEach(function (li) { li.classList.toggle('is-active', on && li.getAttribute('data-city-item') === city); });
  }
  cityItems.forEach(function (li) {
    var city = li.getAttribute('data-city-item');
    ['mouseenter', 'focusin'].forEach(function (ev) { li.addEventListener(ev, function () { highlight(city, true); }); });
    ['mouseleave', 'focusout'].forEach(function (ev) { li.addEventListener(ev, function () { highlight(city, false); }); });
  });
  pins.forEach(function (p, i) {
    var city = p.getAttribute('data-city');
    var link = document.querySelector('[data-city-item="' + city + '"] a');
    p.style.setProperty('--i', i);
    p.addEventListener('mouseenter', function () { highlight(city, true); });
    p.addEventListener('mouseleave', function () { highlight(city, false); });
    if (link) p.addEventListener('click', function () { link.click(); });
  });

  /* Cifras que cuentan hasta su valor */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var sep = el.getAttribute('data-sep') || '.';
    var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep); };
    if (!window.requestAnimationFrame) { el.textContent = fmt(target); return; }
    var start = null;
    var duration = 1500;
    el.textContent = fmt(0);
    function step(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / duration, 1);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  /* Apariciones al hacer scroll */
  var blocks = slice(document.querySelectorAll('[data-reveal], [data-count], .timeline-wrap'));
  var items = [];
  slice(document.querySelectorAll('[data-stagger]')).forEach(function (list) { items = items.concat(slice(list.children)); });
  function show(el) {
    el.classList.add('is-in');
    if (el.hasAttribute('data-count')) countUp(el);
  }
  if (hasIO) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    blocks.forEach(function (el) { io.observe(el); });

    var itemIO = new IntersectionObserver(function (entries) {
      entries.filter(function (entry) { return entry.isIntersecting; }).forEach(function (entry, k) {
        var el = entry.target;
        var delay = Math.min(k, 6) * 80;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        itemIO.unobserve(el);
        window.setTimeout(function () { el.style.transitionDelay = ''; }, 1000 + delay);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    items.forEach(function (el) { itemIO.observe(el); });
  } else {
    blocks.forEach(show);
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* Preguntas frecuentes: apertura suave */
  slice(document.querySelectorAll('.faq-list details')).forEach(function (details) {
    var summary = details.querySelector('summary');
    var answer = details.querySelector('.faq-answer');
    if (!summary || !answer || !answer.animate) return;
    var running = null;
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      if (running) running.cancel();
      var opening = !details.open;
      if (opening) details.open = true;
      var full = answer.scrollHeight;
      answer.style.overflow = 'hidden';
      running = answer.animate(
        opening ? [{ height: '0px', opacity: 0 }, { height: full + 'px', opacity: 1 }]
                : [{ height: full + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: opening ? 380 : 280, easing: 'cubic-bezier(.2,.7,.2,1)' }
      );
      running.onfinish = function () {
        if (!opening) details.open = false;
        answer.style.overflow = '';
        running = null;
      };
    });
  });

  /* Filtros de universidades */
  var filterRoot = document.querySelector('[data-filters]');
  if (filterRoot) {
    var state = { type: 'all', city: 'all' };
    var cards = slice(document.querySelectorAll('[data-uni]'));
    var groups = slice(document.querySelectorAll('[data-group]'));
    var countText = filterRoot.querySelector('[data-count-label]');
    var empty = document.querySelector('[data-empty]');
    var apply = function () {
      var visible = 0;
      cards.forEach(function (c) {
        var show = (state.type === 'all' || c.getAttribute('data-type') === state.type) &&
                   (state.city === 'all' || (' ' + c.getAttribute('data-city') + ' ').indexOf(' ' + state.city + ' ') > -1);
        c.hidden = !show;
        if (show) { visible++; c.classList.add('is-in'); }
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector('[data-uni]:not([hidden])'); });
      if (countText) {
        var tpl = visible === 1 ? countText.getAttribute('data-one') : countText.getAttribute('data-many');
        countText.textContent = (tpl || '').replace('{n}', visible);
      }
      if (empty) empty.hidden = visible > 0;
    };
    filterRoot.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (!chip) return;
      var group = chip.closest('[data-filter-group]');
      state[group.getAttribute('data-filter-group')] = chip.getAttribute('data-filter');
      slice(group.querySelectorAll('[data-filter]')).forEach(function (b) {
        b.setAttribute('aria-pressed', b === chip ? 'true' : 'false');
      });
      apply();
    });
  }

  /* Formulario: envío sin recargar (si falla, se envía de forma normal) */
  slice(document.querySelectorAll('form[data-ajax]')).forEach(function (form) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();
      if (button) button.disabled = true;
      if (status) { status.removeAttribute('data-state'); status.textContent = form.getAttribute('data-sending') || ''; }
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          form.reset();
          if (status) { status.setAttribute('data-state', 'ok'); status.textContent = form.getAttribute('data-success'); }
        })
        .catch(function () {
          if (status) { status.setAttribute('data-state', 'error'); status.textContent = form.getAttribute('data-error'); }
        })
        .then(function () { if (button) button.disabled = false; });
    });
  });

  /* Año actual en el pie */
  slice(document.querySelectorAll('[data-year]')).forEach(function (el) { el.textContent = new Date().getFullYear(); });

  doc.classList.add('js-ready');
})();
