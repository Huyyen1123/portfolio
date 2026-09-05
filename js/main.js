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

  // ---- Player-sprite head: subtle mouse-follow, restrained ----
  // Skips entirely under reduced motion. A few px of translation only --
  // the sprite stays anchored in its corner, just the head drifts.
  var playerHead = document.querySelector('.ts-player-corner .pf-head');
  if (playerHead) {
    document.addEventListener('mousemove', function (e) {
      if (settings.motion) return;
      var nx = (e.clientX / window.innerWidth - 0.5) * 2;
      var ny = (e.clientY / window.innerHeight - 0.5) * 2;
      playerHead.style.transform = 'translate(' + (nx * 3).toFixed(1) + 'px, ' + (ny * 2).toFixed(1) + 'px)';
    });
  }

  // ---- View-swapping: menu buttons open a full-screen panel instead of
  // scrolling to a section; each panel's Back button returns to the
  // titlescreen. GitHub is a real link (target=_blank), not part of this. ----
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
    if (titlescreen) titlescreen.classList.add('ts-hidden');
    panel.hidden = false;
    void panel.offsetWidth;
    panel.classList.add('panel-visible');
    panel.scrollTop = 0;
    var heading = panel.querySelector('.section-title');
    if (heading) heading.focus();
    if (name === 'about') fireAchievementsOnce();
  }

  function closePanel(panel) {
    panel.classList.remove('panel-visible');
    if (titlescreen) titlescreen.classList.remove('ts-hidden');
    setTimeout(function () { panel.hidden = true; }, 400);
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

  // ---- Achievement toasts: fire once, the first time the About panel opens ----
  var toastContainer = document.getElementById('toast-container');
  var ACHIEVEMENTS = ['Marathoner', 'Half Ironman Finisher'];
  var achievementsFired = false;

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

  function fireAchievementsOnce() {
    if (achievementsFired || !toastContainer) return;
    achievementsFired = true;
    showToast(ACHIEVEMENTS[0], 0);
    showToast(ACHIEVEMENTS[1], 550);
  }

  // ---- Inventory tooltips: tap-to-toggle for touch, not just hover ----
  var invSlots = document.querySelectorAll('.inv-slot:not(.inv-slot-locked)');
  var invTriggers = document.querySelectorAll('.inv-trigger');
  invTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var slot = trigger.closest('.inv-slot');
      var alreadyActive = slot.classList.contains('tooltip-active');
      invSlots.forEach(function (s) { s.classList.remove('tooltip-active'); });
      if (!alreadyActive) slot.classList.add('tooltip-active');
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.inv-slot')) {
      invSlots.forEach(function (s) { s.classList.remove('tooltip-active'); });
    }
  });
})();
