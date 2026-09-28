/* Ariana: rig 2D con capas, malla deformable y cinemática de articulaciones.
 * Sin dependencias ni servicios externos. La ilustración original no se mueve
 * como un bloque: cada vértice recibe pesos de cuello, torso, brazo y cabello.
 */
(() => {
  'use strict';
  const cfg = window.ARIANA_RIG;
  const stage = document.querySelector('[data-ariana]');
  if (!cfg || !stage) return;
  const canvas = stage.querySelector('canvas');
  const fallback = stage.querySelector('.ariana-fallback');
  const status = document.getElementById('arianaStatus');
  const pauseButton = document.getElementById('arianaPause');
  const greetButton = document.getElementById('arianaGreet');
  const hero = document.querySelector('.hero');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const debugMode = new URLSearchParams(location.search).has('rig');
  const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rad = Math.PI / 180;
  const rotate = (p, origin, angle) => {
    const a = angle * rad, x = p[0] - origin[0], y = p[1] - origin[1];
    return [origin[0] + x * Math.cos(a) - y * Math.sin(a), origin[1] + x * Math.sin(a) + y * Math.cos(a)];
  };
  const blendPoint = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const state = {
    ready: false, paused: motionQuery.matches, reduced: motionQuery.matches,
    visible: true, time: 0, x: 0, y: 0, headX: 0, headY: 0, bodyX: 0, hairX: 0,
    eyeX: 0, eyeY: 0, targetX: 0, targetY: 0, lastInput: -100,
    waveStart: -100, blinkStart: -100, nextBlink: 2.3, blink: 0,
    hover: 0, hoverTarget: 0, greet: 0, pointer: false, debugPose: null
  };
  let raf = 0, lastFrame = 0, rect, gl, program, positionBuffer, uvBuffer, indexBuffer;
  let layers = [], eyes = [], source, layerImages, sourcePoints, positions, texcoords;
  let indexCount = 0, debugUI, lost = false;

  function fail() {
    state.ready = false;
    stage.classList.remove('is-ready');
    stage.classList.add('is-static');
    status.textContent = 'Ariana · AR Creaciones';
    pauseButton.hidden = true;
    greetButton.hidden = true;
    stage.disabled = true;
    stage.setAttribute('aria-label', 'Ilustración de Ariana de AR Creaciones');
    cancelAnimationFrame(raf); raf = 0;
  }

  function shader(type, code) {
    const s = gl.createShader(type);
    gl.shaderSource(s, code); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function initGL() {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL unavailable');
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec2 position; attribute vec2 uv;
      uniform vec2 resolution; varying vec2 vUV;
      void main() { vUV = uv; vec2 p = position / resolution * 2.0 - 1.0;
        gl_Position = vec4(p.x, -p.y, 0.0, 1.0); }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision mediump float; uniform sampler2D picture; varying vec2 vUV;
      void main() { gl_FragColor = texture2D(picture, vUV); }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, 'resolution'), cfg.viewport.width, cfg.viewport.height);
    gl.uniform1i(gl.getUniformLocation(program, 'picture'), 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    positionBuffer = gl.createBuffer(); uvBuffer = gl.createBuffer(); indexBuffer = gl.createBuffer();
    const pos = gl.getAttribLocation(program, 'position'), uv = gl.getAttribLocation(program, 'uv');
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer); gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
  }

  function texture(image) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return t;
  }

  function createLayers() {
    // Máscaras excluyentes: ningún rostro, brazo ni pelo queda dibujado por
    // segunda vez en el torso. Las texturas comparten el mismo espacio UV.
    const taken = makeCanvas(cfg.width, cfg.height), tc = taken.getContext('2d');
    layers = [];
    for (const info of cfg.layers) {
      const c = makeCanvas(cfg.width, cfg.height), ctx = c.getContext('2d');
      const path = new Path2D(info.path);
      if (layerImages) ctx.drawImage(layerImages[info.id],0,0);
      else {
        ctx.save(); ctx.clip(path); ctx.drawImage(source, 0, 0); ctx.restore();
        ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(taken, 0, 0);
      }
      layers.push({ ...info, texture: texture(c), canvas: c, enabled: true });
      tc.fill(path);
    }
    const c = makeCanvas(cfg.width, cfg.height), ctx = c.getContext('2d');
    if (layerImages) ctx.drawImage(layerImages.torso,0,0);
    else {ctx.drawImage(source, 0, 0); ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(taken, 0, 0);}
    layers.push({ id: 'torso', name: 'Torso y brazo en reposo', texture: texture(c), canvas: c, enabled: true });
    layers.reverse();
    // Ojos: se conserva el iris original, con una abertura que recorta la
    // pupila y un párpado dibujado dentro del mismo plano de la cabeza.
    eyes = cfg.eyes.map(info => {
      const c = makeCanvas(info.box[2], info.box[3]);
      const iris = makeCanvas(info.radius * 2 + 4, info.radius * 2 + 4);
      const ic = iris.getContext('2d'), r = info.radius;
      ic.beginPath(); ic.arc(r + 2, r + 2, r, 0, Math.PI * 2); ic.clip();
      ic.drawImage(source, info.center[0] - r - 2, info.center[1] - r - 2, iris.width, iris.height, 0, 0, iris.width, iris.height);
      return { ...info, canvas: c, ctx: c.getContext('2d'), iris, texture: texture(c), openingPath: new Path2D(info.opening) };
    });
  }

  function makeMesh() {
    const points = [], uv = [], indices = [];
    const cols=Math.ceil(cfg.width/cfg.meshStep), rows=Math.ceil(cfg.height/cfg.meshStep);
    for (let row=0;row<=rows;row++) {
      for (let col=0;col<=cols;col++) {
        const x=Math.min(col*cfg.meshStep,cfg.width),y=Math.min(row*cfg.meshStep,cfg.height);
        points.push(x,y);uv.push(x/cfg.width,y/cfg.height);
        if(row<rows && col<cols) {
          const i=row*(cols+1)+col;indices.push(i,i+1,i+cols+1,i+cols+1,i+1,i+cols+2);
        }
      }
    }
    sourcePoints = new Float32Array(points); positions = new Float32Array(points.length);
    texcoords = new Float32Array(uv); indexCount = indices.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    // No rasterizar los grandes rectángulos transparentes de cada PNG.
    // Se conservan sólo las celdas que contienen pintura y sus vecinas.
    for(const layer of layers) {
      const pixels=layer.canvas.getContext('2d').getImageData(0,0,cfg.width,cfg.height).data;
      const occupied=new Uint8Array(cols*rows), active=[];
      for(let y=0;y<cfg.height;y++) for(let x=0;x<cfg.width;x++) {
        if(pixels[(y*cfg.width+x)*4+3]) occupied[Math.floor(y/cfg.meshStep)*cols+Math.floor(x/cfg.meshStep)]=1;
      }
      for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
        let hasPaint=false;
        for(let yy=Math.max(0,row-1);yy<=Math.min(rows-1,row+1);yy++)
          for(let xx=Math.max(0,col-1);xx<=Math.min(cols-1,col+1);xx++) hasPaint ||= !!occupied[yy*cols+xx];
        if(hasPaint) {const i=row*(cols+1)+col;active.push(i,i+1,i+cols+1,i+cols+1,i+1,i+cols+2);}
      }
      layer.indexBuffer=gl.createBuffer();layer.indexCount=active.length;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,layer.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(active),gl.STATIC_DRAW);
    }
  }

  function pose() {
    const l = cfg.limits;
    const waveTime = state.time - state.waveStart;
    const wave = waveTime >= 0 && waveTime < 2.25 ? Math.sin(Math.PI * waveTime / 2.25) : 0;
    const wag = Math.sin(waveTime * 11) * wave;
    return {
      head: state.headX * l.head - state.headY * .65 - wave * 1.1,
      tx: state.headX * 6, ty: state.headY * 5 + wave * 1.6,
      torso: state.bodyX * l.torso,
      breath: state.paused ? 0 : Math.sin(state.time * Math.PI * 2 / 4.7),
      shoulder: -state.bodyX * l.shoulder - state.hover * .7 - wave * .8,
      elbow: -state.headX * l.elbow - state.hover * 3.5 - wave * 3.5,
      wrist: state.headX * l.wrist + wag * 8,
      hair: (state.hairX - state.headX) * 8 + (state.paused ? 0 : Math.sin(state.time * 1.7) * .55),
      wave
    };
  }

  function deform(x, y, p) {
    // Pesos suaves: la parte inferior permanece anclada. El cuello mezcla
    // la rotación rígida de la cabeza con el torso sin abrir una costura.
    const bodyWeight = 1 - smooth(890, 1125, y);
    let q = rotate([x, y], cfg.bones.waist, p.torso * bodyWeight);
    q[1] -= p.breath * 2.15 * bodyWeight;
    const headWeight = 1 - smooth(392, 557, y);
    let h = rotate(q, cfg.bones.neck, p.head);
    h[0] += p.tx; h[1] += p.ty;
    q = blendPoint(q, h, headWeight);

    // Cadena hombro → codo → muñeca. Las influencias se desvanecen en
    // las uniones y nunca aplican una traslación al personaje completo.
    const arm = smooth(578, 712, x) * smooth(444, 535, y);
    const forearm = smooth(616, 713, x) * (1 - smooth(816, 971, y));
    const hand = smooth(665, 749, x) * (1 - smooth(716, 827, y));
    let a = rotate(q, cfg.bones.wrist, p.wrist * hand);
    a = rotate(a, cfg.bones.elbow, p.elbow * forearm);
    a = rotate(a, cfg.bones.shoulder, p.shoulder);
    q = blendPoint(q, a, arm);

    // Inercia únicamente en las mechas; el rostro queda rígido.
    const left = Math.exp(-Math.pow((x - (231 - (y - 310) * .11)) / 43, 2));
    const right = Math.exp(-Math.pow((x - (545 - (y - 310) * .1)) / 33, 2));
    const hairWeight = Math.max(left, right) * smooth(290, 440, y) * (1 - smooth(570, 726, y));
    q[0] += p.hair * hairWeight; q[1] += Math.abs(p.hair) * .18 * hairWeight;
    return [q[0] + cfg.viewport.x, q[1] + cfg.viewport.y];
  }

  function drawEye(eye, p) {
    const ctx = eye.ctx, [x,y,w,h] = eye.box;
    ctx.clearRect(0,0,w,h); ctx.save(); ctx.translate(-x,-y);
    ctx.drawImage(source, 0, 0);
    ctx.save(); ctx.clip(eye.openingPath);
    const white = ctx.createLinearGradient(0,y+9,0,y+h);
    white.addColorStop(0,'#846a63'); white.addColorStop(.58,'#cdbfbb'); white.addColorStop(1,'#e3d8d0');
    ctx.fillStyle = white; ctx.fillRect(x,y,w,h);
    const r = eye.radius;
    ctx.drawImage(eye.iris, eye.center[0]-r-2+state.eyeX*cfg.limits.pupilX, eye.center[1]-r-2+state.eyeY*cfg.limits.pupilY);
    // El saludo incluye un guiño breve, además del parpadeo normal.
    const waveTime = state.time - state.waveStart;
    const wink = eye.name === 'right' && waveTime > .32 && waveTime < .56 ? Math.sin((waveTime-.32)/.24*Math.PI) : 0;
    const blink = Math.max(state.blink, wink);
    ctx.restore();

    ctx.restore();
    gl.bindTexture(gl.TEXTURE_2D, eye.texture);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,eye.canvas);
    // Malla local del párpado: comprime el ojo y sus pestañas en su propio
    // eje, mientras la piel circundante se estira. No se pinta piel artificial.
    const points=[], uvs=[];
    const step=blink>.001?3:Math.max(w,h);
    for(let yy=0;yy<h;yy+=step) for(let xx=0;xx<w;xx+=step) {
      const x1=Math.min(xx+step,w),y1=Math.min(yy+step,h);
      for(const [u,v] of [[xx,yy],[x1,yy],[xx,y1],[xx,y1],[x1,yy],[x1,y1]]) {
        let q=[x+u,y+v];
        if(blink>.001) {
          const local=rotate(q,eye.center,-eye.angle);
          const ex=local[0]-eye.center[0],ey=local[1]-eye.center[1];
          const edge=smooth(0,5,Math.min(u,v,w-u,h-v));
          const weight=(1-smooth(27,44,Math.abs(ex)))*(1-smooth(10,25,Math.abs(ey)))*edge;
          local[1]=eye.center[1]+ey*(1-blink*.985*weight);
          q=rotate(local,eye.center,eye.angle);
        }
        points.push(...deform(q[0],q[1],p));uvs.push(u/w,v/h);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uvs),gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES,0,points.length/2);
  }

  function render() {
    if (!state.ready || lost) return;
    const p = pose();
    for(let i=0;i<sourcePoints.length;i+=2) {
      const q=deform(sourcePoints[i],sourcePoints[i+1],p); positions[i]=q[0]; positions[i+1]=q[1];
    }
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer); gl.bufferData(gl.ARRAY_BUFFER,positions,gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer); gl.bufferData(gl.ARRAY_BUFFER,texcoords,gl.DYNAMIC_DRAW);
    // Sumar las particiones evita costuras en sus bordes suavizados.
    gl.blendFunc(gl.ONE,gl.ONE);
    for (const layer of layers) {
      if (!layer.enabled) continue;
      gl.bindTexture(gl.TEXTURE_2D,layer.texture);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,layer.indexBuffer);
      gl.drawElements(gl.TRIANGLES,layer.indexCount,gl.UNSIGNED_SHORT,0);
    }
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    if (layers.find(l=>l.id==='head')?.enabled) for (const eye of eyes) drawEye(eye,p);
    if(debugUI) drawDebug(p);
  }

  function tick(now) {
    raf=0;
    if (!state.ready || state.paused || !state.visible || document.hidden || lost) return;
    const dt=Math.min((now-lastFrame)/1000 || 1/60,.1); lastFrame=now; state.time+=dt;
    let tx=state.targetX, ty=state.targetY;
    if (state.time-state.lastInput>4.5 && !state.pointer) {
      tx=Math.sin(state.time*.42)*.23; ty=Math.sin(state.time*.33)*.12;
    }
    if(state.debugPose) { tx=state.debugPose[0]; ty=state.debugPose[1]; }
    const ease=(v,t,s)=>mix(v,t,1-Math.exp(-s*dt));
    state.eyeX=ease(state.eyeX,tx,18); state.eyeY=ease(state.eyeY,ty,18);
    state.headX=ease(state.headX,tx,7); state.headY=ease(state.headY,ty,7);
    state.bodyX=ease(state.bodyX,tx,3.4); state.hairX=ease(state.hairX,state.headX,2.4);
    state.hover=ease(state.hover,state.hoverTarget,5);
    if(state.time>=state.nextBlink) {
      state.blinkStart=state.time; state.nextBlink=state.time+3+Math.random()*3.8;
    }
    const bt=state.time-state.blinkStart;
    state.blink=bt>=0 && bt<.19 ? Math.sin(bt/.19*Math.PI) : 0;
    render(); raf=requestAnimationFrame(tick);
  }
  function start() {
    if(!raf && state.ready && !state.paused && state.visible && !document.hidden && !lost) {
      lastFrame=performance.now(); raf=requestAnimationFrame(tick);
    }
  }
  function stop() { cancelAnimationFrame(raf); raf=0; }
  function refreshRect() { rect=canvas.getBoundingClientRect(); }
  function resize() {
    refreshRect();
    const dpr=Math.min(devicePixelRatio || 1,1.75);
    canvas.width=Math.max(1,Math.round(rect.width*dpr)); canvas.height=Math.max(1,Math.round(rect.height*dpr));
    if(gl && !lost) { gl.viewport(0,0,canvas.width,canvas.height); render(); }
  }
  function lookAt(x,y) {
    if(!rect || state.paused) return;
    const hx=rect.left+rect.width*(430+cfg.viewport.x)/cfg.viewport.width;
    const hy=rect.top+rect.height*(248+cfg.viewport.y)/cfg.viewport.height;
    state.targetX=clamp((x-hx)/Math.max(rect.width*.72,innerWidth*.38));
    state.targetY=clamp((y-hy)/Math.max(rect.height*.55,200));
    state.lastInput=state.time;
  }
  function greet() {
    if(!state.ready || state.paused) return;
    if(state.time-state.waveStart<.65) return;
    state.waveStart=state.time; state.lastInput=state.time;
    status.textContent='¡Hola! ¿Creamos algo juntas?';
    clearTimeout(greet.restoreText);
    greet.restoreText=setTimeout(updateLabel,2600);
  }
  function updateLabel() {
    stage.disabled=state.paused;
    pauseButton.setAttribute('aria-pressed',String(state.paused));
    pauseButton.setAttribute('aria-label',state.paused?'Activar movimiento de Ariana':'Pausar movimiento de Ariana');
    pauseButton.textContent=state.paused?'Activar movimiento':'Pausar';
    status.textContent=state.paused?'Ariana · Animación en pausa':matchMedia('(pointer: coarse)').matches?'Tocá a Ariana para saludar':'Mové el cursor. Ariana te sigue.';
    greetButton.disabled=state.paused;
  }
  function setPaused(value) {
    state.paused=value; stage.classList.toggle('is-paused',value);
    if(value) {
      stop(); state.blink=0; state.waveStart=-100;
      for(const k of ['headX','headY','bodyX','hairX','eyeX','eyeY','hover']) state[k]=0;
      render();
    } else start();
    updateLabel();
  }

  function bind() {
    document.addEventListener('pointermove',e=>{
      if(e.pointerType==='touch' && !stage.contains(e.target)) return;
      if(!hero.contains(e.target) && !e.target.closest('.site-header')) return;
      state.pointer=true; lookAt(e.clientX,e.clientY);
    },{passive:true});
    hero.addEventListener('pointerleave',()=>{state.pointer=false;state.targetX=0;state.targetY=0;state.hoverTarget=0;});
    window.addEventListener('blur',()=>{state.pointer=false;state.targetX=0;state.targetY=0;});
    stage.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch') {lookAt(e.clientX,e.clientY);state.pointer=true;}
    },{passive:true});
    stage.addEventListener('pointerup',e=>{if(e.pointerType==='touch') state.pointer=false;},{passive:true});
    stage.addEventListener('pointercancel',()=>{state.pointer=false;},{passive:true});
    stage.addEventListener('click',greet); greetButton.addEventListener('click',greet);
    pauseButton.addEventListener('click',()=>setPaused(!state.paused));
    document.querySelectorAll('.hero-actions a, .nav-links a, .nav-cta').forEach(link=>{
      const enter=()=>{const r=link.getBoundingClientRect();lookAt(r.left+r.width/2,r.top+r.height/2);state.hoverTarget=1;state.pointer=true;};
      const leave=()=>{state.hoverTarget=0;state.pointer=false;};
      link.addEventListener('pointerenter',enter); link.addEventListener('focus',enter);
      link.addEventListener('pointerleave',leave); link.addEventListener('blur',leave);
    });
    window.addEventListener('scroll',refreshRect,{passive:true});
    new ResizeObserver(resize).observe(stage);
    const observer=new IntersectionObserver(entries=>{
      state.visible=entries[0].isIntersecting;
      if(state.visible) {refreshRect();start();} else stop();
    },{threshold:0}); observer.observe(stage);
    document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
    motionQuery.addEventListener('change',e=>{state.reduced=e.matches;setPaused(e.matches);});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stop();stage.classList.remove('is-ready');});
    canvas.addEventListener('webglcontextrestored',()=>{
      try {lost=false;initGL();createLayers();makeMesh();resize();stage.classList.add('is-ready');render();start();} catch {fail();}
    });
  }

  function setupDebug() {
    if(!debugMode) return;
    debugUI=document.createElement('aside'); debugUI.className='rig-inspector';
    debugUI.innerHTML='<strong>Rig de Ariana</strong><p>Capas de textura y articulaciones</p><div class="rig-layer-list"></div><label><input type="checkbox" id="rigBones" checked> Mostrar articulaciones</label><div class="rig-presets"><button data-pose="-1,-.5">← Mirar</button><button data-pose="0,0">Frente</button><button data-pose="1,.5">Mirar →</button><button data-pose="free">Cursor</button></div><small></small>';
    document.body.append(debugUI);
    const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
    overlay.classList.add('rig-bones');overlay.setAttribute('viewBox',`0 0 ${cfg.viewport.width} ${cfg.viewport.height}`);
    overlay.setAttribute('aria-hidden','true'); stage.append(overlay);
    for(const layer of layers) {
      const label=document.createElement('label'), input=document.createElement('input');
      input.type='checkbox';input.checked=true;input.addEventListener('change',()=>{layer.enabled=input.checked;render();});
      label.append(input,document.createTextNode(' '+layer.name));debugUI.querySelector('.rig-layer-list').append(label);
    }
    debugUI.querySelectorAll('[data-pose]').forEach(b=>b.addEventListener('click',()=>{
      state.debugPose=b.dataset.pose==='free'?null:b.dataset.pose.split(',').map(Number);start();
    }));
    debugUI.querySelector('#rigBones').addEventListener('change',e=>{overlay.toggleAttribute('hidden',!e.target.checked);});
  }
  function drawDebug(p) {
    const svg=stage.querySelector('.rig-bones');
    const points=Object.entries(cfg.bones).map(([name,pt])=>({name,p:deform(...pt,p)}));
    const [waist,neck,shoulder,elbow,wrist]=points;
    const lines=[[waist,neck],[neck,shoulder],[shoulder,elbow],[elbow,wrist]].map(([a,b])=>`<path d="M${a.p} L${b.p}"/>`).join('');
    svg.innerHTML=lines+points.map(b=>`<circle cx="${b.p[0]}" cy="${b.p[1]}" r="7"/><text x="${b.p[0]+11}" y="${b.p[1]-9}">${b.name}</text>`).join('');
    debugUI.querySelector('small').textContent=`Cabeza ${p.head.toFixed(1)}° · Codo ${p.elbow.toFixed(1)}° · Muñeca ${p.wrist.toFixed(1)}°`;
  }

  // API acotada para integrar botones, inspeccionar y verificar el rig.
  window.ariana={
    greet, pause:()=>setPaused(true), resume:()=>setPaused(false),
    lookAt, getState:()=>({...state, layers:layers.map(l=>({id:l.id,enabled:l.enabled})), pose:pose(), running:!!raf}),
    setLayer:(id,enabled)=>{const l=layers.find(l=>l.id===id);if(l){l.enabled=!!enabled;render();}},
    // Descarga las capas auténticas generadas por las máscaras, si se quieren
    // editar en una herramienta de arte. Sólo se invoca explícitamente.
    exportLayer:id=>{const l=layers.find(l=>l.id===id);if(!l)return;const a=document.createElement('a');a.href=l.canvas.toDataURL('image/png');a.download=`ariana-${id}.png`;a.click();}
  };
  source=new Image();
  source.onload=async()=>{
    try {
      initGL();
      // Archivos PNG auténticos y editables. Si se omite alguno al copiar el
      // proyecto, las máscaras permiten reconstruir el conjunto de respaldo.
      try {
        layerImages=Object.fromEntries(await Promise.all([...cfg.layers.map(l=>l.id),'torso'].map(id=>new Promise((resolve,reject)=>{
          const img=new Image();img.onload=()=>resolve([id,img]);img.onerror=reject;img.src=`assets/ariana/layers/${id}.png`;
        }))));
      } catch {layerImages=null;}
      createLayers();makeMesh();state.ready=true;bind();setupDebug();resize();
      stage.classList.add('is-ready');fallback.setAttribute('aria-hidden','true');updateLabel();render();start();
    } catch(error) {console.warn('Ariana: se conserva la ilustración estática.',error);fail();}
  };
  source.onerror=fail;source.src=cfg.source;
})();
