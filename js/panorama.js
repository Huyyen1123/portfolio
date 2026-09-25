/* ---- Three.js cubemap panorama (Minecraft-title-screen style) ----
   Renders the six panorama_N.webp faces as a scene.background CubeTexture
   and slowly rotates the CAMERA in place -- the standard "look around
   inside a skybox" technique. Because a cubemap is sampled by view
   direction, this can never expose an edge or seam the way panning a
   flat image can; it only fails to look right if the six source images
   themselves don't tile correctly, which is outside this script's
   control.

   The six faces are the "Cherry Blossom Panorama" resource pack by
   BlueHDGaming (see assets/images/panorama/README.md for the license --
   it requires credit + a link to the pack's Modrinth page wherever this
   site is shown publicly, and restricts redistributing the raw files).
   Face order/orientation was verified by comparing actual pixel edges
   between faces, not by trusting filenames -- see the CUBE_FACES mapping
   below and the project chat history for the edge-matching data.

   If assets/images/panorama/panorama_0.webp..panorama_5.webp ever go
   missing (renamed, deleted, license taken down), CubeTextureLoader's
   onError fires and this script leaves the existing <video class="ts-bg">
   exactly as it was -- no fake scenery, no placeholder gradient, nothing
   rendered by this file at all.

   Production files here are 1024x1024 WebP, re-encoded from the 2048x2048
   PNG originals kept in assets/images/panorama-originals/ (not served --
   source of truth if these ever need reprocessing). Same pixels, same
   orientation, just resized + recompressed for web delivery: 23MB -> under
   1MB total. See that folder's README for the resize/quality choice and
   how it was visually verified. */
(function () {
  'use strict';

  var CUBE_FACES = [
    'assets/images/panorama/panorama_0.webp', // +X (right)
    'assets/images/panorama/panorama_1.webp', // -X (left)
    'assets/images/panorama/panorama_2.webp', // +Y (top)
    'assets/images/panorama/panorama_3.webp', // -Y (bottom)
    'assets/images/panorama/panorama_4.webp', // +Z (front)
    'assets/images/panorama/panorama_5.webp'  // -Z (back)
  ];

  var ROTATION_PERIOD_SEC = 75;   // one full 360deg yaw sweep (60-90s target)
  var PITCH_AMPLITUDE_DEG = 1.1;  // barely-there vertical sway, not a nod
  var PITCH_PERIOD_SEC = 47;      // deliberately not a clean multiple of the yaw period
  var LOAD_TIMEOUT_MS = 6000;     // onError doesn't always fire for every failure mode
  var MAX_DELTA_SEC = 0.25;       // clamp huge deltas from a backgrounded tab

  var host, canvas, renderer, scene, camera, bgVideo;
  var yaw = 0;
  var lastFrameTime = null;
  var rafId = null;
  var running = false;
  var reducedMotion = false;
  var active = false; // true once the cubemap has successfully loaded

  function reducedMotionNow() {
    // main.js keeps <html class="motion-off"> in sync with both the OS
    // prefers-reduced-motion setting and the site's own Settings toggle --
    // reading that one class covers both without duplicating the logic.
    return document.documentElement.classList.contains('motion-off');
  }

  function onResize() {
    if (!renderer || !camera) return;
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate(now) {
    if (!running) return;
    rafId = requestAnimationFrame(animate);

    if (lastFrameTime === null) lastFrameTime = now;
    var delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    if (delta > MAX_DELTA_SEC) delta = MAX_DELTA_SEC;

    if (!reducedMotion) {
      yaw += (Math.PI * 2 / ROTATION_PERIOD_SEC) * delta;
      if (yaw > Math.PI * 2) yaw -= Math.PI * 2;
      var pitch = (PITCH_AMPLITUDE_DEG * Math.PI / 180) *
        Math.sin((now / 1000) * (Math.PI * 2 / PITCH_PERIOD_SEC));
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    lastFrameTime = null;
    rafId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function revertToVideoFallback() {
    active = false;
    stop();
    if (host) host.classList.remove('ts-panorama-visible');
    if (bgVideo) { bgVideo.play().catch(function () {}); }
  }

  function activatePanorama(cubeTexture) {
    active = true;
    scene.background = cubeTexture;
    reducedMotion = reducedMotionNow();
    onResize();
    host.classList.add('ts-panorama-visible');
    if (bgVideo) bgVideo.pause();
    start();
  }

  function init() {
    host = document.getElementById('ts-panorama-host');
    bgVideo = document.getElementById('ts-bg-video');
    if (!host || typeof THREE === 'undefined') return; // stay on the video, silently

    try {
      canvas = document.createElement('canvas');
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);
      camera.position.set(0, 0, 0);
      camera.rotation.order = 'YXZ';
    } catch (e) {
      return; // no WebGL -- video fallback stays exactly as it was
    }

    host.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      revertToVideoFallback();
    });

    var settled = false;
    var timeoutId = setTimeout(function () { settled = true; }, LOAD_TIMEOUT_MS);

    try {
      new THREE.CubeTextureLoader().load(
        CUBE_FACES,
        function onLoad(cubeTexture) {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          activatePanorama(cubeTexture);
        },
        undefined,
        function onError() {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          // Cube faces missing/unreadable -- leave the video exactly as-is.
        }
      );
    } catch (e) {
      settled = true;
      clearTimeout(timeoutId);
      return;
    }

    window.addEventListener('resize', onResize);

    var observer = new MutationObserver(function () {
      reducedMotion = reducedMotionNow();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    reducedMotion = reducedMotionNow();

    document.addEventListener('visibilitychange', function () {
      if (!active) return;
      if (document.hidden) stop();
      else start();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
