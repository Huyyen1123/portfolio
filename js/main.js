(function () {
  var reducedMotionOS = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Settings state (persisted) ----
  // Three independent toggles: Music, Sound Effects, Reduce Motion.
  // Reduce Motion replaces the old standalone motion-toggle icon -- the
  // gear button now opens a real settings panel instead of flipping
  // motion directly.
  var settings = {
    music: false,
    sfx: true,
    motion: reducedMotionOS
  };
  try {
    var saved = JSON.parse(localStorage.getItem('portfolio-settings') || '{}');
    if (typeof saved.music === 'boolean') settings.music = saved.music;
    if (typeof saved.sfx === 'boolean') settings.sfx = saved.sfx;
    if (typeof saved.motion === 'boolean') settings.motion = saved.motion;
  } catch (e) { /* ignore */ }

  function saveSettings() {
    try { localStorage.setItem('portfolio-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  function applyMotionState() {
    document.documentElement.classList.toggle('motion-off', settings.motion);
  }
  applyMotionState();

  // ---- Splash text: steps through SPLASHES in order, one per page
  // load (1 -> 2 -> 3 -> 4 -> 1...), remembered in localStorage. ----
  var SPLASHES = ['Software Engineer!!', 'IRONMAN!!', 'Vietnamese!!', '2005!!'];
  var splashEl = document.querySelector('.ts-splash');
  if (splashEl) {
    var splashIndex = 0;
    try {
      var last = parseInt(localStorage.getItem('portfolio-splash-index'), 10);
      if (!isNaN(last)) splashIndex = (last + 1) % SPLASHES.length;
      localStorage.setItem('portfolio-splash-index', String(splashIndex));
    } catch (e) { /* storage blocked: always show the first line */ }
    splashEl.textContent = SPLASHES[splashIndex];
    splashEl.style.setProperty('--splash-len', SPLASHES[splashIndex].length);
  }

  // ---- Loading screen -> titlescreen handoff ----
  var loadingScreen = document.getElementById('loading-screen');
  var titlescreen = document.getElementById('titlescreen');
  var BAR_FILL_MS = 2100; // must match the CSS animation-duration on .loading-bar-fill
  var SCREEN_FADE_MS = 500; // must match .loading-screen's own opacity transition

  var LOADING_LINES = ['Loading world...', 'Generating terrain...', 'Spawning player...'];
  var loadingLabel = document.getElementById('loading-label');

  if (loadingScreen && titlescreen) {
    if (settings.motion) {
      loadingScreen.style.display = 'none';
      titlescreen.classList.add('visible');
    } else {
      if (loadingLabel) {
        var stageMs = BAR_FILL_MS / LOADING_LINES.length;
        LOADING_LINES.forEach(function (line, i) {
          if (i === 0) return;
          setTimeout(function () { loadingLabel.textContent = line; }, stageMs * i);
        });
      }
      setTimeout(function () {
        loadingScreen.classList.add('fade-out');
        titlescreen.classList.add('visible');
        setTimeout(function () {
          loadingScreen.style.display = 'none';
        }, SCREEN_FADE_MS);
      }, BAR_FILL_MS + 150);
    }
  }

  // ---- Sound effects (procedurally generated, no bundled audio files) ----
  // A shared AudioContext playing short synthesized blips -- an original,
  // license-free stand-in for real UI sound files. Browsers require a
  // user gesture before audio can start, so the context is created lazily
  // on first interaction rather than on load.
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    return audioCtx;
  }
  function blip(freq, durationMs, type) {
    if (!settings.sfx) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }
  function hoverSound() { blip(660, 0.06, 'square'); }
  function clickSound() { blip(420, 0.09, 'square'); }

  var soundTriggers = document.querySelectorAll(
    '.ts-menu-btn, .ts-icon-btn, .ts-linkedin-btn, .ts-back-btn, .settings-toggle'
  );
  soundTriggers.forEach(function (el) {
    el.addEventListener('mouseenter', hoverSound);
    el.addEventListener('click', clickSound);
  });

  // Ambient music: wired up and toggle-able, but no track is bundled (no
  // royalty-free audio file was available to include) -- flip Music on
  // in Settings and it's ready to play the moment a real src is added.
  var bgMusic = document.getElementById('bg-music');
  function applyMusicState() {
    if (!bgMusic) return;
    if (settings.music && bgMusic.currentSrc) {
      bgMusic.play().catch(function () { /* autoplay may still be blocked */ });
    } else {
      bgMusic.pause();
    }
  }

  // ---- Settings panel ----
  var settingsBtn = document.getElementById('settings-btn');
  var settingsPanel = document.getElementById('settings-panel');
  var settingsTitle = document.getElementById('settings-title');
  var toggleButtons = document.querySelectorAll('.settings-toggle');

  function renderToggles() {
    toggleButtons.forEach(function (btn) {
      var key = btn.getAttribute('data-setting');
      var on = key === 'motion' ? settings.motion : settings[key];
      // "Reduce Motion" reads naturally as On/Off in the same direction
      // as the setting itself; Music/SFX read the same way.
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'On' : 'Off';
    });
  }
  renderToggles();

  function openSettings() {
    if (!settingsPanel) return;
    settingsPanel.hidden = false;
    if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'true');
    if (settingsTitle) settingsTitle.focus();
  }
  function closeSettings() {
    if (!settingsPanel) return;
    settingsPanel.hidden = true;
    if (settingsBtn) {
      settingsBtn.setAttribute('aria-expanded', 'false');
      settingsBtn.focus();
    }
  }
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  document.querySelectorAll('[data-settings-close]').forEach(function (el) {
    el.addEventListener('click', closeSettings);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && settingsPanel && !settingsPanel.hidden) closeSettings();
  });

  toggleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-setting');
      settings[key] = !settings[key];
      if (key === 'motion') applyMotionState();
      if (key === 'music') applyMusicState();
      renderToggles();
      saveSettings();
    });
  });

  // ---- Player-sprite head: subtle mouse-follow (disabled) ----
  // Turned off so the character always faces straight ahead. Flip
  // HEAD_FOLLOW to true to bring back the few-px head drift.
  var HEAD_FOLLOW = false;
  var playerHead = document.querySelector('.ts-player-corner .pf-head');
  if (HEAD_FOLLOW && playerHead) {
    document.addEventListener('mousemove', function (e) {
      if (settings.motion) return;
      var nx = (e.clientX / window.innerWidth - 0.5) * 2;
      var ny = (e.clientY / window.innerHeight - 0.5) * 2;
      playerHead.style.transform = 'translate(' + (nx * 3).toFixed(1) + 'px, ' + (ny * 2).toFixed(1) + 'px)';
    });
  }

  // ---- Menu windows: menu buttons open a modal window over the dimmed
  // titlescreen; Close, the backdrop, or Esc closes it. GitHub is a real
  // link (target=_blank), not part of this. ----
  var menuButtons = document.querySelectorAll('.ts-menu-btn[data-panel]');
  var backButtons = document.querySelectorAll('[data-back]');
  var panels = {};
  document.querySelectorAll('.view-panel').forEach(function (panel) {
    panels[panel.getAttribute('data-panel')] = panel;
  });

  var lastTrigger = null;

  function openPanel(name, trigger) {
    var panel = panels[name];
    if (!panel) return;
    lastTrigger = trigger || null;
    panel.hidden = false;
    void panel.offsetWidth;
    panel.classList.add('panel-visible');
    var body = panel.querySelector('.mw-body');
    if (body) body.scrollTop = 0;
    var heading = panel.querySelector('.section-title');
    if (heading) heading.focus();
    fireAchievementsOnce(name);
  }

  function closePanel(panel) {
    panel.classList.remove('panel-visible');
    setTimeout(function () { panel.hidden = true; }, 250);
    if (lastTrigger) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  }

  menuButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      openPanel(btn.getAttribute('data-panel'), btn);
    });
  });
  backButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = btn.closest('.view-panel');
      if (panel) closePanel(panel);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.view-panel.panel-visible');
    if (open) closePanel(open);
  });

  // ---- About photo carousel: prev/next buttons, dots, arrow keys ----
  document.querySelectorAll('[data-carousel]').forEach(function (gallery) {
    var slides = gallery.querySelectorAll('.about-slide');
    var dots = gallery.querySelector('.about-dots');
    var count = gallery.querySelector('[data-carousel-count]');
    var index = 0;
    slides.forEach(function () { dots.appendChild(document.createElement('span')); });
    gallery.classList.toggle('is-single', slides.length < 2);

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
      Array.prototype.forEach.call(dots.children, function (d, n) {
        d.classList.toggle('is-active', n === index);
      });
      count.textContent = (index + 1) + ' / ' + slides.length;
    }
    gallery.querySelector('[data-carousel-prev]').addEventListener('click', function () { show(index - 1); });
    gallery.querySelector('[data-carousel-next]').addEventListener('click', function () { show(index + 1); });
    document.addEventListener('keydown', function (e) {
      if (gallery.closest('.view-panel').hidden) return;
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    show(0);
  });

  // ---- Experience cards: hover/focus shows details; tap toggles on touch ----
  document.querySelectorAll('.exp-card').forEach(function (card) {
    card.addEventListener('click', function () { card.classList.toggle('is-open'); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('is-open'); }
    });
  });

  // ---- Achievement toasts: each window unlocks its own set once, the
  // first time it opens (stacked in the top-right corner). ----
  var toastContainer = document.getElementById('toast-container');
  var ACHIEVEMENTS = {
    about: ['Discover About Me', 'Marathoner', 'Ironman 70.3'],
    experience: ['Discover Experience'],
    projects: ['Discover Projects']
  };
  var achievementsFired = {};

  function showToast(title, delay) {
    setTimeout(function () {
      var toast = document.createElement('div');
      toast.className = 'achievement-toast';
      toast.innerHTML =
        '<span class="achievement-icon" aria-hidden="true"></span>' +
        '<span class="achievement-text">' +
        '<span class="achievement-label">Achievement Get!</span>' +
        '<span class="achievement-title">' + title + '</span>' +
        '</span>';
      toastContainer.appendChild(toast);
      void toast.offsetWidth;
      toast.classList.add('show');

      setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { toast.remove(); }, 450);
      }, 4200);
    }, delay);
  }

  function fireAchievementsOnce(name) {
    var list = ACHIEVEMENTS[name];
    if (!list || achievementsFired[name] || !toastContainer) return;
    achievementsFired[name] = true;
    list.forEach(function (title, i) { showToast(title, 250 + i * 550); });
  }

})();
