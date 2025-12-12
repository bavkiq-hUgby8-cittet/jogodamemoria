# 🎴 Jogo da Memória dos Veloso

Jogo da Memória multiplayer com Firebase - estilo Mario Party!

## 📁 Arquivos

- `index.html` - Painel do Operador (TV/telão)
- `jogador.html` - Interface do Jogador (celular)

## 🚀 Deploy no GitHub Pages

1. Crie um repositório público no GitHub (ex: `memoria-veloso`)
2. Faça upload dos 2 arquivos HTML
3. Vá em Settings → Pages → Deploy from main branch
4. Acesse: `https://[seu-usuario].github.io/[nome-do-repo]/`

## ⚙️ Configuração do Firebase (IMPORTANTE!)

### Storage Rules
No Console Firebase → Storage → Rules, cole:

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

### Realtime Database Rules
No Console Firebase → Realtime Database → Rules, cole:

```json
{
  "rules": {
    "partidas": {
      ".read": true,
      ".write": true
    },
    "jogadores": {
      ".read": true,
      ".write": true
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

## 🎮 Como Usar

### Operador (TV/Telão)
1. Abra `index.html` no navegador da TV
2. Carregue as fotos que serão as cartas do jogo
3. Escolha o nível (Fácil/Médio/Difícil)
4. Ajuste o tempo por jogada
5. Clique em "Criar Partida"
6. Mostre o QR code para os jogadores

### Jogadores (Celular)
1. Escaneie o QR code com o celular
2. Digite seu nome
3. Tire uma foto ou escolha da galeria (opcional)
4. Clique em "ENTRAR NO JOGO"
5. Aguarde o operador iniciar
6. Quando for sua vez, clique em 2 cartas!

## 🎯 Recursos

- ✅ Upload múltiplo de fotos
- ✅ 3 níveis de dificuldade (8, 12 ou 18 pares)
- ✅ Timer configurável (5-30s)
- ✅ Até 6 jogadores simultâneos
- ✅ QR code para entrada fácil
- ✅ Cartas com flip 3D
- ✅ Vibração no celular
- ✅ Confete nas vitórias
- ✅ Placar em tempo real
- ✅ Pódio animado no final

## 🔧 Solução de Problemas

### Fotos não carregam
- Verifique se as Storage Rules estão corretas
- O Storage precisa aceitar escrita em `/{allPaths=**}` (não só em `/memorias/`)

### QR code não aparece
- Atualize a página
- Verifique a conexão com internet

### Cartas não aparecem no jogador
- Verifique as Database Rules
- Certifique-se que o operador criou o tabuleiro

### Jogador não consegue entrar
- Verifique se a partida ainda está ativa
- Verifique se há vagas (máximo 6)

## 📱 Testando Localmente

Você pode testar abrindo os arquivos HTML diretamente no navegador, mas para funcionar corretamente entre dispositivos, é melhor usar o GitHub Pages.

---

Feito com ❤️ para a família Veloso!
