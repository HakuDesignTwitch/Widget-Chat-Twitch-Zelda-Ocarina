// Conexión OPCIONAL con StreamElements (prueba interna de Haku).
// Si el enlace lleva &se=CLAVE (el JWT de StreamElements), el widget también escucha:
//  - follows y donaciones de verdad,
//  - el botón "Emulate" de StreamElements (todas las alertas).
// Subs, bits y raids de verdad ya llegan por Twitch (twitch.js), así que aquí se ignoran
// para que no salgan repetidos.
// OJO: la clave es secreta. Solo en el OBS del propio streamer, nunca en público.

(function () {
  const clave = new URLSearchParams(location.search).get('se');
  if (!clave) return;

  const enviar = (listener, event) =>
    window.dispatchEvent(new CustomEvent('onEventReceived', { detail: { listener, event } }));
  const aviso = texto => enviar('message', { data: { displayName: 'StreamElements', nick: 'se-aviso', msgId: 'se-aviso', text: texto, emotes: [] } });

  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js';
  s.onerror = () => aviso('No se pudo cargar la conexión con StreamElements.');
  s.onload = () => {
    const so = io('https://realtime.streamelements.com', { transports: ['websocket'] });
    let primera = true;
    so.on('connect', () => so.emit('authenticate', { method: 'jwt', token: clave }));
    so.on('authenticated', () => {
      if (primera) { aviso('Conectado a StreamElements. Prueba el botón Emulate.'); setTimeout(() => enviar('delete-message', { msgId: 'se-aviso' }), 8000); }
      primera = false;
    });
    so.on('unauthorized', () => aviso('La clave de StreamElements no es válida. Revisa el enlace.'));

    // Botón "Emulate": llega ya en el formato del widget.
    so.on('event:test', d => { if (d && d.listener && d.event) enviar(d.listener, d.event); });

    // Eventos de verdad: solo follows y donaciones (lo demás ya llega por Twitch).
    so.on('event', d => {
      if (!d || !d.data) return;
      const nombre = d.data.displayName || d.data.username || d.data.name;
      if (d.type === 'follow') enviar('follower-latest', { name: nombre });
      if (d.type === 'tip') enviar('tip-latest', { name: nombre, amount: d.data.amount });
    });
  };
  document.head.append(s);
})();
