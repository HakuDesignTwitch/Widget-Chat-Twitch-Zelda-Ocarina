// Versión "por enlace": el widget escucha el chat público de Twitch directamente,
// sin StreamElements y sin que el streamer inicie sesión.
// Ajustes en el enlace:  overlay.html?canal=nombre&ancho=560&max=8&seg=0
// Funciona: chat, subs, resubs, subs regaladas, bits, raids y borrado de mensajes.
// (Follows y donaciones necesitan permisos; van aparte.)

(function () {
  const p = new URLSearchParams(location.search);
  const canal = (p.get('canal') || '').trim().toLowerCase().replace(/^#/, '');

  // Ajustes que se pueden poner en el enlace (los demás, los de widget.js).
  const ajustes = {};
  if (p.get('ancho')) ajustes.cfgAncho = Number(p.get('ancho'));
  if (p.get('max')) ajustes.cfgMaximo = Number(p.get('max'));
  if (p.get('seg')) ajustes.cfgSegundos = Number(p.get('seg'));
  if (p.get('comandos') === '1') ajustes.cfgOcultarComandos = false;
  if (p.get('bots') != null) ajustes.cfgBots = p.get('bots');
  if (p.get('avisos') === '0') ajustes.cfgAvisos = false;
  // Textos: txtDonacion, txtBits, txtRaid, txtSubNuevo, txtResub, txtSubRegalada, txtSubsRegaladas, txtSubLinea2
  p.forEach((v, k) => { if (k.startsWith('txt')) ajustes[k] = v; });
  window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: { fieldData: ajustes } }));

  const enviar = (listener, event) =>
    window.dispatchEvent(new CustomEvent('onEventReceived', { detail: { listener, event } }));

  if (!canal) {
    enviar('message', { data: { displayName: 'Aviso', nick: 'aviso', text: 'Falta el canal en el enlace: añade ?canal=tunombre', emotes: [] } });
    return;
  }

  // ---------- Leer los mensajes de Twitch (formato IRC) ----------
  function desescapar(v) {
    return v.replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  }

  function leer(linea) {
    const m = { tags: {}, prefijo: '', comando: '', params: [], texto: '' };
    let resto = linea;
    if (resto[0] === '@') {
      const fin = resto.indexOf(' ');
      resto.slice(1, fin).split(';').forEach(par => {
        const i = par.indexOf('=');
        m.tags[par.slice(0, i)] = desescapar(par.slice(i + 1));
      });
      resto = resto.slice(fin + 1);
    }
    if (resto[0] === ':') {
      const fin = resto.indexOf(' ');
      m.prefijo = resto.slice(1, fin);
      resto = resto.slice(fin + 1);
    }
    const t = resto.indexOf(' :');
    if (t >= 0) { m.texto = resto.slice(t + 2); resto = resto.slice(0, t); }
    const partes = resto.split(' ');
    m.comando = partes.shift();
    m.params = partes;
    return m;
  }

  // Twitch dice dónde está cada emote ("25:0-4,6-10/1902:12-16"); se convierten al formato de StreamElements.
  function emotes(tag, texto) {
    if (!tag) return [];
    const letras = Array.from(texto);
    const lista = [];
    tag.split('/').forEach(grupo => {
      const [id, sitios] = grupo.split(':');
      if (!sitios) return;
      const [a, b] = sitios.split(',')[0].split('-').map(Number);
      const nombre = letras.slice(a, b + 1).join('');
      const url = t => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/${t}`;
      lista.push({ name: nombre, urls: { 1: url('1.0'), 2: url('2.0'), 4: url('3.0') } });
    });
    return lista;
  }

  // Alertas de prueba ("!widget" = todas; "!widget bits", "!widget raid", "!widget sub"...).
  function probar(nombre, cual) {
    const lista = {
      sub: () => enviar('subscriber-latest', { name: nombre, amount: 1 }),
      resub: () => enviar('subscriber-latest', { name: nombre, amount: 11 }),
      regalo: () => enviar('subscriber-latest', { name: nombre, sender: nombre, amount: 5, bulkGifted: true }),
      bits: () => enviar('cheer-latest', { name: nombre, amount: 1000 }),
      raid: () => enviar('raid-latest', { name: nombre, amount: 23 }),
      follow: () => enviar('follower-latest', { name: nombre }),
      donacion: () => enviar('tip-latest', { name: nombre, amount: 5 })
    };
    // Palabras que también valen (con tilde, en inglés...).
    const alias = { 'donación': 'donacion', dono: 'donacion', tip: 'donacion', seguidor: 'follow', follower: 'follow',
                    regaladas: 'regalo', gift: 'regalo', bit: 'bits', cheer: 'bits' };
    let k = (cual || '').toLowerCase();
    k = alias[k] || k;
    // "!widget" solo: una alerta de cada diseño (resub y regalo usan el mismo estandarte que sub).
    const pasos = lista[k] ? [lista[k]] : [lista.follow, lista.sub, lista.bits, lista.raid, lista.donacion];
    pasos.forEach((f, i) => setTimeout(f, i * 2500));
  }

  const nombreDe = m => m.tags['display-name'] || (m.prefijo.split('!')[0]) || '';

  function procesar(m) {
    if (m.comando === 'PING') return ws.send('PONG :' + m.texto);

    // Al entrar al canal (solo la primera vez): mensaje de bienvenida que se va solo,
    // para que el streamer vea en OBS que el widget funciona aunque nadie escriba.
    if (m.comando === '366' && !saludado) {
      saludado = true;
      enviar('message', { data: {
        displayName: 'Widget aventura', nick: 'widget', msgId: 'hola', emotes: [],
        text: '¡Conectado al chat de ' + canal + '! Escribe algo en tu chat para probarlo.'
      } });
      setTimeout(() => enviar('delete-message', { msgId: 'hola' }), 10000);
      return;
    }

    if (m.comando === 'PRIVMSG') {
      let texto = m.texto;
      if (texto.startsWith('\u0001ACTION ')) texto = texto.slice(8, -1); // mensajes /me
      const nombre = nombreDe(m);
      // Prueba: el dueño del canal (o un mod) escribe "!widget" y salen todas las alertas.
      const manda = /(^|,)(broadcaster|moderator)\//.test(m.tags.badges || '');
      if (manda && /^!widget\b/i.test(texto.trim())) return probar(nombre, texto.trim().split(/\s+/)[1]);
      if (m.tags.bits) enviar('cheer-latest', { name: nombre, amount: Number(m.tags.bits) });
      return enviar('message', { data: {
        displayName: nombre, nick: m.prefijo.split('!')[0], text: texto,
        msgId: m.tags.id, userId: m.tags['user-id'], emotes: emotes(m.tags.emotes, texto)
      } });
    }

    if (m.comando === 'USERNOTICE') {
      const t = m.tags, tipo = t['msg-id'], quien = t['display-name'] || t.login;
      if (tipo === 'sub') return enviar('subscriber-latest', { name: quien, amount: 1 });
      if (tipo === 'resub') return enviar('subscriber-latest', { name: quien, amount: Number(t['msg-param-cumulative-months']) || 1 });
      if (tipo === 'submysterygift') {
        return enviar('subscriber-latest', { name: quien, sender: quien, amount: Number(t['msg-param-mass-gift-count']) || 1, bulkGifted: true });
      }
      if (tipo === 'subgift') {
        // Las que forman parte de un regalo en bloque ya se anunciaron todas juntas.
        if (t['msg-param-community-gift-id']) return;
        return enviar('subscriber-latest', { name: t['msg-param-recipient-display-name'], sender: quien, amount: 1, gifted: true });
      }
      if (tipo === 'raid') {
        return enviar('raid-latest', { name: t['msg-param-displayName'] || quien, amount: Number(t['msg-param-viewerCount']) || 0 });
      }
      return;
    }

    if (m.comando === 'CLEARMSG') return enviar('delete-message', { msgId: m.tags['target-msg-id'] });
    if (m.comando === 'CLEARCHAT' && m.tags['target-user-id']) return enviar('delete-messages', { userId: m.tags['target-user-id'] });
  }

  // ---------- Conexión (y reconexión si se corta) ----------
  let ws, espera = 1000, saludado = false;
  function conectar() {
    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws.onopen = () => {
      espera = 1000;
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS SCHMOOPIIE'); // usuario anónimo: solo lectura
      ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
      ws.send('JOIN #' + canal);
    };
    ws.onmessage = e => String(e.data).split('\r\n').forEach(l => { if (l) procesar(leer(l)); });
    ws.onclose = () => { setTimeout(conectar, espera); espera = Math.min(espera * 2, 30000); };
  }
  conectar();
})();
