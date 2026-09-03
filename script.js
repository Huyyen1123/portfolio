(function () {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Loading screen -> titlescreen handoff ----
  var loadingScreen = document.getElementById('loading-screen');
  var titlescreen = document.getElementById('titlescreen');
  var BAR_FILL_MS = 2100; // must match the CSS animation-duration on .loading-bar-fill
  var SCREEN_FADE_MS = 500; // must match .loading-screen's own opacity transition

  // A short paced status readout instead of one static line -- three
  // beats stepping in time with the bar fill, each get an even share of
  // BAR_FILL_MS.
  var LOADING_LINES = ['Loading world...', 'Generating terrain...', 'Spawning player...'];
  var loadingLabel = document.getElementById('loading-label');

  if (loadingScreen && titlescreen) {
    if (reducedMotion) {
      loadingScreen.style.display = 'none';
      titlescreen.classList.add('visible');
    } else {
      if (loadingLabel) {
        var stageMs = BAR_FILL_MS / LOADING_LINES.length;
        LOADING_LINES.forEach(function (line, i) {
          if (i === 0) return; // already the label's default text
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

  // ---- Debug HUD (F3-style corner readout) ----
  var hudBiome = document.getElementById('hud-biome');
  var hudX = document.getElementById('hud-x');
  var hudZ = document.getElementById('hud-z');

  function setHudBiome(label) {
    if (hudBiome && label) hudBiome.textContent = label;
  }

  // Fake coordinates on a slow bounded random walk -- pure flavor, not
  // tied to anything real. Frozen at their starting value under reduced
  // motion instead of ticking.
  if (hudX && hudZ && !reducedMotion) {
    var coordX = 0, coordZ = 0;
    setInterval(function () {
      coordX += Math.floor(Math.random() * 7) - 3; // -3..3
      coordZ += Math.floor(Math.random() * 7) - 3;
      coordX = Math.max(-256, Math.min(256, coordX));
      coordZ = Math.max(-256, Math.min(256, coordZ));
      hudX.textContent = String(coordX);
      hudZ.textContent = String(coordZ);
    }, 1800);
  }

  // ---- Motion toggle (top-right icon) ----
  // A manual, persistent override -- independent of the OS-level
  // prefers-reduced-motion setting -- that pauses the ambient particle
  // drift and splash pulse. Remembered across visits.
  var motionToggle = document.getElementById('motion-toggle');
  if (motionToggle) {
    var motionOff = false;
    try { motionOff = localStorage.getItem('portfolio-motion-off') === 'true'; } catch (e) { /* ignore */ }
    applyMotionState(motionOff);

    motionToggle.addEventListener('click', function () {
      motionOff = !motionOff;
      applyMotionState(motionOff);
      try { localStorage.setItem('portfolio-motion-off', String(motionOff)); } catch (e) { /* ignore */ }
    });
  }
  function applyMotionState(off) {
    document.documentElement.classList.toggle('motion-off', off);
    if (motionToggle) motionToggle.setAttribute('aria-pressed', String(off));
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

  // Tracks whichever menu button opened the currently-visible panel, so
  // Back can hand keyboard focus back to it instead of dropping focus to
  // <body> (the titlescreen it lives on goes display:none while a panel
  // is open, which detaches focus from whatever had it).
  var lastTrigger = null;

  function openPanel(name, trigger) {
    var panel = panels[name];
    if (!panel) return;
    lastTrigger = trigger || null;
    if (titlescreen) titlescreen.classList.add('ts-hidden');
    panel.hidden = false;
    void panel.offsetWidth; // force reflow so the opacity transition actually plays
    panel.classList.add('panel-visible');
    panel.scrollTop = 0;
    // Move focus into the new panel (its heading is the natural landing
    // spot) so keyboard/screen-reader users aren't left on a focus target
    // that just went display:none.
    var heading = panel.querySelector('.section-title');
    if (heading) heading.focus();
    setHudBiome(panel.getAttribute('data-biome'));
    if (name === 'about') fireAchievementsOnce();
  }

  function closePanel(panel) {
    panel.classList.remove('panel-visible');
    if (titlescreen) titlescreen.classList.remove('ts-hidden');
    setTimeout(function () { panel.hidden = true; }, 400); // matches .view-panel's opacity transition
    if (titlescreen) setHudBiome(titlescreen.getAttribute('data-biome'));
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
