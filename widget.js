// Widget de chat estilo aventura para StreamElements (Custom Widget).
// Dibujos de Haku; aquí solo se colocan, se animan y se rellenan los textos.

const chat = document.getElementById('chat');

// Ajustes por defecto. En StreamElements se cambian desde el panel (campos.json).
const cfg = {
  cfgAncho: 560,
  cfgMaximo: 8,
  cfgSegundos: 0,
  cfgOcultarComandos: true,
  cfgBots: 'streamelements, nightbot',
  cfgAvisos: true,
  cfgAlertas: '', // vacío = todas; si no, lista: follow,sub,bits,raid,donacion (o 'ninguna')
  txtDonacion: '{nombre} nos da {cantidad} rupias',
  txtBits: '{cantidad} bits',
  txtRaid: '{nombre} nos trae a {cantidad} aventureros',
  txtSubNuevo: '{nombre} se une a la aventura',
  txtResub: '{nombre} lleva {meses} meses con nosotros',
  txtSubRegalada: '{nombre} regala una sub a {destino}',
  txtSubsRegaladas: '{nombre} regala {cantidad} subs',
  txtSubLinea2: 'Muchas gracias compañero por traer el juego el día de salida',
  // Imágenes: en StreamElements se suben desde el panel; aquí, las de la carpeta img/.
  imgChat: 'img/Chat - Fondo.png',
  imgRombo: 'img/Chat - Rombo.png',
  imgDonacion: 'img/Donation - Fondo.png',
  imgFollower: 'img/Follower - Fondo.png',
  imgRaid: 'img/New Raid - Fondo.png',
  imgBits: 'img/Bits - Fondo.png',
  imgGema: 'img/Gema 100.png',
  imgGema1: 'img/Gema 1.png', imgGema1000: 'img/Gema 1000.png',
  imgGema5000: 'img/Gema 5000.png', imgGema10000: 'img/Gema 10000.png',
  colBits1: '#c9c9c9', colBits100: '#b05cff', colBits1000: '#14dcb4',
  colBits5000: '#4aa8ff', colBits10000: '#ff4a4a',
  imgSub: 'img/Sub.png'
};

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}

function rellenar(plantilla, datos) {
  return String(plantilla).replace(/\{(\w+)\}/g, (m, k) => (datos[k] != null ? datos[k] : m));
}

