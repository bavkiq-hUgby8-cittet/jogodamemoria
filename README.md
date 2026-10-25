# 🎴 Jogo da Memória dos Veloso

Jogo da Memória multiplayer para a família, no estilo Mario Party: a TV mostra o tabuleiro e o celular de cada pessoa é o controle.

Publicado no GitHub Pages: `https://bavkiq-hugby8-cittet.github.io/jogodamemoria/`

## Arquivos

- `index.html` — painel do operador (TV ou computador)
- `jogador.html` — tela do jogador (celular)
- `comum.js` — Firebase, fotos, regras da partida e utilidades
- `operador.js` — lógica do telão
- `jogador.js` — lógica do celular

## Como jogar

### Operador (TV)

1. Abra `index.html`.
2. Carregue pelo menos 8 fotos (ou reaproveite as que ainda abrirem).
3. Escolha o nível, o tempo de cada jogada e o nome. Se o nome ficar vazio, a partida se chama **Memória Natal 2026**.
4. Toque em **Criar partida** e mostre o QR code. O link também pode ser copiado.
5. Quando todo mundo entrar, toque em **Iniciar**.

### Jogadores (celular)

1. Escaneie o QR code ou abra o link.
2. Digite o nome. A foto é opcional.
3. Entre e espere o operador começar.
4. Na sua vez, toque em 2 cartas antes do tempo acabar. Acertou, joga de novo. Errou ou o tempo acabou, passa a vez.

Dá para jogar sozinho: a vez volta para a mesma pessoa.

## Natal 2026

O exemplo de nome da partida, que ainda citava o Natal de 2024, passou a sugerir **Memória Natal 2026**. Não havia contagem regressiva presa em 2025.

## Firebase

O jogo usa o Realtime Database do projeto `jogodamemoria-61432` para sincronizar a partida. A chave de API do Firebase que aparece no `comum.js` é a chave pública do app web. Ela não é uma senha: quem protege os dados são as regras do banco. Sem login de jogador, as regras precisam permitir leitura e escrita nos caminhos do jogo. Isso significa que qualquer pessoa com o endereço do projeto consegue alterar partidas. Não publique o link do operador fora da família.

Em outubro de 2026 o Realtime Database respondia nos caminhos `partidas`, `jogadores`, `tabuleiro`, `jogada_atual` e `ultima_jogada`. O caminho `biblioteca` não existe nas regras e continua bloqueado de propósito: as fotos reutilizáveis são lidas das próprias partidas.

### Regras sugeridas do Realtime Database

```json
{
  "rules": {
    "partidas": {
      ".read": true,
      ".write": true,
      ".indexOn": ["ativa"]
    },
    "jogadores": {
      ".read": true,
      ".write": true,
      ".indexOn": ["partidaId"]
    },
    "tabuleiro": {
      ".read": true,
      ".write": true
    },
    "jogada_atual": {
      ".read": true,
      ".write": true
    },
    "ultima_jogada": {
      ".read": true,
      ".write": true
    }
  }
}
```

O jogo também filtra partidas e jogadores no próprio navegador, então funciona mesmo sem esses índices.

### Fotos e Storage

As fotos do Natal de 2025 estão no Firebase Storage (`memorias/` e `jogadores/`). Em outubro de 2026 o Google recusava o download com HTTP 402: a conta de cobrança do projeto está **encerrada**. A listagem dos arquivos ainda responde, mas a imagem em si não abre. Nada foi apagado.

Enquanto o Storage estiver assim, fotos novas são reduzidas no navegador e gravadas dentro da partida, no Realtime Database. A TV e os celulares recebem a mesma imagem sem passar pelo Storage. Se a cobrança for reativada, o jogo volta a usar o Storage automaticamente.

Para reativar: no console do Google Cloud / Firebase, reabra a conta de cobrança do projeto `jogodamemoria-61432`. O plano Spark costuma bastar para este jogo. Regras de Storage que o jogo espera quando o bucket voltar a entregar arquivos:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

`allow read` também permite listar. Quem souber o nome do bucket consegue ver os nomes das fotos. É o custo de não ter login. Se quiser esconder a lista, troque para `allow get: if true; allow list: if false;` — o botão de fotos anteriores deixa de achar arquivos só do Storage, mas as partidas novas continuam funcionando.

## O que o telão controla

- Níveis: 8 pares (4×4), 12 pares (6×4) ou 18 pares (6×6)
- Tempo de 5 a 30 segundos. Se acabar, a vez passa sozinha, desde que a TV ou algum celular esteja com o jogo aberto
- Até 6 jogadores
- Placar, pódio e confete
- **Jogar novamente** embaralha as mesmas fotos e zera os pontos, sem tirar quem já entrou

## Testar na sua rede

Abra os arquivos por um servidor local, não dê dois cliques no HTML. Na pasta do projeto:

```bash
python3 -m http.server 8765
```

Depois use `http://localhost:8765/index.html` na TV e o link do QR no celular. Os aparelhos precisam alcançar esse endereço (no GitHub Pages isso já acontece).
