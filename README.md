# Site Emanuel - Sistema de Login e Painel Administrativo

Um site completo com sistema de autenticação, chat global, sistema de moedas e painel administrativo avançado.

## 🚀 Funcionalidades

### Para Usuários
- ✅ Sistema de login e cadastro seguro
- ✅ Sistema de moedas virtuais
- ✅ Chat global em tempo real
- ✅ Sistema de códigos promocionais
- ✅ Filtro automático de palavrões
- ✅ Sistema de amizades (em desenvolvimento)
- ✅ Chats privados (em desenvolvimento)
- ✅ Ligações de vídeo (em desenvolvimento)

### Para Administradores
- ✅ Painel administrativo completo
- ✅ Gerenciamento de usuários
- ✅ Sistema de banimento com motivo e tempo
- ✅ Banimento por IP
- ✅ Criação de códigos promocionais
- ✅ Sistema de níveis administrativos
- ✅ Monitoramento de usuários online/offline
- ✅ Configurações avançadas do sistema

## 🔒 Segurança

- Proteção contra modificação de JavaScript
- Bloqueio de DevTools
- Criptografia de senhas com bcrypt
- Rate limiting para prevenir ataques
- Validação de dados no servidor
- Sessões seguras
- Headers de segurança com Helmet
- Filtro de XSS e SQL Injection

## 📦 Instalação Local

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Edite o arquivo `.env` com suas configurações

5. Execute o projeto:
```bash
npm start
```

## 🌐 Deploy no Render

### 1. Preparação
- Faça upload do código para GitHub
- Crie uma conta no Render.com

### 2. Configuração do Banco de Dados
- Crie um cluster MongoDB Atlas gratuito
- Obtenha a string de conexão

### 3. Deploy no Render
1. Conecte seu repositório GitHub
2. Configure as variáveis de ambiente:
   - `MONGODB_URI`: String de conexão do MongoDB
   - `SESSION_SECRET`: Chave secreta para sessões
   - `ADMIN_USERNAME`: Emanuel
   - `ADMIN_PASSWORD`: [CONFIGURAR NO RENDER]
   - `NODE_ENV`: production

### 4. Configurações de Build
- Build Command: `npm install`
- Start Command: `npm start`

## 🔧 Configurações de Produção

### Variáveis de Ambiente no Render
```
MONGODB_URI=sua_string_de_conexao_mongodb
SESSION_SECRET=sua_chave_secreta_super_forte
ADMIN_USERNAME=Emanuel
ADMIN_PASSWORD=AdmLegal123
NODE_ENV=production
PORT=3000
```

## 👨‍💼 Conta Administrativa

- **Usuário**: Emanuel
- **Senha**: [Configurada nas variáveis de ambiente]
- **Nível**: Super Admin (10)
- **Permissões**: Acesso total ao sistema

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js, Express.js
- **Banco de Dados**: MongoDB
- **Autenticação**: bcryptjs, express-session
- **Chat em Tempo Real**: Socket.IO
- **Segurança**: Helmet, express-rate-limit
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)

## 📱 Responsividade

O site é totalmente responsivo e funciona perfeitamente em:
- Desktop
- Tablets
- Smartphones

## 🔄 Atualizações Futuras

- Sistema de amizades completo
- Chats privados e grupos
- Ligações de voz e vídeo
- Sistema de conquistas
- Loja virtual com moedas
- Notificações push
- App mobile

## 📞 Suporte

Para suporte técnico ou dúvidas, entre em contato através do painel administrativo.

---

**Desenvolvido com ❤️ para Emanuel**