function quitar(el) {
  if (!el || el.classList.contains('sale')) return;
  el.classList.add('sale');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function publicar(el) {
  chat.append(el);
  while (chat.children.length > cfg.cfgMaximo) chat.firstElementChild.remove();
  // Si no caben todos en la caja del widget, quita los de arriba para que ninguno salga cortado.
  const caja = chat.offsetParent || chat.parentElement;
  const alto = (caja && caja.clientHeight) || window.innerHeight;
  while (chat.children.length > 1 && chat.offsetHeight > alto) chat.firstElementChild.remove();
  if (cfg.cfgSegundos > 0) setTimeout(() => quitar(el), cfg.cfgSegundos * 1000);
}

function aplicarAjustes() {
  chat.style.setProperty('--w', cfg.cfgAncho + 'px');
  const imagenes = {
    '--img-chat': cfg.imgChat, '--img-rombo': cfg.imgRombo, '--img-follower': cfg.imgFollower,
    '--img-raid': cfg.imgRaid, '--img-bits': cfg.imgBits, '--img-gema': cfg.imgGema, '--img-sub': cfg.imgSub
  };
  Object.entries(imagenes).forEach(([v, src]) => chat.style.setProperty(v, 'url("' + encodeURI(src) + '")'));
  papel = null; // se vuelve a cargar con la imagen nueva
}

// ---------- Mensajes ----------
function textoConEmotes(data, destino) {
  const emotes = {};
  (data.emotes || []).forEach(e => { emotes[e.name] = e.urls && (e.urls['4'] || e.urls['2'] || e.urls['1']); });
  String(data.text || '').split(' ').forEach((palabra, i) => {
    if (i > 0) destino.append(' ');
    if (emotes[palabra]) {
      const img = crear('img', 'emote');
      img.src = emotes[palabra];
      img.alt = palabra;
      destino.append(img);
    } else {
      destino.append(palabra);
    }
  });
}

function mensaje(data) {
  const texto = String(data.text || '');
  const nick = String(data.nick || data.displayName || '').toLowerCase();
  const bots = String(cfg.cfgBots || '').toLowerCase().split(',').map(b => b.trim()).filter(Boolean);
  if (cfg.cfgOcultarComandos && texto.startsWith('!')) return;
  if (bots.includes(nick)) return;

  const el = crear('div', 'item msg');
  el.dataset.id = data.msgId || '';
  el.dataset.usuario = data.userId || '';

  const nombre = String(data.displayName || data.nick || '');
  const etiqueta = crear('span', 'nombre', nombre);
  // Los nombres largos encogen un poco para caber en la etiqueta dorada.
  etiqueta.style.setProperty('--fn', Math.min(80, Math.floor(1120 / Math.max(nombre.length, 1))));
  el.append(etiqueta, crear('span', 'rombo'));
  textoConEmotes(data, el);
  publicar(el);
}

// ---------- Donación con papiro que se quema ----------
let papel = null;
function cargarPapel() {
  if (!papel) {
    papel = new Image();
    papel.crossOrigin = 'anonymous'; // antes de src, para poder "quemar" la imagen subida a StreamElements
    papel.src = encodeURI(cfg.imgDonacion);
  }
  return papel.decode ? papel.decode().then(() => papel) : Promise.resolve(papel);
}

// Ruido suave (para que el borde quemado sea irregular y no una línea recta).
function ruido(ancho, alto, celda, semilla) {
  const cols = Math.ceil(ancho / celda) + 2, filas = Math.ceil(alto / celda) + 2;
  const r = new Float32Array(cols * filas);
  let s = semilla;
  for (let i = 0; i < r.length; i++) { s = (s * 16807) % 2147483647; r[i] = (s / 2147483647) * 2 - 1; }
  const suave = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / celda, gy = y / celda, x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = suave(gx - x0), fy = suave(gy - y0);
    const a = r[y0 * cols + x0], b = r[y0 * cols + x0 + 1];
    const c = r[(y0 + 1) * cols + x0], d = r[(y0 + 1) * cols + x0 + 1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
}

function quemar(lienzo, img, alTerminar) {
  const escala = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(lienzo.clientWidth * escala), h = Math.round(lienzo.clientHeight * escala);
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d');

  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(img, 0, 0, w, h);
  let fuente;
  try { fuente = tctx.getImageData(0, 0, w, h).data; } catch (e) { ctx.drawImage(img, 0, 0, w, h); alTerminar(); return; }

  // Para cada píxel: en qué momento le llega el fuego (de abajo-izquierda a arriba-derecha).
  const n1 = ruido(w, h, w / 9, 7), n2 = ruido(w, h, w / 40, 31);
  const llega = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    llega[y * w + x] = (x / w) * 0.62 + ((h - y) / h) * 0.38 + n1(x, y) * 0.07 + n2(x, y) * 0.025;
  }

  const salida = ctx.createImageData(w, h), o = salida.data;
  const banda = 0.16, duracion = 1650, inicio = performance.now();
  // Colores del borde: brasa amarilla -> naranja -> rojo -> chamuscado -> papel.
  const tramos = [[0, [255, 214, 90]], [.18, [255, 110, 20]], [.42, [205, 25, 10]], [.66, [70, 18, 8]], [1, null]];

  function fotograma(ahora) {
    const t = Math.min((ahora - inicio) / duracion, 1);
    const p = -0.12 + (1.25 + banda) * (1 - Math.pow(1 - t, 2)); // empieza rápido y frena al final
    for (let i = 0, j = 0; i < llega.length; i++, j += 4) {
      const a = fuente[j + 3];
      const e = p - llega[i];
      if (e <= 0 || a === 0) { o[j + 3] = 0; continue; }
      let r = fuente[j], g = fuente[j + 1], b = fuente[j + 2], al = a;
      if (e < banda) {
        const k = e / banda;
        let s = 0;
        while (k > tramos[s + 1][0]) s++;
        const c0 = tramos[s][1], c1 = tramos[s + 1][1] || [r, g, b];
        const f = (k - tramos[s][0]) / (tramos[s + 1][0] - tramos[s][0]);
        r = c0[0] + (c1[0] - c0[0]) * f;
        g = c0[1] + (c1[1] - c0[1]) * f;
        b = c0[2] + (c1[2] - c0[2]) * f;
        if (k < 0.06) al = a * (k / 0.06);
      }
      o[j] = r; o[j + 1] = g; o[j + 2] = b; o[j + 3] = al;
    }
    ctx.putImageData(salida, 0, 0);
    if (t < 1) requestAnimationFrame(fotograma);
    else { ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h); alTerminar(); }
  }
  requestAnimationFrame(fotograma);
}

function donacion(nombre, cantidad) {
  const el = crear('div', 'item papiro');
  const lienzo = crear('canvas');
  const linea = crear('span', 'linea', rellenar(cfg.txtDonacion, { nombre, cantidad }));
  el.append(lienzo, linea);
  publicar(el);
  cargarPapel().then(img => quemar(lienzo, img, () => el.classList.add('listo')));
  setTimeout(() => el.classList.add('listo'), 1200); // el texto aparece cuando ya casi está todo el papiro
}

