# 🎴 Jogo da Memória dos Veloso

Jogo da memória multiplayer com fotos da família! Estilo Mario Party com cores vibrantes e animações.

## 🎮 Como Funciona

1. **Operador** carrega fotos da família no painel
2. **Até 6 jogadores** entram escaneando o QR code
3. Cada um joga na sua vez, **no próprio celular**
4. Ganha quem encontrar **mais pares**!

## 📱 Características

- ✅ **Multiplayer em tempo real** - sincronizado via Firebase
- ✅ **3 níveis de dificuldade** - Fácil (8 pares), Médio (12 pares), Difícil (18 pares)
- ✅ **Timer por jogada** - configurável de 5 a 30 segundos
- ✅ **QR Code automático** - jogadores entram facilmente
- ✅ **Animações 3D** - cartas viram com efeito flip
- ✅ **Feedback completo** - vibração, confetes, sons visuais
- ✅ **Placar em tempo real** - ranking atualizado instantaneamente
- ✅ **Pódio animado** - celebração no fim do jogo
- ✅ **Touch otimizado** - perfeito para celular
- ✅ **Responsivo** - funciona em qualquer tela

## 🚀 Deploy no GitHub Pages

### Passo 1: Criar Repositório

1. Acesse [github.com](https://github.com) e faça login
2. Clique em **"New repository"**
3. Nome: `memoria-veloso` (ou outro nome de sua escolha)
4. Deixe como **Public**
5. Clique em **"Create repository"**

### Passo 2: Upload dos Arquivos

1. Na página do repositório, clique em **"uploading an existing file"**
2. Arraste os 2 arquivos HTML:
   - `index.html`
   - `jogador.html`
3. Clique em **"Commit changes"**

### Passo 3: Ativar GitHub Pages

1. Vá em **Settings** (aba superior do repositório)
2. No menu lateral, clique em **Pages**
3. Em "Source", selecione **Deploy from a branch**
4. Em "Branch", selecione **main** e pasta **/ (root)**
5. Clique em **Save**

### Passo 4: Acessar

Aguarde 1-2 minutos e acesse:

```
https://[seu-usuario].github.io/memoria-veloso/
```

## 📖 Como Usar

### Para o Operador (TV/Telão):

1. Abra `index.html` no navegador
2. **Carregue fotos** da família (mínimo 8 para nível fácil)
3. Escolha o **nível de dificuldade**
4. Defina o **tempo por jogada**
5. Dê um **nome para a partida**
6. Clique em **"Criar Partida"**
7. Mostre o **QR code** para os jogadores
8. Quando todos entrarem, clique em **"Iniciar"**

### Para os Jogadores (Celular):

1. **Escaneie o QR code** mostrado na TV
2. Digite seu **nome** e tire uma **foto**
3. Clique em **"Entrar no Jogo"**
4. **Aguarde** o operador iniciar
5. Na sua vez:
   - Toque em **2 cartas** para virar
   - Se formar **par**: você ganha 1 ponto e joga de novo!
   - Se **não formar**: próximo jogador

## 🏆 Níveis de Dificuldade

| Nível    | Pares | Grid | Cartas |
|----------|-------|------|--------|
| 🟢 Fácil   | 8     | 4×4  | 16     |
| 🟡 Médio   | 12    | 4×6  | 24     |
| 🔴 Difícil | 18    | 6×6  | 36     |

## ⚙️ Tecnologias

- **HTML5/CSS3/JavaScript** - Frontend standalone
- **Firebase Realtime Database** - Sincronização em tempo real
- **Firebase Storage** - Upload de fotos
- **QRCode.js** - Geração de QR codes
- **Google Fonts** - Pacifico + Poppins

## 📁 Estrutura de Arquivos

```
memoria-veloso/
├── index.html      # Painel do Operador
├── jogador.html    # Interface do Jogador
└── README.md       # Este arquivo
```

## 🔥 Firebase (Já Configurado)

O projeto já vem com Firebase configurado e pronto para uso. As credenciais estão embutidas nos arquivos HTML.

**Projeto Firebase:** `jogodamemoria-61432`

## 🎨 Design

- **Estilo:** Mario Party / Nintendo
- **Cores:** Roxo, Rosa, Azul, Verde, Laranja
- **Fontes:** Pacifico (títulos) + Poppins (corpo)
- **Animações:** Flip 3D, confetes, pulsação, shake

## 🐛 Troubleshooting

### QR Code não funciona
- Verifique se está usando HTTPS (GitHub Pages usa)
- Tente abrir o link manualmente no navegador do celular

### Jogador não aparece na lista
- Recarregue a página do operador
- Verifique a conexão com internet

### Cartas não viram
- Verifique se é realmente sua vez
- O timer pode ter esgotado

### Fotos não carregam
- Fotos muito grandes podem demorar
- Verifique a conexão com internet

## 📝 Licença

Projeto livre para uso pessoal e familiar. Divirta-se! 🎉

---

Desenvolvido com ❤️ para a Família Veloso

**Boa memória!** 🧠✨
