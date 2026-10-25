(function () {
  'use strict';

  var database = null;
  var storage = null;
  var partidaId = null;
  var meuJogadorId = null;
  var minhaFotoUrl = null;
  var partidaAtual = null;
  var tabuleiroAtual = null;
  var jogadaAtual = null;
  var jogadoresAtuais = {};
  var ouvintes = [];
  var ouvinteVagas = null;
  var relogio = null;
  var bloqueioClique = false;
  var processandoTempo = false;
  var processandoResolucao = false;
  var fimMostrado = false;
  var vistoParChave = '';
  var vistoParEm = 0;
  var ultimaChave = '';

  function mostrarErro(titulo, texto) {
    document.getElementById('erro-titulo').textContent = titulo;
    document.getElementById('erro-texto').textContent = texto;
    mostrarTela('tela-erro');
  }

  function mostrarTela(telaId) {
    var telas = document.querySelectorAll('.tela');
    for (var i = 0; i < telas.length; i++) {
      var ativa = telas[i].id === telaId;
      telas[i].classList.toggle('ativa', ativa);
    }
    if (telaId === 'tela-jogando') ajustarAltura();
  }

  function pararOuvintes() {
    ouvintes.forEach(function (parar) { parar(); });
    ouvintes = [];
    if (ouvinteVagas) {
      ouvinteVagas();
      ouvinteVagas = null;
    }
    if (relogio) clearInterval(relogio);
    relogio = null;
  }

  function observarVagas() {
    if (ouvinteVagas) ouvinteVagas();
    var ref = database.ref('jogadores');
    var tratar = function (snap) {
      var count = Memoria.jogadoresDaPartida(snap, partidaId).length;
      var info = document.getElementById('vagas-info');
      var botao = document.getElementById('btn-entrar');
      if (!info) return;
      if (count >= 6) {
        info.textContent = 'Partida lotada. As 6 vagas estão ocupadas.';
        if (botao) botao.disabled = true;
      } else {
        info.innerHTML = 'ℹ️ <strong>' + count + '</strong> de 6 vagas ocupadas';
        verificarFormulario();
      }
    };
    ref.on('value', tratar);
    ouvinteVagas = function () { ref.off('value', tratar); };
  }

  function verificarFormulario() {
    var nome = document.getElementById('input-nome').value.trim();
    var info = document.getElementById('vagas-info');
    var lotado = info && info.textContent.indexOf('lotada') !== -1;
    document.getElementById('btn-entrar').disabled = lotado || nome.length < 2;
  }

  async function handleFotoUpload(evento) {
    var file = evento.target.files && evento.target.files[0];
    evento.target.value = '';
    if (!file) return;
    var preview = document.getElementById('foto-preview');
    preview.innerHTML = '<div class="loader" style="width:30px;height:30px;border-width:3px;"></div>';
    try {
      var guardada = await Memoria.guardarFoto(storage, file, 'jogadores', 240, 240);
      minhaFotoUrl = guardada.url;
      preview.innerHTML = '';
      var img = document.createElement('img');
      img.src = minhaFotoUrl;
      img.alt = 'Sua foto';
      preview.appendChild(img);
      preview.style.borderStyle = 'solid';
      preview.style.borderColor = 'var(--verde)';
    } catch (error) {
      console.error(error);
      minhaFotoUrl = null;
      preview.innerHTML = '<span class="placeholder">👤</span>';
      preview.style.borderStyle = 'dashed';
      Memoria.mostrarToast(error.message === 'formato'
        ? 'Não consegui abrir essa foto. Use JPG ou PNG, ou entre sem foto.'
        : Memoria.mensagemErro(error));
    }
    verificarFormulario();
  }

  async function entrarNoJogo() {
    var nome = document.getElementById('input-nome').value.trim();
    if (nome.length < 2) return;
    var botao = document.getElementById('btn-entrar');
    botao.disabled = true;
    botao.textContent = '⏳ Entrando...';
    try {
      var ativos = await Memoria.listarJogadoresAtivos(database, partidaId);
      if (ativos.length >= 6) {
        Memoria.mostrarToast('Partida lotada. Todas as vagas foram preenchidas.');
        botao.disabled = false;
        botao.textContent = '🎮 ENTRAR NO JOGO';
        return;
      }
      var ref = database.ref('jogadores').push();
      meuJogadorId = ref.key;
      await ref.set({
        partidaId: partidaId,
        nome: nome,
        foto: minhaFotoUrl || null,
        pares: 0,
        ordem: ativos.length,
        ativo: true
      });
      localStorage.setItem('jogador_' + partidaId, meuJogadorId);
      iniciarListeners();
    } catch (error) {
      console.error(error);
      meuJogadorId = null;
      Memoria.mostrarToast(Memoria.mensagemErro(error));
      botao.disabled = false;
      botao.textContent = '🎮 ENTRAR NO JOGO';
    }
  }

  function iniciarListeners() {
    pararOuvintes();
    var partidaRef = database.ref('partidas/' + partidaId);
    var aoPartida = function (snap) { aplicarPartida(snap.val()); };
    partidaRef.on('value', aoPartida);
    ouvintes.push(function () { partidaRef.off('value', aoPartida); });

    var jogadoresRef = database.ref('jogadores');
    var aoJogadores = function (snap) {
      jogadoresAtuais = {};
      Memoria.jogadoresDaPartida(snap, partidaId).forEach(function (jogador) {
        jogadoresAtuais[jogador.id] = jogador;
      });
      atualizarJogadoresProntos();
      atualizarPlacar();
      atualizarMeusPares();
      if (partidaAtual && partidaAtual.jogando && !partidaAtual.finalizada) atualizarVezOutro();
    };
    jogadoresRef.on('value', aoJogadores);
    ouvintes.push(function () { jogadoresRef.off('value', aoJogadores); });

    var tabRef = database.ref('tabuleiro/' + partidaId);
    var aoTab = function (snap) {
      tabuleiroAtual = snap.val();
      if (minhaVez()) renderizarMeuTabuleiro();
    };
    tabRef.on('value', aoTab);
    ouvintes.push(function () { tabRef.off('value', aoTab); });

    var jogadaRef = database.ref('jogada_atual/' + partidaId);
    var aoJogada = function (snap) {
      jogadaAtual = snap.val();
      if (minhaVez()) {
        aplicarViradas();
        atualizarCartasViradasDisplay(Memoria.comoLista(jogadaAtual && jogadaAtual.cartasViradas).length);
      }
      vigiarTempo();
    };
    jogadaRef.on('value', aoJogada);
    ouvintes.push(function () { jogadaRef.off('value', aoJogada); });

    var ultimaRef = database.ref('ultima_jogada/' + partidaId);
    var aoUltima = function (snap) { reagirUltimaJogada(snap.val()); };
    ultimaRef.on('value', aoUltima);
    ouvintes.push(function () { ultimaRef.off('value', aoUltima); });

    relogio = setInterval(function () {
      atualizarTextoTimer();
      vigiarTempo();
    }, 400);
  }

  function aplicarPartida(partida) {
    if (!partida) {
      mostrarErro('Partida não encontrada', 'Peça ao operador para gerar um novo QR code.');
      return;
    }
    if (!partida.ativa) {
      mostrarErro('Partida encerrada', 'O operador encerrou esta partida.');
      return;
    }
    partidaAtual = partida;
    var nome2 = document.getElementById('partida-nome-2');
    if (nome2) nome2.textContent = partida.nome || '';
    if (!meuJogadorId) return;
    if (partida.finalizada) {
      mostrarFimDeJogo();
      return;
    }
    fimMostrado = false;
    if (partida.jogando) verificarVez();
    else {
      mostrarTela('tela-aguardando');
      atualizarInfoPartida();
    }
  }

  function minhaVez() {
    return !!(partidaAtual && partidaAtual.jogando && !partidaAtual.finalizada && partidaAtual.vezDoJogador === meuJogadorId);
  }

  function atualizarInfoPartida() {
    var info = document.getElementById('partida-info-box');
    if (!info || !partidaAtual) return;
    info.replaceChildren();
    [
      ['🎴', String(partidaAtual.totalPares || 0), 'pares'],
      ['⏱️', (partidaAtual.tempoPorJogada || 10) + 's', 'por jogada'],
      ['📊', Memoria.nomeNivel(partidaAtual.nivel), 'nível']
    ].forEach(function (item) {
      var box = document.createElement('div');
      box.className = 'info-item';
      box.innerHTML = '<div class="info-icon">' + item[0] + '</div><div class="info-value"></div><div class="info-label"></div>';
      box.querySelector('.info-value').textContent = item[1];
      box.querySelector('.info-label').textContent = item[2];
      info.appendChild(box);
    });
  }

  function atualizarJogadoresProntos() {
    var container = document.getElementById('jogadores-prontos');
    if (!container) return;
    container.replaceChildren();
    Object.keys(jogadoresAtuais).forEach(function (id) {
      var jogador = jogadoresAtuais[id];
      var item = document.createElement('div');
      item.className = 'jogador-item';
      var img = document.createElement('img');
      img.className = 'jogador-foto-mini';
      img.alt = '';
      img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
      img.addEventListener('error', function () { img.src = Memoria.gerarAvatarPadrao(jogador.nome); });
      var nome = document.createElement('span');
      nome.className = 'jogador-nome';
      nome.textContent = (jogador.nome || 'Jogador') + (id === meuJogadorId ? ' (você)' : '');
      var check = document.createElement('span');
      check.className = 'jogador-check';
      check.textContent = '✅';
      item.appendChild(img);
      item.appendChild(nome);
      item.appendChild(check);
      container.appendChild(item);
    });
  }

  function verificarVez() {
    if (!partidaAtual || !partidaAtual.jogando || partidaAtual.finalizada) return;
    if (minhaVez()) {
      mostrarTela('tela-jogando');
      renderizarMeuTabuleiro();
      atualizarMeusPares();
      atualizarTextoTimer();
      Memoria.anunciar('Sua vez.');
    } else {
      mostrarTela('tela-vez-outro');
      atualizarVezOutro();
      atualizarPlacar();
    }
  }

  function atualizarVezOutro() {
    var container = document.getElementById('vez-jogador-card');
    if (!container || !partidaAtual) return;
    var jogadorId = partidaAtual.vezDoJogador;
    var jogador = jogadoresAtuais[jogadorId];
    if (!jogador) return;
    if (container.dataset.jogador === jogadorId && document.getElementById('vez-timer-outro')) {
      atualizarTextoTimer();
      return;
    }
    container.dataset.jogador = jogadorId || '';
    container.replaceChildren();
    var img = document.createElement('img');
    img.className = 'vez-foto-grande';
    img.alt = '';
    img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
    img.addEventListener('error', function () { img.src = Memoria.gerarAvatarPadrao(jogador.nome); });
    var nome = document.createElement('div');
    nome.className = 'vez-nome-grande';
    nome.textContent = jogador.nome || 'Jogador';
    var timer = document.createElement('div');
    timer.className = 'vez-timer-grande';
    timer.id = 'vez-timer-outro';
    timer.textContent = '--';
    container.appendChild(img);
    container.appendChild(nome);
    container.appendChild(timer);
    atualizarTextoTimer();
  }

  function atualizarPlacar() {
    var container = document.getElementById('placar-lista');
    if (!container) return;
    var lista = Object.keys(jogadoresAtuais).map(function (id) { return jogadoresAtuais[id]; });
    lista.sort(function (a, b) { return (b.pares || 0) - (a.pares || 0); });
    container.replaceChildren();
    lista.forEach(function (jogador, idx) {
      var item = document.createElement('div');
      item.className = 'placar-item' + (jogador.id === meuJogadorId ? ' eu' : '');
      var pos = document.createElement('div');
      pos.className = 'placar-pos';
      pos.textContent = (idx + 1) + 'º';
      var img = document.createElement('img');
      img.className = 'placar-foto';
      img.alt = '';
      img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
      var info = document.createElement('div');
      info.className = 'placar-info';
      var nome = document.createElement('div');
      nome.className = 'placar-nome';
      nome.textContent = jogador.id === meuJogadorId ? 'Você' : (jogador.nome || 'Jogador');
      var estrelas = document.createElement('div');
      estrelas.className = 'placar-estrelas';
      estrelas.textContent = Memoria.estrelas(jogador.pares || 0);
      info.appendChild(nome);
      info.appendChild(estrelas);
      item.appendChild(pos);
      item.appendChild(img);
      item.appendChild(info);
      container.appendChild(item);
    });
  }

  function atualizarTextoTimer() {
    if (!partidaAtual || !jogadaAtual) return;
    var restante = Memoria.tempoRestante(jogadaAtual, partidaAtual.tempoPorJogada);
    ['jogo-timer', 'vez-timer-outro'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = restante + 's';
      el.classList.toggle('baixo', restante <= 3);
    });
  }

  function assinaturaTabuleiro() {
    if (!tabuleiroAtual || !tabuleiroAtual.posicoes || !partidaAtual) return '';
    return (partidaAtual.nivel || '') + '|' + tabuleiroAtual.posicoes.map(function (id) {
      var carta = tabuleiroAtual.cartas[id];
      return id + (carta && carta.encontrada ? '*' : '');
    }).join(',');
  }

  function renderizarMeuTabuleiro() {
    var container = document.getElementById('tabuleiro');
    if (!container || !tabuleiroAtual || !tabuleiroAtual.posicoes || !partidaAtual) return;
    var assinatura = assinaturaTabuleiro();
    if (container.dataset.assinatura !== assinatura) {
      container.dataset.assinatura = assinatura;
      container.className = 'tabuleiro ' + (partidaAtual.nivel || 'facil');
      container.replaceChildren();
      tabuleiroAtual.posicoes.forEach(function (cartaId, idx) {
        var carta = tabuleiroAtual.cartas[cartaId];
        if (!carta) return;
        var botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'carta' + (carta.encontrada ? ' encontrada virada' : '');
        botao.dataset.posicao = String(idx);
        botao.setAttribute('aria-label', carta.encontrada ? 'Par já encontrado' : 'Carta virada para baixo');
        var inner = document.createElement('div');
        inner.className = 'carta-inner';
        var verso = document.createElement('div');
        verso.className = 'carta-verso';
        var frente = document.createElement('div');
        frente.className = 'carta-frente';
        var img = document.createElement('img');
        img.alt = '';
        img.src = Memoria.urlDaCarta(carta, partidaAtual.fotos);
        img.addEventListener('error', function () {
          frente.classList.add('sem-foto');
          frente.textContent = 'Foto indisponível';
          img.remove();
        });
        frente.appendChild(img);
        inner.appendChild(verso);
        inner.appendChild(frente);
        botao.appendChild(inner);
        botao.addEventListener('click', function () { clicarCarta(idx); });
        container.appendChild(botao);
      });
    }
    aplicarViradas();
    atualizarCartasViradasDisplay(Memoria.comoLista(jogadaAtual && jogadaAtual.cartasViradas).length);
    ajustarAltura();
  }

  function aplicarViradas() {
    var posicoes = Memoria.comoLista(jogadaAtual && jogadaAtual.cartasViradas);
    var set = {};
    posicoes.forEach(function (pos) { set[pos] = true; });
    document.querySelectorAll('#tabuleiro .carta').forEach(function (carta) {
      var idx = carta.dataset.posicao;
      var encontrada = carta.classList.contains('encontrada');
      var virada = encontrada || !!set[idx];
      carta.classList.toggle('virada', virada);
      if (!encontrada) {
        carta.setAttribute('aria-label', virada ? 'Carta virada' : 'Carta virada para baixo');
      }
    });
  }

  function atualizarMeusPares() {
    var eu = jogadoresAtuais[meuJogadorId];
    var el = document.getElementById('meus-pares');
    if (el) el.textContent = String(eu ? (eu.pares || 0) : 0);
  }

  function atualizarCartasViradasDisplay(count) {
    var numero = document.getElementById('cartas-viradas-count');
    var dica = document.getElementById('cartas-dica');
    if (numero) numero.textContent = String(Math.min(count, 2));
    if (!dica) return;
    if (count <= 0) dica.textContent = 'Toque em 2 cartas para virar';
    else if (count === 1) dica.textContent = 'Vire mais uma carta!';
    else dica.textContent = 'Verificando...';
  }

  async function clicarCarta(posicao) {
    if (bloqueioClique || processandoResolucao) return;
    if (!minhaVez() || !tabuleiroAtual) return;
    var cartaId = tabuleiroAtual.posicoes[posicao];
    var carta = tabuleiroAtual.cartas[cartaId];
    if (!carta || carta.encontrada) return;
    bloqueioClique = true;
    var abriuPar = false;
    try {
      var ref = database.ref('jogada_atual/' + partidaId);
      await ref.once('value');
      var tx = await ref.transaction(function (atual) {
        if (atual == null) return atual;
        if (atual.encerrada) return;
        if (atual.jogadorId !== meuJogadorId) return;
        var viradas = Memoria.comoLista(atual.cartasViradas);
        if (viradas.length >= 2 || viradas.indexOf(posicao) !== -1) return;
        viradas.push(posicao);
        atual.cartasViradas = viradas;
        return atual;
      });
      if (!tx.committed) return;
      var jogada = tx.snapshot.val() || {};
      var viradas = Memoria.comoLista(jogada.cartasViradas);
      jogadaAtual = jogada;
      aplicarViradas();
      atualizarCartasViradasDisplay(viradas.length);
      if (viradas.length === 2 && viradas[viradas.length - 1] === posicao) {
        abriuPar = true;
        await Memoria.esperar(Memoria.prefereMenosMovimento() ? 350 : 750);
        var resultado = await resolverJogada(viradas.slice(0, 2));
        if (resultado === 'acerto') {
          vibrar([100, 50, 100]);
          criarConfetti();
        } else if (resultado === 'erro') {
          vibrar([180]);
        }
      }
    } catch (error) {
      console.error(error);
      Memoria.mostrarToast(Memoria.mensagemErro(error));
    } finally {
      if (!abriuPar) bloqueioClique = false;
      else setTimeout(function () { bloqueioClique = false; }, 500);
    }
  }

  async function resolverJogada(posicoes) {
    if (processandoResolucao) return null;
    processandoResolucao = true;
    try {
      var jogada = await Memoria.reivindicarJogada(database, partidaId, function (atual) {
        var viradas = Memoria.comoLista(atual.cartasViradas);
        return viradas.length >= 2 && viradas[0] === posicoes[0] && viradas[1] === posicoes[1];
      }, 'resolvida');
      if (!jogada) return null;
      var tabSnap = await database.ref('tabuleiro/' + partidaId).once('value');
      var tab = tabSnap.val();
      if (!tab) return null;
      var c1 = tab.cartas[tab.posicoes[posicoes[0]]];
      var c2 = tab.cartas[tab.posicoes[posicoes[1]]];
      var acertou = Memoria.mesmaFoto(c1, c2);
      await database.ref('ultima_jogada/' + partidaId).set({
        jogador: jogada.jogadorId,
        tipo: acertou ? 'acerto' : 'erro',
        posicoes: posicoes,
        timestamp: Date.now()
      });
      await Memoria.incrementarNumero(database, 'partidas/' + partidaId + '/totalJogadas');
      if (acertou) {
        await database.ref('tabuleiro/' + partidaId + '/cartas/' + c1.id + '/encontrada').set(true);
        await database.ref('tabuleiro/' + partidaId + '/cartas/' + c2.id + '/encontrada').set(true);
        await Memoria.incrementarNumero(database, 'jogadores/' + jogada.jogadorId + '/pares');
        var total = await Memoria.incrementarNumero(database, 'partidas/' + partidaId + '/paresEncontrados');
        var partidaSnap = await database.ref('partidas/' + partidaId).once('value');
        var partida = partidaSnap.val() || {};
        if (total >= (partida.totalPares || 0)) await finalizarPartida();
        else {
          await database.ref('jogada_atual/' + partidaId).set({
            jogadorId: jogada.jogadorId,
            cartasViradas: [],
            inicioJogada: Date.now()
          });
        }
        return 'acerto';
      }
      await Memoria.passarVez(database, partidaId, jogada.jogadorId);
      return 'erro';
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      processandoResolucao = false;
    }
  }

  async function finalizarPartida() {
    var ranking = await Memoria.listarJogadoresAtivos(database, partidaId);
    ranking.sort(function (a, b) { return (b.pares || 0) - (a.pares || 0); });
    var topo = ranking[0];
    var maior = topo ? (topo.pares || 0) : 0;
    var empatados = ranking.filter(function (j) { return (j.pares || 0) === maior; });
    await database.ref('partidas/' + partidaId).update({
      finalizada: true,
      jogando: false,
      vencedor: empatados.length === 1 && topo ? topo.id : null
    });
  }

  async function vigiarTempo() {
    atualizarTextoTimer();
    if (!partidaAtual || !jogadaAtual || !partidaAtual.jogando || partidaAtual.finalizada) return;
    var viradas = Memoria.comoLista(jogadaAtual.cartasViradas);
    if (viradas.length >= 2) {
      var chavePar = String(jogadaAtual.inicioJogada) + ':' + viradas.join(',');
      if (vistoParChave !== chavePar) {
        vistoParChave = chavePar;
        vistoParEm = Date.now();
      }
      if (!processandoResolucao && !bloqueioClique && Date.now() - vistoParEm > 4500) {
        await resolverJogada(viradas.slice(0, 2));
      }
      return;
    }
    vistoParChave = '';
    vistoParEm = 0;
    if (jogadaAtual.encerrada || processandoTempo) return;
    if (Memoria.tempoRestante(jogadaAtual, partidaAtual.tempoPorJogada) > 0) return;
    processandoTempo = true;
    try {
      var inicio = jogadaAtual.inicioJogada;
      var tempo = partidaAtual.tempoPorJogada;
      var reivindicada = await Memoria.reivindicarJogada(database, partidaId, function (atual) {
        if (atual.inicioJogada !== inicio) return false;
        if (Memoria.comoLista(atual.cartasViradas).length >= 2) return false;
        return Memoria.tempoRestante(atual, tempo) <= 0;
      }, 'tempo');
      if (!reivindicada) return;
      await database.ref('ultima_jogada/' + partidaId).set({
        jogador: reivindicada.jogadorId,
        tipo: 'tempo',
        posicoes: Memoria.comoLista(reivindicada.cartasViradas),
        timestamp: Date.now()
      });
      await Memoria.incrementarNumero(database, 'partidas/' + partidaId + '/totalJogadas');
      await Memoria.passarVez(database, partidaId, reivindicada.jogadorId);
    } catch (error) {
      console.error(error);
    } finally {
      processandoTempo = false;
    }
  }

  function reagirUltimaJogada(ultima) {
    if (!ultima || !ultima.timestamp) return;
    var chave = String(ultima.timestamp) + ':' + ultima.tipo;
    if (chave === ultimaChave) return;
    ultimaChave = chave;
    if (Date.now() - ultima.timestamp > 6000) return;
    if (ultima.tipo === 'tempo' && ultima.jogador === meuJogadorId) {
      mostrarFeedback('tempo');
      vibrar([80, 40, 80]);
    } else if (ultima.tipo === 'acerto' && ultima.jogador === meuJogadorId) {
      mostrarFeedback('acerto');
    } else if (ultima.tipo === 'erro' && ultima.jogador === meuJogadorId) {
      mostrarFeedback('erro');
    }
  }

  function mostrarFeedback(tipo) {
    var overlay = document.createElement('div');
    overlay.className = 'feedback-overlay ' + tipo;
    var icon = tipo === 'acerto' ? '✅' : (tipo === 'tempo' ? '⏰' : '❌');
    var titulo = tipo === 'acerto' ? 'ACERTOU!' : (tipo === 'tempo' ? 'Tempo esgotado!' : 'Não foi dessa vez!');
    var texto = tipo === 'acerto' ? '+1 par para você!' : 'Próximo jogador...';
    overlay.innerHTML = '<div class="feedback-content"><div class="feedback-icon">' + icon + '</div><h2 class="feedback-titulo">' + titulo + '</h2><p class="feedback-texto">' + texto + '</p></div>';
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.remove(); }, 1400);
  }

  function vibrar(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function criarConfetti() {
    if (Memoria.prefereMenosMovimento()) return;
    var container = document.createElement('div');
    container.className = 'confetti-container';
    var cores = ['#667eea', '#f093fb', '#43e97b', '#ffd700', '#4facfe', '#f5af19'];
    for (var i = 0; i < 40; i++) {
      var peca = document.createElement('div');
      peca.className = 'confetti';
      peca.style.left = (Math.random() * 100) + '%';
      peca.style.background = cores[Math.floor(Math.random() * cores.length)];
      peca.style.animationDelay = (Math.random() * 0.5) + 's';
      peca.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      container.appendChild(peca);
    }
    document.body.appendChild(container);
    setTimeout(function () { container.remove(); }, 3500);
  }

  async function mostrarFimDeJogo() {
    if (fimMostrado) return;
    fimMostrado = true;
    mostrarTela('tela-fim');
    criarConfetti();
    var jogadores = await Memoria.listarJogadoresAtivos(database, partidaId);
    jogadores.sort(function (a, b) { return (b.pares || 0) - (a.pares || 0); });
    var minhaPosicao = 1;
    var meusPares = 0;
    jogadores.forEach(function (jogador, idx) {
      if (jogador.id === meuJogadorId) {
        minhaPosicao = idx + 1;
        meusPares = jogador.pares || 0;
      }
    });
    var medalhas = ['🥇', '🥈', '🥉'];
    document.getElementById('fim-posicao').textContent = jogadores.length
      ? 'Você ficou em ' + minhaPosicao + 'º!'
      : 'Fim de jogo!';
    document.getElementById('fim-medalha').textContent = medalhas[minhaPosicao - 1] || '🎖️';
    document.getElementById('fim-pares').innerHTML = 'Seus pares: <strong>' + meusPares + '</strong>';
    var ranking = document.getElementById('ranking-final');
    ranking.replaceChildren();
    jogadores.forEach(function (jogador, idx) {
      var item = document.createElement('div');
      item.className = 'ranking-box-item' + (jogador.id === meuJogadorId ? ' eu' : '');
      var pos = document.createElement('div');
      pos.className = 'ranking-box-pos';
      pos.textContent = medalhas[idx] || ((idx + 1) + 'º');
      var img = document.createElement('img');
      img.className = 'ranking-box-foto';
      img.alt = '';
      img.src = jogador.foto || Memoria.gerarAvatarPadrao(jogador.nome);
      var nome = document.createElement('div');
      nome.className = 'ranking-box-nome';
      nome.textContent = jogador.nome || 'Jogador';
      var pares = document.createElement('div');
      pares.className = 'ranking-box-pares';
      pares.textContent = (jogador.pares || 0) + ' ⭐';
      item.appendChild(pos);
      item.appendChild(img);
      item.appendChild(nome);
      item.appendChild(pares);
      ranking.appendChild(item);
    });
    Memoria.anunciar('Fim de jogo. Você ficou em ' + minhaPosicao + 'º.');
  }

  async function sairDaPartida() {
    try {
      if (meuJogadorId) await database.ref('jogadores/' + meuJogadorId + '/ativo').set(false);
    } catch (error) {
      console.error(error);
    }
    localStorage.removeItem('jogador_' + partidaId);
    meuJogadorId = null;
    window.location.reload();
  }

  function ajustarAltura() {
    var tela = document.getElementById('tela-jogando');
    if (!tela || !tela.classList.contains('ativa')) return;
    var header = tela.querySelector('.jogo-header');
    var info = tela.querySelector('.cartas-info');
    var container = tela.querySelector('.tabuleiro-container');
    if (!container) return;
    var ocupado = (header ? header.offsetHeight : 0) + (info ? info.offsetHeight : 0) + 12;
    container.style.height = 'calc(100dvh - ' + ocupado + 'px)';
  }

  async function init() {
    var params = new URLSearchParams(window.location.search);
    partidaId = params.get('partida');
    if (!partidaId) {
      mostrarErro('Partida não encontrada', 'Escaneie o QR code na TV ou peça um novo link ao operador.');
      return;
    }
    try {
      var servicos = Memoria.iniciarFirebase();
      database = servicos.database;
      storage = servicos.storage;
    } catch (error) {
      mostrarErro('Sem conexão', 'Não foi possível carregar o Firebase. Verifique a internet e tente de novo.');
      return;
    }
    Memoria.observarConexao(database, document.getElementById('status-conexao'));
    try {
      var snap = await database.ref('partidas/' + partidaId).once('value');
      var partida = snap.val();
      if (!partida) {
        mostrarErro('Partida não encontrada', 'Esse QR code não corresponde a uma partida. Peça outro ao operador.');
        return;
      }
      if (!partida.ativa) {
        mostrarErro('Partida encerrada', 'Peça ao operador para criar uma nova ou abrir a partida de novo.');
        return;
      }
      partidaAtual = partida;
      meuJogadorId = localStorage.getItem('jogador_' + partidaId);
      if (meuJogadorId) {
        var jogadorSnap = await database.ref('jogadores/' + meuJogadorId).once('value');
        var jogador = jogadorSnap.val();
        if (jogador && jogador.ativo && jogador.partidaId === partidaId) {
          iniciarListeners();
          return;
        }
        localStorage.removeItem('jogador_' + partidaId);
        meuJogadorId = null;
      }
      document.getElementById('partida-nome').textContent = partida.nome || 'Jogo da Memória';
      observarVagas();
      mostrarTela('tela-cadastro');
    } catch (error) {
      console.error(error);
      mostrarErro('Não deu para entrar', Memoria.mensagemErro(error));
    }
  }

  document.getElementById('btn-camera').addEventListener('click', function () {
    document.getElementById('input-camera').click();
  });
  document.getElementById('btn-galeria').addEventListener('click', function () {
    document.getElementById('input-galeria').click();
  });
  document.getElementById('input-camera').addEventListener('change', handleFotoUpload);
  document.getElementById('input-galeria').addEventListener('change', handleFotoUpload);
  document.getElementById('input-nome').addEventListener('input', verificarFormulario);
  document.getElementById('input-nome').addEventListener('keydown', function (evento) {
    if (evento.key === 'Enter') entrarNoJogo();
  });
  document.getElementById('btn-entrar').addEventListener('click', entrarNoJogo);
  var btnSair = document.getElementById('btn-sair');
  if (btnSair) btnSair.addEventListener('click', sairDaPartida);
  window.addEventListener('resize', ajustarAltura);

  window.sairDaPartida = sairDaPartida;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
