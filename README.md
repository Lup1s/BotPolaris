# BotPolaris

BotPolaris é o assistente oficial e administrador inteligente do servidor Discord Polaris. Desenvolvido com uma arquitetura escalável e moderna, preparado para gerenciar servidores e integrar-se com IA de forma eficiente.

## 🚀 Tecnologias

- [Node.js](https://nodejs.org/) (ES Modules)
- [Discord.js v14](https://discord.js.org/)
- [Dotenv](https://github.com/motdotla/dotenv)

## 📁 Estrutura de Diretórios

O projeto foi projetado com separação de responsabilidades (SOLID, Clean Code):

- `src/commands`: Comandos organizados por níveis de acesso (public, staff, admin, owner).
- `src/events`: Manipuladores de eventos do Discord.
- `src/managers`: Gerenciadores para inicializar comandos e eventos.
- `src/services`: Regras de negócio (Análise, Backup).
- `src/middleware`: Interceptadores para controle de acesso e confirmações.
- `src/ai`: Preparação de infraestrutura para IA (OpenAI, Gemini, Claude).
- `src/logs`: Arquivos de log do sistema.
- `src/backups`: Arquivos de backup em JSON da estrutura do servidor.
- `src/utils`: Funções utilitárias (Logger, etc).
- `src/config`: Arquivos de configuração.

## 🛡️ Níveis de Acesso e Segurança

O bot possui um rigoroso controle de acesso em 5 níveis:
1. **Usuários comuns**
2. **Staff**
3. **Administradores**
4. **Fundadores**
5. **Owner do Bot** (Definido no `.env` como `OWNER_ID`)

Apenas o Owner pode realizar comandos críticos de destruição ou restauração estrutural, sempre mediante um **Sistema de Confirmação**.

## ⚙️ Instalação

1. Clone o repositório ou baixe os arquivos.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie uma cópia de `.env.example` para `.env` e preencha suas chaves:
   ```bash
   cp .env.example .env
   ```

## ▶️ Execução

Para iniciar o bot em modo de produção:
```bash
npm start
```

Para desenvolvimento com auto-reload (Node >= 18):
```bash
npm run dev
```
