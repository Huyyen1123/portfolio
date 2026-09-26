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

  // ---- Rotations: the yellow splash, the nametag above the player and
  // the player's skin each step through their list in order -- one step
  // on every page load and one more every minute while the page is open.
  // Each remembers its place in localStorage, so a refresh continues the
  // cycle instead of restarting it. ----
  var ROTATE_EVERY_MS = 60 * 1000;
  function rotate(storageKey, items, apply) {
    var index = 0;
    try {
      var last = parseInt(localStorage.getItem(storageKey), 10);
      if (!isNaN(last)) index = (last + 1) % items.length;
    } catch (e) { /* storage blocked: start from the first item */ }
    function show() {
      apply(items[index]);
      try { localStorage.setItem(storageKey, String(index)); } catch (e) { /* ignore */ }
    }
    show();
    setInterval(function () {
      index = (index + 1) % items.length;
      show();
    }, ROTATE_EVERY_MS);
  }

  var splashEl = document.querySelector('.ts-splash');
  if (splashEl) {
    rotate('portfolio-splash-index',
      ['Software Engineer!!', 'IRONMAN!!', 'Vietnamese!!', '2005!!'],
      function (line) {
        splashEl.textContent = line;
        splashEl.style.setProperty('--splash-len', line.length);
      });
  }

  var nametagEl = document.querySelector('.ts-nametag');
  if (nametagEl) {
    rotate('portfolio-nametag-index', ['Wassup', 'Yo!', 'Hi'], function (tag) {
      nametagEl.textContent = tag;
    });
  }

  // js/player.js defines setPlayerSkin (it loads before this file).
  if (window.setPlayerSkin) {
    rotate('portfolio-skin-index', [
      'assets/images/player-skin/skin.png',
      'assets/images/player-skin/skin-streetwear.png',
      'assets/images/player-skin/skin-tailor.png'
    ], window.setPlayerSkin);
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

  // ---- Sound (all synthesized with Web Audio -- original, license-free,
  // no bundled audio files) ----
  // Effects play when Settings > Sound FX is on; the music is a generated
  // ambient piano loop that plays when Settings > Music is on. Browsers
  // only allow audio after a user gesture, so the context starts lazily.
  var audioCtx = null, sfxBus = null, musicBus = null;
  function getAudioCtx() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      sfxBus = audioCtx.createGain();
      sfxBus.gain.value = 0.5;
      sfxBus.connect(audioCtx.destination);
      // Music runs through a soft feedback echo for a roomy, calm tail.
      musicBus = audioCtx.createGain();
      musicBus.gain.value = 0;
      var echo = audioCtx.createDelay();
      echo.delayTime.value = 0.42;
      var feedback = audioCtx.createGain();
      feedback.gain.value = 0.35;
      var tone = audioCtx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2200;
      musicBus.connect(tone);
      tone.connect(audioCtx.destination);
      tone.connect(echo);
      echo.connect(feedback);
      feedback.connect(echo);
      echo.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // One enveloped oscillator note. start/len in seconds.
  function tone(dest, freq, start, len, type, vol, glideTo) {
    var ctx = audioCtx;
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    var t = ctx.currentTime + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + len);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }
  // A short burst of filtered noise (clicks, whooshes).
  function noise(start, len, freq, q, vol, sweepTo) {
    var ctx = audioCtx;
    var buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), gain = ctx.createGain();
    var t = ctx.currentTime + start;
    src.buffer = buf;
    filt.type = 'bandpass';
    filt.Q.value = q;
    filt.frequency.setValueAtTime(freq, t);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, t + len);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(sfxBus);
    src.start(t);
  }

  var SFX = {
    // Chunky "tock", like pressing a stone button.
    click: function () {
      tone(sfxBus, 190, 0, 0.09, 'triangle', 0.5, 95);
      noise(0, 0.05, 1800, 1.2, 0.35);
    },
    // Barely-there tick so hovering the menu feels alive.
    hover: function () { tone(sfxBus, 1250, 0, 0.035, 'sine', 0.06); },
    open: function () {
      tone(sfxBus, 523.25, 0.05, 0.14, 'triangle', 0.18);
      tone(sfxBus, 783.99, 0.12, 0.2, 'triangle', 0.18);
    },
    close: function () {
      tone(sfxBus, 783.99, 0, 0.12, 'triangle', 0.15);
      tone(sfxBus, 523.25, 0.07, 0.18, 'triangle', 0.15);
    },
    flip: function () { noise(0, 0.22, 500, 0.8, 0.22, 2600); },
    // Bright little fanfare for "Achievement Get!".
    achievement: function () {
      [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) {
        tone(sfxBus, f, i * 0.07, 0.35, 'square', 0.05);
        tone(sfxBus, f, i * 0.07, 0.5, 'sine', 0.12);
      });
    }
  };
  function playSfx(name) {
    if (!settings.sfx || !getAudioCtx()) return;
    SFX[name]();
  }

  document.querySelectorAll(
    '.ts-menu-btn, .ts-icon-btn, .ts-linkedin-btn, .ts-back-btn, .settings-toggle, .about-nav, .mw-wide-btn'
  ).forEach(function (el) {
    el.addEventListener('mouseenter', function () { if (audioCtx) playSfx('hover'); });
    el.addEventListener('click', function () { playSfx('click'); });
  });

  // ---- Music: a calm generated piano loop in a C418-ish mood. Picks slow
  // notes from a pentatonic scale over a four-chord cycle. ----
  var CHORDS = [
    [130.81, 196.0, 261.63],   // C
    [110.0, 164.81, 220.0],    // Am
    [87.31, 130.81, 174.61],   // F
    [98.0, 146.83, 196.0]      // G
  ];
  var MELODY = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
  var musicTimer = null, musicStep = 0;
  function piano(freq, start, vol) {
    tone(musicBus, freq, start, 3.2, 'sine', vol);
    tone(musicBus, freq * 2, start, 1.4, 'triangle', vol * 0.18);
  }
  function musicBar() {
    var chord = CHORDS[Math.floor(musicStep / 2) % CHORDS.length];
    if (musicStep % 2 === 0) chord.forEach(function (f, i) { piano(f, i * 0.12, 0.09); });
    var notes = 1 + Math.floor(Math.random() * 3);
    for (var n = 0; n < notes; n++) {
      if (Math.random() < 0.8) {
        piano(MELODY[Math.floor(Math.random() * MELODY.length)], 0.4 + n * (0.9 + Math.random() * 0.6), 0.06);
      }
    }
    musicStep++;
  }
  function startMusic() {
    if (musicTimer || !getAudioCtx()) return;
    musicBus.gain.cancelScheduledValues(audioCtx.currentTime);
    musicBus.gain.setTargetAtTime(0.9, audioCtx.currentTime, 0.8);
    musicBar();
    musicTimer = setInterval(musicBar, 3200);
  }
  function stopMusic() {
    if (!musicTimer) return;
    clearInterval(musicTimer);
    musicTimer = null;
    musicBus.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
  }
  function applyMusicState() {
    if (settings.music) startMusic(); else stopMusic();
  }
  // If Music was left on last visit, start it on the first click/key
  // (browsers block audio before any user gesture).
  function firstGesture() {
    document.removeEventListener('pointerdown', firstGesture);
    document.removeEventListener('keydown', firstGesture);
    if (settings.music) startMusic();
  }
  document.addEventListener('pointerdown', firstGesture);
  document.addEventListener('keydown', firstGesture);

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
    playSfx('open');
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
    playSfx('close');
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
    // Swipe left/right on the photo (phones).
    var frame = gallery.querySelector('.about-frame'), touchX = null;
    frame.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    frame.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    });
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
    card.addEventListener('mouseenter', function () { if (audioCtx) playSfx('flip'); });
    card.addEventListener('click', function () { playSfx('flip'); card.classList.toggle('is-open'); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('is-open'); }
    });
  });

  // ---- Achievement toasts: each window unlocks its own set once, the
  // first time it opens (stacked in the top-right corner). ----
  var toastContainer = document.getElementById('toast-container');
  var ACHIEVEMENTS = {
    about: ['Discover About Me', 'Marathon', 'IRONMAN'],
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
      playSfx('achievement');

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
