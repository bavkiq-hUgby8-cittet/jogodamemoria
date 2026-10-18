(function () {
  'use strict';

  var NIVEIS = {
    facil: { pares: 8, colunas: 4, linhas: 4, nome: 'fácil' },
    medio: { pares: 12, colunas: 6, linhas: 4, nome: 'médio' },
    dificil: { pares: 18, colunas: 6, linhas: 6, nome: 'difícil' }
  };

  var database = null;
  var storage = null;
  var fotosCarregadas = [];
  var enviandoFotos = 0;
  var nivelSelecionado = 'facil';
  var tempoPorJogada = 10;
  var fotosAnteriores = [];
  var fotosSelecionadasModal = [];
  var ouvintesJogadores = new Map();
  var ouvintesJogo = [];
  var relogio = null;
  var partidaAtualId = null;
  var estado = {
    partida: null,
    tabuleiro: null,
    jogada: null,
    jogadores: {},
    fimMostrado: false,
    ultimaChave: null
  };
  var processandoTempo = false;
  var processandoResolucao = false;
  var avisoStorageMostrado = false;
  var vistoParChave = '';
  var vistoParEm = 0;

  function mostrarBanner(texto) {
    var banner = document.getElementById('banner-erro');
    if (!banner) return;
    if (!texto) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.hidden = false;
    banner.textContent = texto;
  }

  function arquivoDeImagem(file) {
    if (!file) return false;
    if (file.type && file.type.indexOf('image/') === 0) return true;
    return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
  }

  function atualizarContador() {
    var count = fotosCarregadas.length;
    var countEl = document.getElementById('fotos-count');
    var container = document.getElementById('fotos-container');
    var botao = document.getElementById('btn-criar');
    var dica = document.getElementById('upload-dica');
    var nivel = NIVEIS[nivelSelecionado];
    if (countEl) countEl.textContent = String(count);
    if (container) container.style.display = (count > 0 || enviandoFotos > 0) ? 'block' : 'none';
    if (dica) {
      dica.textContent = enviandoFotos > 0
        ? 'Enviando ' + enviandoFotos + ' foto' + (enviandoFotos > 1 ? 's' : '') + '…'
        : 'Mínimo ' + nivel.pares + ' fotos para o nível ' + nivel.nome;
    }
    if (botao) {
      botao.disabled = enviandoFotos > 0 || count < nivel.pares;
      botao.textContent = enviandoFotos > 0
        ? '⏳ Enviando fotos…'
        : '🎮 CRIAR PARTIDA';
    }
  }

  function criarPreview(url, local) {
    var div = document.createElement('div');
    div.className = 'foto-preview';
    div.dataset.url = url;
    var img = document.createElement('img');
    img.src = local || url;
    img.alt = 'Foto carregada para as cartas';
    img.addEventListener('error', function () {
      img.alt = 'Foto indisponível';
      img.classList.add('img-quebrada');
    });
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-remover';
    btn.setAttribute('aria-label', 'Remover foto');
    btn.textContent = '✕';
    btn.addEventListener('click', function (evento) {
      evento.stopPropagation();
      fotosCarregadas = fotosCarregadas.filter(function (item) { return item !== url; });
      if (img.src.indexOf('blob:') === 0) URL.revokeObjectURL(img.src);
      div.remove();
      atualizarContador();
    });
    div.appendChild(img);
    div.appendChild(btn);
    return div;
  }

  async function handleFiles(files) {
    var lista = Array.prototype.slice.call(files || []);
    var grade = document.getElementById('fotos-grid');
    var ignorados = 0;
    for (var i = 0; i < lista.length; i++) {
      var file = lista[i];
      if (!arquivoDeImagem(file)) {
        ignorados += 1;
        continue;
      }
      enviandoFotos += 1;
      atualizarContador();
      var local = URL.createObjectURL(file);
      var preview = criarPreview('', local);
      grade.appendChild(preview);
      try {
        var guardada = await Memoria.guardarFoto(storage, file, 'memorias', 480, 640);
        if (guardada.embutida && !avisoStorageMostrado) {
          avisoStorageMostrado = true;
          var aviso = document.getElementById('aviso-storage');
          if (aviso) {
            aviso.hidden = false;
            aviso.textContent = 'O Firebase Storage não entregou as fotos (a cobrança do projeto está desativada). As fotos novas ficam salvas dentro da partida e funcionam na TV e no celular.';
          }
        }
        fotosCarregadas.push(guardada.url);
        preview.dataset.url = guardada.url;
        URL.revokeObjectURL(local);
        preview.querySelector('img').src = guardada.url;
      } catch (error) {
        console.error(error);
        URL.revokeObjectURL(local);
        preview.remove();
        Memoria.mostrarToast(error.message === 'formato'
          ? 'Não consegui abrir uma das fotos. Use JPG, PNG ou WebP.'
          : Memoria.mensagemErro(error));
      } finally {
        enviandoFotos -= 1;
        atualizarContador();
      }
    }
    if (!lista.length) return;
    if (ignorados === lista.length) {
      Memoria.mostrarToast('Não reconheci essas fotos. Use JPG, PNG ou WebP.');
    }
  }

  function prepararUpload() {
    var zona = document.getElementById('upload-zone');
    var input = document.getElementById('input-fotos');
    zona.addEventListener('dragover', function (evento) {
      evento.preventDefault();
      zona.classList.add('dragover');
    });
    zona.addEventListener('dragleave', function () {
      zona.classList.remove('dragover');
    });
    zona.addEventListener('drop', function (evento) {
      evento.preventDefault();
      zona.classList.remove('dragover');
      handleFiles(evento.dataTransfer.files);
    });
    zona.addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', function () {
      handleFiles(input.files);
      input.value = '';
    });
  }

  function selecionarNivel(nivel) {
    if (!NIVEIS[nivel]) return;
    nivelSelecionado = nivel;
    document.querySelectorAll('.nivel-btn').forEach(function (btn) {
      var ativo = btn.dataset.nivel === nivel;
      btn.classList.toggle('selecionado', ativo);
      btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
    atualizarContador();
  }

  function atualizarTempo(valor) {
    tempoPorJogada = parseInt(valor, 10) || 10;
    document.getElementById('tempo-valor').textContent = String(tempoPorJogada);
  }

  function urlDoJogador(partidaId) {
    var url = new URL('jogador.html', window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('partida', partidaId);
    return url.toString();
  }

  async function desenharQR(elemento, texto) {
    elemento.replaceChildren();
    try {
      var modulo = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
      var canvas = document.createElement('canvas');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'QR code para entrar na partida');
      elemento.appendChild(canvas);
      var api = modulo.default || modulo;
      await api.toCanvas(canvas, texto, {
        width: 180,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#1a1a2e', light: '#ffffff' }
      });
    } catch (error) {
      console.error(error);
      elemento.textContent = 'QR indisponível. Use o link abaixo.';
    }
  }

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      Memoria.mostrarToast('Link copiado.');
    } catch (error) {
      Memoria.mostrarToast('Selecione o link e copie manualmente.');
    }
  }

  function observarJogadores(partidaId) {
    if (ouvintesJogadores.has(partidaId)) return;
    var ref = database.ref('jogadores');
    var tratar = function (snap) {
      var lista = document.getElementById('jogadores-lista-' + partidaId);
      var count = document.getElementById('jogadores-count-' + partidaId);
      if (!lista || !count) return;
      var jogadores = Memoria.jogadoresDaPartida(snap, partidaId);
      count.textContent = '👥 ' + jogadores.length + '/6';
      lista.replaceChildren();
      jogadores.forEach(function (jogador) {
        var badge = document.createElement('div');
        badge.className = 'jogador-badge';
        var img = document.createElement('img');
        img.className = 'jogador-foto-mini';
        img.alt = '';
        img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
        img.addEventListener('error', function () {
          img.src = Memoria.gerarAvatarPadrao(jogador.nome);
        });
        var nome = document.createElement('span');
        nome.textContent = jogador.nome || 'Jogador';
        badge.appendChild(img);
        badge.appendChild(nome);
        lista.appendChild(badge);
      });
    };
    ref.on('value', tratar);
    ouvintesJogadores.set(partidaId, function () { ref.off('value', tratar); });
  }

  function criarCardPartida(id, partida) {
    var card = document.createElement('article');
    card.className = 'partida-card';
    card.dataset.partida = id;
    var link = urlDoJogador(id);

    var titulo = document.createElement('h3');
    titulo.className = 'partida-nome';
    card.appendChild(titulo);

    var qrBox = document.createElement('div');
    qrBox.className = 'qr-container';
    var qr = document.createElement('div');
    qr.className = 'qr-code';
    qr.id = 'qr-' + id;
    qrBox.appendChild(qr);
    card.appendChild(qrBox);

    var linkLinha = document.createElement('div');
    linkLinha.className = 'link-linha';
    var campo = document.createElement('input');
    campo.className = 'link-partida';
    campo.readOnly = true;
    campo.value = link;
    campo.setAttribute('aria-label', 'Link da partida para o celular');
    var copiar = document.createElement('button');
    copiar.type = 'button';
    copiar.className = 'btn-partida btn-ver';
    copiar.textContent = 'Copiar link';
    copiar.addEventListener('click', function () { copiarTexto(link); });
    linkLinha.appendChild(campo);
    linkLinha.appendChild(copiar);
    card.appendChild(linkLinha);

    var info = document.createElement('div');
    info.className = 'partida-info';
    info.innerHTML = '<span class="info-badge info-nivel"></span><span class="info-badge info-tempo"></span><span class="info-badge" id="jogadores-count-' + id + '">👥 0/6</span>';
    card.appendChild(info);

    var lista = document.createElement('div');
    lista.className = 'jogadores-lista';
    lista.id = 'jogadores-lista-' + id;
    card.appendChild(lista);

    var botoes = document.createElement('div');
    botoes.className = 'partida-btns';
    var iniciar = document.createElement('button');
    iniciar.type = 'button';
    iniciar.className = 'btn-partida btn-iniciar';
    iniciar.addEventListener('click', function () { iniciarJogo(id); });
    var ver = document.createElement('button');
    ver.type = 'button';
    ver.className = 'btn-partida btn-ver';
    ver.textContent = '👁️ Ver';
    ver.addEventListener('click', function () { abrirJogo(id); });
    var encerrar = document.createElement('button');
    encerrar.type = 'button';
    encerrar.className = 'btn-partida btn-encerrar';
    encerrar.textContent = '🗑️ Encerrar';
    encerrar.addEventListener('click', function () { encerrarPartida(id); });
    botoes.appendChild(iniciar);
    botoes.appendChild(ver);
    botoes.appendChild(encerrar);
    card.appendChild(botoes);

    atualizarCard(card, partida);
    desenharQR(qr, link);
    observarJogadores(id);
    return card;
  }

  function atualizarCard(card, partida) {
    card.querySelector('.partida-nome').textContent = partida.nome || 'Partida';
    card.querySelector('.info-nivel').textContent = '📊 ' + Memoria.nomeNivel(partida.nivel);
    card.querySelector('.info-tempo').textContent = '⏱️ ' + (partida.tempoPorJogada || 10) + 's';
    var iniciar = card.querySelector('.btn-iniciar');
    var emJogo = !!partida.jogando && !partida.finalizada;
    iniciar.disabled = emJogo;
    iniciar.textContent = emJogo ? '🎮 Em andamento' : '▶️ Iniciar';
  }

  function mensagemVazia() {
    var vazio = document.createElement('div');
    vazio.className = 'empty-message';
    vazio.innerHTML = '<div class="emoji">🎴</div><p>Nenhuma partida ativa</p><p><small>Crie uma nova partida acima</small></p>';
    return vazio;
  }

  function carregarPartidas() {
    var ref = database.ref('partidas');
    ref.on('value', function (snapshot) {
      var container = document.getElementById('partidas-lista');
      var brutas = snapshot.val() || {};
      var ativas = Object.keys(brutas)
        .filter(function (id) { return brutas[id] && brutas[id].ativa; })
        .map(function (id) { return [id, brutas[id]]; });

      if (!ativas.length) {
        ouvintesJogadores.forEach(function (parar) { parar(); });
        ouvintesJogadores.clear();
        container.replaceChildren(mensagemVazia());
        return;
      }

      var grade = container.querySelector('.partidas-grid');
      if (!grade) {
        container.replaceChildren();
        grade = document.createElement('div');
        grade.className = 'partidas-grid';
        container.appendChild(grade);
      }

      var ids = {};
      ativas.forEach(function (par) { ids[par[0]] = true; });
      Array.prototype.slice.call(grade.querySelectorAll('[data-partida]')).forEach(function (card) {
        if (!ids[card.dataset.partida]) {
          var parar = ouvintesJogadores.get(card.dataset.partida);
          if (parar) parar();
          ouvintesJogadores.delete(card.dataset.partida);
          card.remove();
        }
      });

      ativas.forEach(function (par) {
        var existente = grade.querySelector('[data-partida="' + par[0] + '"]');
        if (!existente) grade.appendChild(criarCardPartida(par[0], par[1]));
        else atualizarCard(existente, par[1]);
      });
    }, function (error) {
      console.error(error);
      mostrarBanner(Memoria.mensagemErro(error));
    });
  }

  async function criarPartida() {
    var botao = document.getElementById('btn-criar');
    var minimo = NIVEIS[nivelSelecionado].pares;
    if (enviandoFotos > 0) {
      Memoria.mostrarToast('Espere as fotos terminarem de carregar.');
      return;
    }
    if (fotosCarregadas.length < minimo) {
      Memoria.mostrarToast('Você precisa de pelo menos ' + minimo + ' fotos para o nível ' + Memoria.nomeNivel(nivelSelecionado) + '.');
      return;
    }
    var nomeCampo = document.getElementById('nome-partida').value.trim();
    var nome = nomeCampo || 'Memória Natal 2026';
    botao.disabled = true;
    botao.textContent = '⏳ Criando…';
    try {
      var escolhidas = Memoria.embaralhar(fotosCarregadas).slice(0, minimo);
      var tabuleiro = Memoria.criarTabuleiro(escolhidas);
      var partidaId = database.ref('partidas').push().key;
      await database.ref('partidas/' + partidaId).set({
        nome: nome,
        fotos: escolhidas,
        nivel: nivelSelecionado,
        totalPares: minimo,
        tempoPorJogada: tempoPorJogada,
        maxJogadores: 6,
        ativa: true,
        jogando: false,
        vezDoJogador: null,
        paresEncontrados: 0,
        totalJogadas: 0,
        finalizada: false,
        vencedor: null,
        criadaEm: Date.now()
      });
      await database.ref('tabuleiro/' + partidaId).set(tabuleiro);
      fotosCarregadas = [];
      document.getElementById('fotos-grid').replaceChildren();
      document.getElementById('nome-partida').value = '';
      atualizarContador();
      Memoria.mostrarToast('Partida criada. Mostre o QR code para a família.');
      Memoria.anunciar('Partida ' + nome + ' criada.');
    } catch (error) {
      console.error(error);
      Memoria.mostrarToast(Memoria.mensagemErro(error));
      atualizarContador();
    }
  }

  async function abrirFotosAnteriores() {
    var modal = document.getElementById('modal-fotos');
    modal.classList.add('ativa');
    fotosSelecionadasModal = [];
    atualizarContadorModal();
    var corpo = document.getElementById('modal-fotos-body');
    corpo.innerHTML = '<div class="modal-loading"><div class="loader"></div><p>Carregando fotos...</p></div>';
    try {
      fotosAnteriores = await coletarFotosAnteriores();
      if (!fotosAnteriores.length) {
        corpo.innerHTML = '<div class="modal-empty"><div class="modal-empty-icon">📷</div><p>Nenhuma foto encontrada nas partidas anteriores.</p></div>';
        return;
      }
      renderizarFotosAnteriores();
    } catch (error) {
      console.error(error);
      corpo.innerHTML = '<div class="modal-empty"><div class="modal-empty-icon">❌</div><p>' + Memoria.escaparHtml(Memoria.mensagemErro(error)) + '</p></div>';
    }
  }

  async function coletarFotosAnteriores() {
    var vistas = {};
    var fotos = [];
    function adicionar(url) {
      if (!url || vistas[url]) return;
      vistas[url] = true;
      fotos.push(url);
    }
    var snap = await database.ref('partidas').once('value');
    snap.forEach(function (child) {
      var dados = child.val() || {};
      (dados.fotos || []).forEach(adicionar);
    });
    return fotos;
  }

  function renderizarFotosAnteriores() {
    var corpo = document.getElementById('modal-fotos-body');
    corpo.replaceChildren();
    var aviso = document.createElement('p');
    aviso.className = 'aviso-storage';
    aviso.textContent = 'Fotos antigas guardadas só no Storage podem não abrir enquanto a cobrança do Firebase estiver desativada. As que abrirem podem ser reutilizadas.';
    corpo.appendChild(aviso);
    var grade = document.createElement('div');
    grade.className = 'fotos-anteriores-grid';
    fotosAnteriores.forEach(function (url, idx) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'foto-anterior';
      item.dataset.idx = String(idx);
      item.setAttribute('aria-pressed', 'false');
      item.setAttribute('aria-label', 'Foto ' + (idx + 1));
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = url;
      img.addEventListener('error', function () {
        item.classList.add('indisponivel');
        item.disabled = true;
        item.setAttribute('aria-label', 'Foto indisponível');
      });
      var check = document.createElement('div');
      check.className = 'check';
      check.textContent = '✓';
      item.appendChild(img);
      item.appendChild(check);
      item.addEventListener('click', function () { toggleFotoAnterior(idx); });
      grade.appendChild(item);
    });
    corpo.appendChild(grade);
  }

  function toggleFotoAnterior(idx) {
    var url = fotosAnteriores[idx];
    var botoes = document.querySelectorAll('.foto-anterior');
    var botao = botoes[idx];
    if (!botao || botao.classList.contains('indisponivel')) return;
    var pos = fotosSelecionadasModal.indexOf(url);
    if (pos === -1) fotosSelecionadasModal.push(url);
    else fotosSelecionadasModal.splice(pos, 1);
    var selecionada = pos === -1;
    botao.classList.toggle('selecionada', selecionada);
    botao.setAttribute('aria-pressed', selecionada ? 'true' : 'false');
    atualizarContadorModal();
  }

  function atualizarContadorModal() {
    var count = fotosSelecionadasModal.length;
    document.getElementById('fotos-selecionadas-count').textContent = String(count);
    document.getElementById('btn-usar-fotos').disabled = count === 0;
  }

  function fecharFotosAnteriores() {
    document.getElementById('modal-fotos').classList.remove('ativa');
  }

  function usarFotosSelecionadas() {
    var grade = document.getElementById('fotos-grid');
    fotosSelecionadasModal.forEach(function (url) {
      if (fotosCarregadas.indexOf(url) !== -1) return;
      fotosCarregadas.push(url);
      grade.appendChild(criarPreview(url));
    });
    atualizarContador();
    fecharFotosAnteriores();
  }

  async function iniciarJogo(partidaId) {
    try {
      var partidaSnap = await database.ref('partidas/' + partidaId).once('value');
      var partida = partidaSnap.val();
      if (partida && (partida.finalizada || (partida.paresEncontrados || 0) > 0)) {
        partidaAtualId = partidaId;
        await reiniciarMesa(partida);
        abrirJogo(partidaId);
        return;
      }
      var jogadores = await Memoria.listarJogadoresAtivos(database, partidaId);
      if (!jogadores.length) {
        Memoria.mostrarToast('Espere pelo menos 1 jogador entrar na partida.');
        return;
      }
      for (var i = 0; i < jogadores.length; i++) {
        await database.ref('jogadores/' + jogadores[i].id + '/ordem').set(i);
      }
      var primeiro = jogadores[0].id;
      await database.ref('partidas/' + partidaId).update({
        jogando: true,
        finalizada: false,
        vezDoJogador: primeiro,
        paresEncontrados: 0,
        totalJogadas: 0,
        vencedor: null
      });
      await database.ref('jogada_atual/' + partidaId).set({
        jogadorId: primeiro,
        cartasViradas: [],
        inicioJogada: Date.now()
      });
      abrirJogo(partidaId);
    } catch (error) {
      console.error(error);
      Memoria.mostrarToast(Memoria.mensagemErro(error));
    }
  }

  async function reiniciarMesa(partida) {
    var id = partidaAtualId;
    var tabuleiro = Memoria.criarTabuleiro(partida.fotos || []);
    var jogadores = await Memoria.listarJogadoresAtivos(database, id);
    await Promise.all(jogadores.map(function (jogador, idx) {
      return database.ref('jogadores/' + jogador.id).update({ pares: 0, ordem: idx });
    }));
    var primeiro = jogadores[0] ? jogadores[0].id : null;
    await database.ref('partidas/' + id).update({
      jogando: !!primeiro,
      vezDoJogador: primeiro,
      paresEncontrados: 0,
      totalJogadas: 0,
      finalizada: false,
      vencedor: null,
      ativa: true
    });
    await database.ref('tabuleiro/' + id).set(tabuleiro);
    await database.ref('ultima_jogada/' + id).remove();
    if (primeiro) {
      await database.ref('jogada_atual/' + id).set({
        jogadorId: primeiro,
        cartasViradas: [],
        inicioJogada: Date.now()
      });
    }
  }

  function limparJogo() {
    ouvintesJogo.forEach(function (parar) { parar(); });
    ouvintesJogo = [];
    if (relogio) clearInterval(relogio);
    relogio = null;
    estado = {
      partida: null,
      tabuleiro: null,
      jogada: null,
      jogadores: {},
      fimMostrado: false,
      ultimaChave: null
    };
    var tabuleiro = document.getElementById('tabuleiro');
    if (tabuleiro) {
      tabuleiro.replaceChildren();
      delete tabuleiro.dataset.assinatura;
    }
  }

  function abrirJogo(partidaId) {
    limparJogo();
    partidaAtualId = partidaId;
    mostrarTela('tela-jogo');
    carregarJogo(partidaId);
  }

  function carregarJogo(partidaId) {
    var partidaRef = database.ref('partidas/' + partidaId);
    var aoPartida = function (snap) {
      var partida = snap.val();
      if (!partida) return;
      estado.partida = partida;
      document.getElementById('jogo-titulo').textContent = '🎴 ' + (partida.nome || 'Jogo da Memória');
      document.getElementById('stat-total').textContent = String(partida.totalPares || 0);
      document.getElementById('stat-encontrados').textContent = String(partida.paresEncontrados || 0);
      document.getElementById('stat-faltam').textContent = String((partida.totalPares || 0) - (partida.paresEncontrados || 0));
      document.getElementById('stat-jogadas').textContent = String(partida.totalJogadas || 0);
      if (partida.finalizada) {
        if (!estado.fimMostrado) {
          estado.fimMostrado = true;
          mostrarFimDeJogo(partidaId);
        }
      } else {
        estado.fimMostrado = false;
      }
      atualizarVezAtual(partida.vezDoJogador);
      destacarRanking(partida.vezDoJogador);
      if (estado.tabuleiro) renderizarTabuleiro();
    };
    partidaRef.on('value', aoPartida);
    ouvintesJogo.push(function () { partidaRef.off('value', aoPartida); });

    var tabRef = database.ref('tabuleiro/' + partidaId);
    var aoTab = function (snap) {
      estado.tabuleiro = snap.val();
      if (estado.tabuleiro && estado.partida) renderizarTabuleiro();
    };
    tabRef.on('value', aoTab);
    ouvintesJogo.push(function () { tabRef.off('value', aoTab); });

    var jogadaRef = database.ref('jogada_atual/' + partidaId);
    var aoJogada = function (snap) {
      estado.jogada = snap.val();
      aplicarViradas();
      vigiarTempo();
    };
    jogadaRef.on('value', aoJogada);
    ouvintesJogo.push(function () { jogadaRef.off('value', aoJogada); });

    var jogadoresRef = database.ref('jogadores');
    var aoJogadores = function (snap) {
      var mapa = {};
      snap.forEach(function (child) {
        var jogador = child.val();
        if (jogador && jogador.partidaId === partidaId && jogador.ativo) {
          mapa[child.key] = Object.assign({ id: child.key }, jogador);
        }
      });
      estado.jogadores = mapa;
      atualizarRanking();
      if (estado.partida) atualizarVezAtual(estado.partida.vezDoJogador);
    };
    jogadoresRef.on('value', aoJogadores);
    ouvintesJogo.push(function () { jogadoresRef.off('value', aoJogadores); });

    var ultimaRef = database.ref('ultima_jogada/' + partidaId);
    var aoUltima = function (snap) { mostrarUltimaJogada(snap.val()); };
    ultimaRef.on('value', aoUltima);
    ouvintesJogo.push(function () { ultimaRef.off('value', aoUltima); });

    relogio = setInterval(vigiarTempo, 400);
  }

  function assinaturaTabuleiro() {
    var tab = estado.tabuleiro;
    if (!tab || !tab.posicoes || !estado.partida) return '';
    return estado.partida.nivel + '|' + tab.posicoes.map(function (id) {
      var carta = tab.cartas[id];
      return id + (carta && carta.encontrada ? '*' : '');
    }).join(',');
  }

  function renderizarTabuleiro() {
    var container = document.getElementById('tabuleiro');
    var tab = estado.tabuleiro;
    if (!container || !tab || !tab.posicoes) return;
    var assinatura = assinaturaTabuleiro();
    if (container.dataset.assinatura !== assinatura) {
      container.dataset.assinatura = assinatura;
      container.className = 'tabuleiro ' + (estado.partida.nivel || 'facil');
      container.replaceChildren();
      tab.posicoes.forEach(function (cartaId, idx) {
        var carta = tab.cartas[cartaId] || {};
        var div = document.createElement('div');
        div.className = 'carta' + (carta.encontrada ? ' encontrada virada' : '');
        div.dataset.posicao = String(idx);
        var inner = document.createElement('div');
        inner.className = 'carta-inner';
        var verso = document.createElement('div');
        verso.className = 'carta-verso';
        var frente = document.createElement('div');
        frente.className = 'carta-frente';
        var img = document.createElement('img');
        img.alt = 'Foto da carta';
        img.src = Memoria.urlDaCarta(carta, estado.partida.fotos);
        img.addEventListener('error', function () {
          frente.classList.add('sem-foto');
          frente.textContent = 'Foto indisponível';
          img.remove();
        });
        frente.appendChild(img);
        inner.appendChild(verso);
        inner.appendChild(frente);
        div.appendChild(inner);
        container.appendChild(div);
      });
    }
    aplicarViradas();
  }

  function aplicarViradas() {
    var posicoes = Memoria.comoLista(estado.jogada && estado.jogada.cartasViradas);
    var set = {};
    posicoes.forEach(function (pos) { set[pos] = true; });
    document.querySelectorAll('#tabuleiro .carta').forEach(function (carta) {
      var idx = carta.dataset.posicao;
      var encontrada = carta.classList.contains('encontrada');
      carta.classList.toggle('virada', encontrada || !!set[idx]);
    });
  }

  function atualizarVezAtual(jogadorId) {
    var container = document.getElementById('vez-container');
    if (!container) return;
    if (!jogadorId || !estado.partida || !estado.partida.jogando) {
      if (container.dataset.jogador !== 'aguardando') {
        container.dataset.jogador = 'aguardando';
        container.innerHTML = '<div class="aguardando"><div class="loader"></div><div class="aguardando-texto">Aguardando início...</div></div>';
      }
      return;
    }
    var jogador = estado.jogadores[jogadorId];
    if (!jogador) return;
    if (container.dataset.jogador === jogadorId && document.getElementById('vez-timer')) {
      atualizarTextoTimer();
      return;
    }
    container.dataset.jogador = jogadorId;
    container.replaceChildren();
    var box = document.createElement('div');
    box.className = 'vez-jogador';
    var img = document.createElement('img');
    img.className = 'vez-foto';
    img.alt = '';
    img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
    img.addEventListener('error', function () { img.src = Memoria.gerarAvatarPadrao(jogador.nome); });
    var nome = document.createElement('div');
    nome.className = 'vez-nome';
    nome.textContent = jogador.nome || 'Jogador';
    var timer = document.createElement('div');
    timer.className = 'vez-timer';
    timer.id = 'vez-timer';
    timer.textContent = '--';
    box.appendChild(img);
    box.appendChild(nome);
    box.appendChild(timer);
    container.appendChild(box);
    Memoria.anunciar('Vez de ' + nome.textContent);
    atualizarTextoTimer();
  }

  function atualizarTextoTimer() {
    var timer = document.getElementById('vez-timer');
    if (!timer || !estado.partida || !estado.jogada) return;
    var restante = Memoria.tempoRestante(estado.jogada, estado.partida.tempoPorJogada);
    timer.textContent = restante + 's';
    timer.classList.toggle('baixo', restante <= 3);
  }

  function atualizarRanking() {
    var container = document.getElementById('ranking-lista');
    if (!container) return;
    var lista = Object.keys(estado.jogadores).map(function (id) { return estado.jogadores[id]; });
    lista.sort(function (a, b) { return (b.pares || 0) - (a.pares || 0); });
    container.replaceChildren();
    lista.forEach(function (jogador, idx) {
      var item = document.createElement('div');
      item.className = 'ranking-item';
      item.dataset.id = jogador.id;
      var pos = document.createElement('div');
      pos.className = 'ranking-posicao';
      pos.textContent = (idx + 1) + 'º';
      var img = document.createElement('img');
      img.className = 'ranking-foto';
      img.alt = '';
      img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
      img.addEventListener('error', function () { img.src = Memoria.gerarAvatarPadrao(jogador.nome); });
      var info = document.createElement('div');
      info.className = 'ranking-info';
      var nome = document.createElement('div');
      nome.className = 'ranking-nome';
      nome.textContent = jogador.nome || 'Jogador';
      var pares = document.createElement('div');
      pares.className = 'ranking-pares';
      pares.textContent = Memoria.estrelas(jogador.pares || 0);
      info.appendChild(nome);
      info.appendChild(pares);
      item.appendChild(pos);
      item.appendChild(img);
      item.appendChild(info);
      container.appendChild(item);
    });
    if (estado.partida) destacarRanking(estado.partida.vezDoJogador);
  }

  function destacarRanking(jogadorId) {
    document.querySelectorAll('#ranking-lista .ranking-item').forEach(function (item) {
      item.classList.toggle('atual', item.dataset.id === jogadorId);
    });
  }

  function mostrarUltimaJogada(ultima) {
    var container = document.getElementById('ultima-jogada');
    if (!container) return;
    if (!ultima) {
      container.className = 'ultima-jogada';
      container.textContent = '';
      return;
    }
    var chave = String(ultima.timestamp || '') + ':' + (ultima.tipo || '');
    var nova = chave !== estado.ultimaChave;
    estado.ultimaChave = chave;
    var jogador = estado.jogadores[ultima.jogador];
    var nome = jogador ? jogador.nome : 'Jogador';
    container.className = 'ultima-jogada ' + (ultima.tipo || '');
    if (ultima.tipo === 'acerto') container.textContent = '✅ ' + nome + ' acertou! +1 par';
    else if (ultima.tipo === 'tempo') container.textContent = '⏰ ' + nome + ' ficou sem tempo';
    else container.textContent = '❌ ' + nome + ' errou';

    var recente = ultima.timestamp && (Date.now() - ultima.timestamp) < 8000;
    if (!nova || !recente || !ultima.posicoes) return;
    var cartas = document.querySelectorAll('#tabuleiro .carta');
    ultima.posicoes.forEach(function (pos) {
      if (!cartas[pos]) return;
      cartas[pos].classList.add(ultima.tipo === 'acerto' ? 'acertou' : 'errou');
      setTimeout(function () {
        if (cartas[pos]) cartas[pos].classList.remove('acertou', 'errou');
      }, 650);
    });
    if (ultima.tipo === 'acerto') mostrarConfetes();
  }

  async function vigiarTempo() {
    atualizarTextoTimer();
    var partida = estado.partida;
    var jogada = estado.jogada;
    if (!partida || !jogada || !partida.jogando || partida.finalizada || !partidaAtualId) return;
    var viradas = Memoria.comoLista(jogada.cartasViradas);
    if (viradas.length >= 2) {
      var chavePar = String(jogada.inicioJogada) + ':' + viradas.join(',');
      if (vistoParChave !== chavePar) {
        vistoParChave = chavePar;
        vistoParEm = Date.now();
      }
      if (!processandoResolucao && Date.now() - vistoParEm > 4500) {
        await resolverJogada(viradas.slice(0, 2));
      }
      return;
    }
    vistoParChave = '';
    vistoParEm = 0;
    if (jogada.encerrada) return;
    if (Memoria.tempoRestante(jogada, partida.tempoPorJogada) > 0) return;
    if (processandoTempo) return;
    processandoTempo = true;
    try {
      var inicio = jogada.inicioJogada;
      var reivindicada = await Memoria.reivindicarJogada(database, partidaAtualId, function (atual) {
        if (atual.inicioJogada !== inicio) return false;
        if (Memoria.comoLista(atual.cartasViradas).length >= 2) return false;
        return Memoria.tempoRestante(atual, partida.tempoPorJogada) <= 0;
      }, 'tempo');
      if (!reivindicada) return;
      await database.ref('ultima_jogada/' + partidaAtualId).set({
        jogador: reivindicada.jogadorId,
        tipo: 'tempo',
        posicoes: Memoria.comoLista(reivindicada.cartasViradas),
        timestamp: Date.now()
      });
      await Memoria.incrementarNumero(database, 'partidas/' + partidaAtualId + '/totalJogadas');
      await Memoria.passarVez(database, partidaAtualId, reivindicada.jogadorId);
    } catch (error) {
      console.error(error);
    } finally {
      processandoTempo = false;
    }
  }

  async function resolverJogada(posicoes) {
    if (processandoResolucao || !partidaAtualId) return null;
    processandoResolucao = true;
    try {
      var jogada = await Memoria.reivindicarJogada(database, partidaAtualId, function (atual) {
        var viradas = Memoria.comoLista(atual.cartasViradas);
        return viradas.length >= 2 && viradas[0] === posicoes[0] && viradas[1] === posicoes[1];
      }, 'resolvida');
      if (!jogada) return null;
      var tabSnap = await database.ref('tabuleiro/' + partidaAtualId).once('value');
      var tab = tabSnap.val();
      if (!tab) return null;
      var c1 = tab.cartas[tab.posicoes[posicoes[0]]];
      var c2 = tab.cartas[tab.posicoes[posicoes[1]]];
      var acertou = Memoria.mesmaFoto(c1, c2);
      await database.ref('ultima_jogada/' + partidaAtualId).set({
        jogador: jogada.jogadorId,
        tipo: acertou ? 'acerto' : 'erro',
        posicoes: posicoes,
        timestamp: Date.now()
      });
      await Memoria.incrementarNumero(database, 'partidas/' + partidaAtualId + '/totalJogadas');
      if (acertou) {
        await database.ref('tabuleiro/' + partidaAtualId + '/cartas/' + c1.id + '/encontrada').set(true);
        await database.ref('tabuleiro/' + partidaAtualId + '/cartas/' + c2.id + '/encontrada').set(true);
        await Memoria.incrementarNumero(database, 'jogadores/' + jogada.jogadorId + '/pares');
        var total = await Memoria.incrementarNumero(database, 'partidas/' + partidaAtualId + '/paresEncontrados');
        var partidaSnap = await database.ref('partidas/' + partidaAtualId).once('value');
        var partida = partidaSnap.val() || {};
        if (total >= (partida.totalPares || 0)) {
          await finalizarPartida(jogada.jogadorId);
        } else {
          await database.ref('jogada_atual/' + partidaAtualId).set({
            jogadorId: jogada.jogadorId,
            cartasViradas: [],
            inicioJogada: Date.now()
          });
        }
        return 'acerto';
      }
      await Memoria.passarVez(database, partidaAtualId, jogada.jogadorId);
      return 'erro';
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      processandoResolucao = false;
    }
  }

  async function finalizarPartida() {
    var ranking = await Memoria.listarJogadoresAtivos(database, partidaAtualId);
    ranking.sort(function (a, b) { return (b.pares || 0) - (a.pares || 0); });
    var topo = ranking[0];
    var maior = topo ? (topo.pares || 0) : 0;
    var empatados = ranking.filter(function (j) { return (j.pares || 0) === maior; });
    await database.ref('partidas/' + partidaAtualId).update({
      finalizada: true,
      jogando: false,
      vencedor: empatados.length === 1 && topo ? topo.id : null
    });
  }

  async function mostrarFimDeJogo(partidaId) {
    mostrarTela('tela-fim');
    var jogadores = await Memoria.listarJogadoresAtivos(database, partidaId);
    jogadores.sort(function (a, b) { return (b.pares || 0) - (a.pares || 0); });
    var podio = document.getElementById('podio-container');
    podio.replaceChildren();
    [1, 0, 2].forEach(function (indice) {
      var jogador = jogadores[indice];
      if (!jogador) return;
      var lugar = document.createElement('div');
      lugar.className = 'podio-lugar';
      if (indice === 0) {
        var coroa = document.createElement('div');
        coroa.className = 'coroa';
        coroa.textContent = '👑';
        lugar.appendChild(coroa);
      }
      var img = document.createElement('img');
      img.className = 'podio-foto';
      img.alt = '';
      img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
      var nome = document.createElement('div');
      nome.className = 'podio-nome';
      nome.textContent = jogador.nome || 'Jogador';
      var pares = document.createElement('div');
      pares.className = 'podio-pares';
      pares.textContent = (jogador.pares || 0) + ' pares';
      var base = document.createElement('div');
      base.className = 'podio-base';
      base.textContent = String(indice + 1);
      lugar.appendChild(img);
      lugar.appendChild(nome);
      lugar.appendChild(pares);
      lugar.appendChild(base);
      podio.appendChild(lugar);
    });

    var rankingEl = document.getElementById('ranking-final-lista');
    rankingEl.replaceChildren();
    var medalhas = ['🥇', '🥈', '🥉'];
    jogadores.forEach(function (jogador, idx) {
      var item = document.createElement('div');
      item.className = 'ranking-final-item';
      var pos = document.createElement('div');
      pos.className = 'ranking-final-pos';
      pos.textContent = medalhas[idx] || ((idx + 1) + 'º');
      var img = document.createElement('img');
      img.className = 'ranking-final-foto';
      img.alt = '';
      img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
      var nome = document.createElement('div');
      nome.className = 'ranking-final-nome';
      nome.textContent = jogador.nome || 'Jogador';
      var pares = document.createElement('div');
      pares.className = 'ranking-final-pares';
      pares.textContent = (jogador.pares || 0) + ' pares';
      item.appendChild(pos);
      item.appendChild(img);
      item.appendChild(nome);
      item.appendChild(pares);
      rankingEl.appendChild(item);
    });
    mostrarConfetes();
    if (!Memoria.prefereMenosMovimento()) {
      setTimeout(mostrarConfetes, 500);
    }
    Memoria.anunciar('Fim de jogo.');
  }

  function mostrarConfetes() {
    if (Memoria.prefereMenosMovimento()) return;
    var container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    var cores = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#ffd700'];
    for (var i = 0; i < 50; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.background = cores[Math.floor(Math.random() * cores.length)];
      piece.style.animationDelay = (Math.random() * 0.5) + 's';
      piece.style.animationDuration = (2 + Math.random() * 2) + 's';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      piece.style.width = (5 + Math.random() * 10) + 'px';
      piece.style.height = (5 + Math.random() * 10) + 'px';
      container.appendChild(piece);
    }
    setTimeout(function () { container.remove(); }, 4000);
  }

  async function encerrarPartida(partidaId) {
    if (!window.confirm('Encerrar esta partida? Os jogadores saem do jogo, mas as fotos continuam disponíveis para uma próxima.')) return;
    try {
      await database.ref('partidas/' + partidaId).update({ ativa: false, jogando: false });
      await database.ref('tabuleiro/' + partidaId).remove();
      await database.ref('jogada_atual/' + partidaId).remove();
      await database.ref('ultima_jogada/' + partidaId).remove();
      var snap = await database.ref('jogadores').once('value');
      var remocoes = [];
      snap.forEach(function (child) {
        var jogador = child.val();
        if (jogador && jogador.partidaId === partidaId) remocoes.push(child.ref.remove());
      });
      await Promise.all(remocoes);
      if (partidaAtualId === partidaId) voltarConfig();
      Memoria.mostrarToast('Partida encerrada.');
    } catch (error) {
      console.error(error);
      Memoria.mostrarToast(Memoria.mensagemErro(error));
    }
  }

  function encerrarPartidaAtual() {
    if (partidaAtualId) encerrarPartida(partidaAtualId);
  }

  function voltarConfig() {
    limparJogo();
    partidaAtualId = null;
    mostrarTela('tela-config');
  }

  async function jogarNovamente() {
    if (!partidaAtualId) return;
    var id = partidaAtualId;
    try {
      var partidaSnap = await database.ref('partidas/' + id).once('value');
      var partida = partidaSnap.val();
      if (!partida || !partida.fotos) return;
      await reiniciarMesa(partida);
      abrirJogo(id);
    } catch (error) {
      console.error(error);
      Memoria.mostrarToast(Memoria.mensagemErro(error));
    }
  }

  function novaPartida() {
    partidaAtualId = null;
    voltarConfig();
  }

  async function resetarTudo() {
    if (!window.confirm('Isso apaga TODAS as partidas da família, inclusive as antigas. Tem certeza?')) return;
    if (!window.confirm('Última confirmação: as partidas e os jogadores serão removidos. As fotos do Storage não são apagadas.')) return;
    try {
      await database.ref('partidas').remove();
      await database.ref('jogadores').remove();
      await database.ref('tabuleiro').remove();
      await database.ref('jogada_atual').remove();
      await database.ref('ultima_jogada').remove();
      Memoria.mostrarToast('Tudo foi resetado.');
      voltarConfig();
    } catch (error) {
      console.error(error);
      Memoria.mostrarToast(Memoria.mensagemErro(error));
    }
  }

  function mostrarTela(telaId) {
    document.querySelectorAll('.tela').forEach(function (tela) {
      var ativa = tela.id === telaId;
      tela.classList.toggle('ativa', ativa);
      if (ativa) tela.removeAttribute('hidden');
    });
  }

  function prepararModal() {
    var modal = document.getElementById('modal-fotos');
    modal.addEventListener('click', function (evento) {
      if (evento.target === modal) fecharFotosAnteriores();
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && modal.classList.contains('ativa')) fecharFotosAnteriores();
    });
  }

  async function iniciar() {
    try {
      var servicos = Memoria.iniciarFirebase();
      database = servicos.database;
      storage = servicos.storage;
    } catch (error) {
      mostrarBanner('Não foi possível carregar o Firebase. Verifique a internet e atualize a página.');
      return;
    }
    Memoria.observarConexao(database, document.getElementById('status-conexao'));
    prepararUpload();
    prepararModal();
    atualizarContador();
    carregarPartidas();
    var storageOk = await Memoria.storageDisponivel(storage);
    if (!storageOk) {
      var aviso = document.getElementById('aviso-storage');
      if (aviso) {
        aviso.hidden = false;
        aviso.textContent = 'As fotos antigas do Firebase Storage não abrem porque a cobrança do projeto está desativada. Dá para jogar do mesmo jeito: as fotos novas ficam salvas na partida.';
      }
    }
  }

  window.selecionarNivel = selecionarNivel;
  window.atualizarTempo = atualizarTempo;
  window.criarPartida = criarPartida;
  window.abrirFotosAnteriores = abrirFotosAnteriores;
  window.fecharFotosAnteriores = fecharFotosAnteriores;
  window.usarFotosSelecionadas = usarFotosSelecionadas;
  window.iniciarJogo = iniciarJogo;
  window.abrirJogo = abrirJogo;
  window.encerrarPartida = encerrarPartida;
  window.encerrarPartidaAtual = encerrarPartidaAtual;
  window.voltarConfig = voltarConfig;
  window.jogarNovamente = jogarNovamente;
  window.novaPartida = novaPartida;
  window.resetarTudo = resetarTudo;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