// ---------- Resto de avisos ----------
function follower(nombre) {
  const el = crear('div', 'item follower');
  el.append(crear('span', '', nombre));
  publicar(el);
}

function raid(nombre, cantidad) {
  const el = crear('div', 'item raid');
  el.append(crear('span', '', rellenar(cfg.txtRaid, { nombre, cantidad })));
  publicar(el);
}

// Niveles de bits, como los de Twitch. Cada uno puede tener su propia gema dibujada;
// si aún no se ha subido, se usa la gema morada cambiándole el tono (provisional).
const NIVELES = [
  { desde: 10000, img: 'imgGema10000', color: 'colBits10000', tono: 'hue-rotate(95deg) saturate(1.3)' },
  { desde: 5000, img: 'imgGema5000', color: 'colBits5000', tono: 'hue-rotate(-55deg)' },
  { desde: 1000, img: 'imgGema1000', color: 'colBits1000', tono: 'hue-rotate(-100deg) saturate(1.2)' },
  { desde: 100, img: 'imgGema', color: 'colBits100', tono: '' },
  { desde: 0, img: 'imgGema1', color: 'colBits1', tono: 'grayscale(1) brightness(1.4)' }
];

function bits(nombre, cantidad) {
  const n = NIVELES.find(x => Number(cantidad) >= x.desde) || NIVELES[NIVELES.length - 1];
  const el = crear('div', 'item bits');
  const gema = crear('i', 'gema');
  if (cfg[n.img]) {
    gema.style.backgroundImage = 'url("' + encodeURI(cfg[n.img]) + '")';
  } else if (n.tono) {
    gema.style.setProperty('--tono', n.tono);
  }
  el.style.setProperty('--col-bits', cfg[n.color]);
  const texto = crear('span');
  texto.append(gema, crear('span', '', nombre), crear('b', '', rellenar(cfg.txtBits, { nombre, cantidad })));
  el.append(texto);
  publicar(el);
}

function sub(numero, linea1) {
  const el = crear('div', 'item sub');
  const num = crear('span', 'num', String(numero));
  num.style.setProperty('--fs', String(numero).length > 2 ? 130 : 190);
  const lineas = crear('div', 'lineas');
  lineas.append(crear('span', 'l1', linea1));
  if (cfg.txtSubLinea2) lineas.append(crear('span', 'l2', cfg.txtSubLinea2));
  el.append(num, lineas);
  publicar(el);
}

function suscripcion(ev) {
  if (ev.isCommunityGift) return; // el regalo en bloque ya se anuncia una vez
  const nombre = ev.name, cantidad = ev.amount || 1;
  if (ev.bulkGifted) return sub(cantidad, rellenar(cfg.txtSubsRegaladas, { nombre: ev.sender || nombre, cantidad }));
  if (ev.gifted) return sub(1, rellenar(cfg.txtSubRegalada, { nombre: ev.sender || 'Alguien', destino: nombre }));
  if (cantidad > 1) return sub(cantidad, rellenar(cfg.txtResub, { nombre, meses: cantidad }));
  sub(1, rellenar(cfg.txtSubNuevo, { nombre }));
}

// ---------- Conexión con StreamElements ----------
window.addEventListener('onWidgetLoad', obj => {
  const datos = (obj.detail || {}).fieldData || {};
  Object.keys(datos).forEach(k => { if (datos[k] !== '' && datos[k] != null) cfg[k] = datos[k]; });
  aplicarAjustes();
});

window.addEventListener('onEventReceived', obj => {
  const listener = obj.detail.listener;
  const ev = obj.detail.event || {};

  if (listener === 'message') return mensaje(ev.data || {});
  if (listener === 'delete-message') {
    return chat.querySelectorAll('.msg').forEach(m => { if (m.dataset.id === ev.msgId) quitar(m); });
  }
  if (listener === 'delete-messages') {
    return chat.querySelectorAll('.msg').forEach(m => { if (m.dataset.usuario === ev.userId) quitar(m); });
  }

  if (!cfg.cfgAvisos) return;
  // Solo las alertas que el streamer ha elegido.
  const tipo = { 'follower-latest': 'follow', 'subscriber-latest': 'sub', 'cheer-latest': 'bits', 'raid-latest': 'raid', 'tip-latest': 'donacion' }[listener];
  if (cfg.cfgAlertas && tipo && !String(cfg.cfgAlertas).split(',').includes(tipo)) return;
  if (listener === 'follower-latest') return follower(ev.name);
  if (listener === 'subscriber-latest') return suscripcion(ev);
  if (listener === 'cheer-latest') return bits(ev.name, ev.amount);
  if (listener === 'raid-latest') return raid(ev.name, ev.amount);
  if (listener === 'tip-latest') return donacion(ev.name, ev.amount);
});

aplicarAjustes();
