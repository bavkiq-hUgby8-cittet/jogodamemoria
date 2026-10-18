(function (global) {
  'use strict';

  var firebaseConfig = {
    apiKey: 'AIzaSyCwU3iGOAk1p4AHQe3EpYrShx5zzSe4S5Q',
    authDomain: 'jogodamemoria-61432.firebaseapp.com',
    databaseURL: 'https://jogodamemoria-61432-default-rtdb.firebaseio.com',
    projectId: 'jogodamemoria-61432',
    storageBucket: 'jogodamemoria-61432.firebasestorage.app',
    messagingSenderId: '131881486944',
    appId: '1:131881486944:web:653271faeb8ab0f5e25105'
  };

  var storageOk;

  function escaparHtml(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function idCurto() {
    return Math.random().toString(36).slice(2, 11);
  }

  function nomeNivel(nivel) {
    if (nivel === 'facil') return 'Fácil';
    if (nivel === 'medio') return 'Médio';
    if (nivel === 'dificil') return 'Difícil';
    return nivel || '';
  }

  function gerarAvatarPadrao(nome) {
    var inicial = nome ? String(nome).charAt(0).toUpperCase() : '?';
    if (!/^[0-9A-Za-zÀ-ÿ]$/.test(inicial)) inicial = '?';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#667eea"/><text x="50" y="66" text-anchor="middle" fill="white" font-size="42" font-family="sans-serif">' + inicial + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function mensagemErro(error) {
    var code = (error && error.code) || '';
    var msg = (error && error.message) || String(error || '');
    if (code === 'PERMISSION_DENIED' || /permission_denied|Permission denied/i.test(msg)) {
      return 'O Firebase bloqueou esta ação. Confira as regras do Realtime Database.';
    }
    if (/billing account/i.test(msg) || code === 'storage/unauthorized' || code === 'storage/unknown') {
      return 'O armazenamento de fotos do Firebase não aceitou o envio. A foto foi guardada na própria partida.';
    }
    if (msg === 'formato') {
      return 'Não consegui abrir essa foto. Use JPG, PNG ou WebP.';
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Sem internet. Confira a conexão e tente de novo.';
    }
    return 'Não foi possível concluir. Tente de novo.';
  }

  function iniciarFirebase() {
    if (typeof firebase === 'undefined') {
      throw new Error('firebase-ausente');
    }
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    return {
      database: firebase.database(),
      storage: firebase.storage()
    };
  }

  function observarConexao(database, elemento) {
    if (!elemento) return;
    database.ref('.info/connected').on('value', function (snap) {
      var online = snap.val() === true;
      elemento.hidden = online;
      elemento.textContent = online ? '' : 'Conexão instável. Tentando reconectar…';
    });
  }

  function mostrarToast(texto) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = texto;
    el.classList.add('visivel');
    clearTimeout(mostrarToast._t);
    mostrarToast._t = setTimeout(function () {
      el.classList.remove('visivel');
    }, 4600);
  }

  function anunciar(texto) {
    var el = document.getElementById('anuncio');
    if (el) el.textContent = texto;
  }

  function esperar(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function redimensionarImagem(file, maxW, maxH, qualidade) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('leitura')); };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var largura = img.width;
          var altura = img.height;
          var proporcao = Math.min(maxW / largura, maxH / altura, 1);
          largura = Math.max(1, Math.round(largura * proporcao));
          altura = Math.max(1, Math.round(altura * proporcao));
          var canvas = document.createElement('canvas');
          canvas.width = largura;
          canvas.height = altura;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, largura, altura);
          ctx.drawImage(img, 0, 0, largura, altura);
          canvas.toBlob(function (blob) {
            if (!blob) reject(new Error('blob'));
            else resolve(blob);
          }, 'image/jpeg', qualidade);
        };
        img.onerror = function () { reject(new Error('formato')); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function blobParaDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('leitura')); };
      reader.readAsDataURL(blob);
    });
  }

  async function storageDisponivel(storage) {
    if (storageOk !== undefined) return storageOk;
    try {
      var lista = await Promise.race([
        storage.ref('memorias').listAll(),
        esperar(7000).then(function () { throw new Error('timeout'); })
      ]);
      if (!lista.items.length) {
        storageOk = false;
        return false;
      }
      await Promise.race([
        lista.items[0].getDownloadURL(),
        esperar(7000).then(function () { throw new Error('timeout'); })
      ]);
      storageOk = true;
    } catch (error) {
      storageOk = false;
    }
    return storageOk;
  }

  async function guardarFoto(storage, file, pasta, maxW, maxH) {
    var blob = await redimensionarImagem(file, maxW, maxH, 0.66);
    var dataUrl = await blobParaDataUrl(blob);
    var ok = await storageDisponivel(storage);
    if (!ok) return { url: dataUrl, embutida: true };
    try {
      var caminho = pasta + '/' + Date.now() + '_' + idCurto() + '.jpg';
      var ref = storage.ref(caminho);
      await Promise.race([
        ref.put(blob, { contentType: 'image/jpeg' }),
        esperar(8000).then(function () { throw new Error('timeout'); })
      ]);
      var url = await ref.getDownloadURL();
      return { url: url, embutida: false };
    } catch (error) {
      storageOk = false;
      return { url: dataUrl, embutida: true };
    }
  }

  function urlDaCarta(carta, fotos) {
    if (!carta) return '';
    if (carta.fotoUrl) return carta.fotoUrl;
    if (carta.fotoId != null && fotos && fotos[carta.fotoId]) return fotos[carta.fotoId];
    return '';
  }

  function mesmaFoto(a, b) {
    if (!a || !b) return false;
    if (a.fotoId != null && b.fotoId != null) return String(a.fotoId) === String(b.fotoId);
    return !!(a.fotoUrl && a.fotoUrl === b.fotoUrl);
  }

  function embaralhar(array) {
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function criarTabuleiro(fotos) {
    var cartas = {};
    var ids = [];
    fotos.forEach(function (foto, idx) {
      var curta = typeof foto === 'string' && foto.length < 400;
      ['a', 'b'].forEach(function (lado) {
        var id = 'c' + idx + '_' + lado;
        var carta = { id: id, fotoId: idx, encontrada: false };
        if (curta) carta.fotoUrl = foto;
        cartas[id] = carta;
        ids.push(id);
      });
    });
    return { cartas: cartas, posicoes: embaralhar(ids) };
  }

  async function incrementarNumero(database, caminho) {
    var ref = database.ref(caminho);
    await ref.once('value');
    var resultado = await ref.transaction(function (valor) {
      return (valor || 0) + 1;
    });
    return resultado.snapshot.val() || 0;
  }

  function jogadoresDaPartida(snapshot, partidaId) {
    var lista = [];
    if (!snapshot) return lista;
    snapshot.forEach(function (child) {
      var jogador = child.val();
      if (jogador && jogador.partidaId === partidaId && jogador.ativo) {
        lista.push(Object.assign({ id: child.key }, jogador));
      }
    });
    lista.sort(function (a, b) {
      return (a.ordem || 0) - (b.ordem || 0) || String(a.id).localeCompare(String(b.id));
    });
    return lista;
  }

  async function listarJogadoresAtivos(database, partidaId) {
    var snap = await database.ref('jogadores').once('value');
    return jogadoresDaPartida(snap, partidaId);
  }

  async function passarVez(database, partidaId, jogadorAtualId) {
    var lista = await listarJogadoresAtivos(database, partidaId);
    if (!lista.length) return null;
    var idx = -1;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === jogadorAtualId) idx = i;
    }
    if (idx < 0) idx = lista.length - 1;
    var proximo = lista[(idx + 1) % lista.length].id;
    await database.ref('partidas/' + partidaId + '/vezDoJogador').set(proximo);
    await database.ref('jogada_atual/' + partidaId).set({
      jogadorId: proximo,
      cartasViradas: [],
      inicioJogada: Date.now()
    });
    return proximo;
  }

  async function reivindicarJogada(database, partidaId, predicado, marca) {
    var ref = database.ref('jogada_atual/' + partidaId);
    await ref.once('value');
    var tx = await ref.transaction(function (atual) {
      if (atual == null) return atual;
      if (atual.encerrada) return;
      if (!predicado(atual)) return;
      atual.encerrada = marca;
      return atual;
    });
    if (!tx.committed) return null;
    var valor = tx.snapshot.val();
    if (!valor || valor.encerrada !== marca) return null;
    return valor;
  }

  function comoLista(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) return valor.slice();
    if (typeof valor !== 'object') return [];
    return Object.keys(valor).sort(function (a, b) {
      return Number(a) - Number(b);
    }).map(function (chave) { return valor[chave]; });
  }

  function tempoRestante(jogada, tempoPorJogada) {
    var tempo = tempoPorJogada || 10;
    if (!jogada || !jogada.inicioJogada) return tempo;
    var passado = Math.floor((Date.now() - jogada.inicioJogada) / 1000);
    return Math.max(0, tempo - passado);
  }

  function estrelas(quantidade) {
    var n = quantidade || 0;
    if (n <= 0) return '–';
    if (n > 8) return '⭐ × ' + n;
    return '⭐'.repeat(n);
  }

  function prefereMenosMovimento() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  global.Memoria = {
    escaparHtml: escaparHtml,
    idCurto: idCurto,
    nomeNivel: nomeNivel,
    gerarAvatarPadrao: gerarAvatarPadrao,
    mensagemErro: mensagemErro,
    iniciarFirebase: iniciarFirebase,
    observarConexao: observarConexao,
    mostrarToast: mostrarToast,
    anunciar: anunciar,
    esperar: esperar,
    redimensionarImagem: redimensionarImagem,
    guardarFoto: guardarFoto,
    storageDisponivel: storageDisponivel,
    urlDaCarta: urlDaCarta,
    mesmaFoto: mesmaFoto,
    embaralhar: embaralhar,
    criarTabuleiro: criarTabuleiro,
    incrementarNumero: incrementarNumero,
    jogadoresDaPartida: jogadoresDaPartida,
    listarJogadoresAtivos: listarJogadoresAtivos,
    passarVez: passarVez,
    reivindicarJogada: reivindicarJogada,
    tempoRestante: tempoRestante,
    comoLista: comoLista,
    estrelas: estrelas,
    prefereMenosMovimento: prefereMenosMovimento
  };
})(window);
