/* ---- Bottom-left player: Huy's Minecraft skin on a real player model ----
   Renders one of Huy's skins in assets/images/player-skin/ (standard 64x64
   skins, classic 4px arms) onto the Minecraft player model -- head 8x8x8, body
   8x12x4, arms/legs 4x12x4, plus the overlay layer as slightly inflated
   boxes -- facing straight forward, arms at its sides. Faces use
   Minecraft's own flat per-face brightness (baked into vertex colours)
   so it reads as in-game, not as a smooth 3D render.

   The head turns to look at the mouse (pivoting at the neck) and the body
   turns a little with it, like the player on Minecraft's title screen,
   easing back to facing forward when the mouse leaves the window. All of
   that stops under <html class="motion-off"> (Settings > Reduce Motion or
   the OS setting). If WebGL or the skin fails, the flat avatar images
   already inside .ts-sprite stay visible.

   window.setPlayerSkin(url) swaps the skin; js/main.js uses it to rotate
   through the skins on each load and every minute. */
(function () {
  'use strict';

  var DEFAULT_SKIN = 'assets/images/player-skin/skin.png';
  var HEAD_YAW_MAX = 0.75;    // radians the head can turn left/right
  var HEAD_PITCH_MAX = 0.45;  // radians it can tilt up/down
  var BODY_FOLLOW = 0.35;     // share of the head's turn the body follows

  // Minecraft's fixed face brightness: +x/-x sides, top, bottom, front, back.
  var SHADE = [0.72, 0.72, 1.0, 0.5, 0.96, 0.8];

  var host = document.querySelector('.ts-player-corner .ts-sprite');
  if (!host || typeof THREE === 'undefined') return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var canvas = renderer.domElement;
  canvas.className = 'ts-sprite-canvas';

  var scene = new THREE.Scene();
  // Slightly above the player, looking straight at it: the top of the
  // head shows a sliver of depth, the rest is square to the viewer.
  var camera = new THREE.PerspectiveCamera(15, 1, 1, 500);
  camera.position.set(0, 23.2, 128);
  camera.lookAt(0, 15.4, 0);

  // Face UV rects for a Minecraft box at skin offset (u, v) with size
  // (w, h, d), in BoxGeometry's face order: +x, -x, +y, -y, +z, -z.
  // The model faces +z, so -x is the character's right side.
  function faceRects(u, v, w, h, d) {
    return [
      [u + d + w, v + d, d, h],
      [u, v + d, d, h],
      [u + d, v, w, d],
      [u + d + w, v, w, d],
      [u + d, v + d, w, h],
      [u + 2 * d + w, v + d, w, h]
    ];
  }

  function makeBox(tex, w, h, d, u, v, inflate, overlay) {
    var geo = new THREE.BoxGeometry(w + inflate * 2, h + inflate * 2, d + inflate * 2);
    var uv = geo.attributes.uv;
    var rects = faceRects(u, v, w, h, d);
    var colors = [];
    for (var f = 0; f < 6; f++) {
      var r = rects[f];
      var x0 = r[0] / 64, x1 = (r[0] + r[2]) / 64;
      var y0 = 1 - r[1] / 64, y1 = 1 - (r[1] + r[3]) / 64;
      // BoxGeometry's 4 verts per face: top-left, top-right, bottom-left, bottom-right.
      uv.setXY(f * 4 + 0, x0, y0);
      uv.setXY(f * 4 + 1, x1, y0);
      uv.setXY(f * 4 + 2, x0, y1);
      uv.setXY(f * 4 + 3, x1, y1);
      for (var k = 0; k < 4; k++) colors.push(SHADE[f], SHADE[f], SHADE[f]);
    }
    uv.needsUpdate = true;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tex,
      vertexColors: true,
      transparent: overlay,
      alphaTest: overlay ? 0.5 : 0,
      side: overlay ? THREE.DoubleSide : THREE.FrontSide
    }));
  }

  // One body part: its base box plus the overlay box around it. (x, y) is
  // the part's pivot and oy offsets the boxes from it, so the head turns
  // at the neck; units are skin pixels with the feet at y = 0.
  function part(tex, p) {
    var g = new THREE.Group();
    g.position.set(p.x, p.y, 0);
    var base = makeBox(tex, p.w, p.h, p.d, p.u, p.v, 0, false);
    var over = makeBox(tex, p.w, p.h, p.d, p.ou, p.ov, p.inflate, true);
    base.position.y = over.position.y = p.oy || 0;
    g.add(base);
    g.add(over);
    return g;
  }

  var model, head;
  var target = { yaw: 0, pitch: 0 }, look = { yaw: 0, pitch: 0 };
  var animating = false;

  function motionOff() {
    return document.documentElement.classList.contains('motion-off');
  }

  function resize() {
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  // Eases the look toward the target; stops looping once it arrives.
  function frame() {
    if (motionOff()) { target.yaw = target.pitch = 0; }
    look.yaw += (target.yaw - look.yaw) * 0.15;
    look.pitch += (target.pitch - look.pitch) * 0.15;
    model.rotation.y = look.yaw * BODY_FOLLOW;
    head.rotation.y = look.yaw * (1 - BODY_FOLLOW);
    head.rotation.x = look.pitch;
    renderer.render(scene, camera);
    if (Math.abs(target.yaw - look.yaw) + Math.abs(target.pitch - look.pitch) > 0.001) {
      requestAnimationFrame(frame);
    } else {
      animating = false;
    }
  }
  function kick() {
    if (!animating) { animating = true; requestAnimationFrame(frame); }
  }

  function aimAt(clientX, clientY) {
    if (motionOff()) return;
    // Direction from the character's eyes to the cursor, scaled so the
    // head reaches its limit around the far side of the screen.
    var r = canvas.getBoundingClientRect();
    var dx = (clientX - (r.left + r.width / 2)) / window.innerWidth;
    var dy = (clientY - (r.top + r.height * 0.12)) / window.innerHeight;
    target.yaw = Math.max(-HEAD_YAW_MAX, Math.min(HEAD_YAW_MAX, dx * 1.5));
    target.pitch = Math.max(-HEAD_PITCH_MAX, Math.min(HEAD_PITCH_MAX, dy * 1.1));
    kick();
  }

  function loadSkin(url, done) {
    new THREE.TextureLoader().load(url, function (tex) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      done(tex);
    });
  }

  // Swapping skins reuses the model: only each mesh's texture changes.
  var wantedSkin = null, builtWith = null;
  window.setPlayerSkin = function (url) {
    wantedSkin = url;
    if (!model || url === builtWith) return;
    loadSkin(url, function (tex) {
      if (wantedSkin !== url) { tex.dispose(); return; }
      var old = null;
      model.traverse(function (o) {
        if (o.isMesh) { old = o.material.map; o.material.map = tex; o.material.needsUpdate = true; }
      });
      if (old && old !== tex) old.dispose();
      builtWith = url;
      renderer.render(scene, camera);
    });
  };

  // Wait until every script has run, so main.js has already picked this
  // load's skin and the default never flashes first.
  function start() {
    loadSkin(wantedSkin || DEFAULT_SKIN, function (tex) {
      builtWith = wantedSkin || DEFAULT_SKIN;
      model = new THREE.Group();
      head = part(tex, { x: 0, y: 24, oy: 4, w: 8, h: 8, d: 8, u: 0, v: 0, ou: 32, ov: 0, inflate: 0.5 });
      model.add(head);
      [
        { x: 0, y: 18, w: 8, h: 12, d: 4, u: 16, v: 16, ou: 16, ov: 32, inflate: 0.25 }, // body
        { x: -6, y: 18, w: 4, h: 12, d: 4, u: 40, v: 16, ou: 40, ov: 32, inflate: 0.25 }, // right arm
        { x: 6, y: 18, w: 4, h: 12, d: 4, u: 32, v: 48, ou: 48, ov: 48, inflate: 0.25 },  // left arm
        { x: -2, y: 6, w: 4, h: 12, d: 4, u: 0, v: 16, ou: 0, ov: 32, inflate: 0.25 },    // right leg
        { x: 2, y: 6, w: 4, h: 12, d: 4, u: 16, v: 48, ou: 0, ov: 48, inflate: 0.25 }     // left leg
      ].forEach(function (p) { model.add(part(tex, p)); });
      scene.add(model);

      host.appendChild(canvas);
      host.classList.add('ts-sprite-3d');
      resize();
      window.addEventListener('resize', resize);
      document.addEventListener('mousemove', function (e) { aimAt(e.clientX, e.clientY); });
      document.addEventListener('touchstart', function (e) {
        if (e.touches[0]) aimAt(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      document.documentElement.addEventListener('mouseleave', function () {
        target.yaw = target.pitch = 0;
        kick();
      });
      // A skin requested while the first one was still loading.
      if (wantedSkin && wantedSkin !== builtWith) window.setPlayerSkin(wantedSkin);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
