require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configurações de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Muitas tentativas, tente novamente em 15 minutos'
});
app.use(limiter);

// Sessões
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/siteemanuel')
  .then(() => console.log('Conectado ao MongoDB'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  coins: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  adminLevel: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false },
  banReason: String,
  banExpires: Date,
  bannedIPs: [String],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  reward: { type: Number, required: true },
  uses: { type: Number, default: 0 },
  maxUses: { type: Number, default: -1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  isGlobal: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);
const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
const Chat = mongoose.model('Chat', chatSchema);

// Middleware de autenticação
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  const user = await User.findById(req.session.userId);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  req.user = user;
  next();
};

// Filtro de palavrões
const badWords = ['palavrao1', 'palavrao2', 'palavrao3'];
const filterBadWords = (text) => {
  let filtered = text;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  return filtered;
};

// Rotas de autenticação
app.post('/api/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Usuário ou email já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const isFirstUser = await User.countDocuments() === 0;
    const isAdminUser = username === process.env.ADMIN_USERNAME;
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      isAdmin: isFirstUser || isAdminUser,
      adminLevel: isFirstUser || isAdminUser ? 10 : 0,
      coins: isFirstUser || isAdminUser ? 10000 : 100
    });

    await user.save();
    
    req.session.userId = user._id;
    res.json({ success: true, user: { username: user.username, isAdmin: user.isAdmin } });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/login', [
  body('username').trim().escape(),
  body('password').exists()
], async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    if (user.isBanned && user.banExpires > new Date()) {
      return res.status(403).json({ 
        error: 'Conta banida',
        banReason: user.banReason,
        banExpires: user.banExpires
      });
    }

    req.session.userId = user._id;
    res.json({ 
      success: true, 
      user: { 
        username: user.username, 
        isAdmin: user.isAdmin,
        coins: user.coins
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Rotas do painel administrativo
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

app.post('/api/admin/ban', requireAdmin, async (req, res) => {
  try {
    const { userId, reason, duration } = req.body;
    
    const banExpires = new Date();
    banExpires.setHours(banExpires.getHours() + parseInt(duration));
    
    await User.findByIdAndUpdate(userId, {
      isBanned: true,
      banReason: reason,
      banExpires: banExpires
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao banir usuário' });
  }
});

app.post('/api/admin/unban', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      isBanned: false,
      banReason: null,
      banExpires: null
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desbanir usuário' });
  }
});

app.post('/api/admin/promote', requireAdmin, async (req, res) => {
  try {
    const { userId, adminLevel } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      isAdmin: adminLevel > 0,
      adminLevel: parseInt(adminLevel)
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao promover usuário' });
  }
});

app.post('/api/admin/promo-code', requireAdmin, async (req, res) => {
  try {
    const { code, reward, maxUses } = req.body;
    
    const promoCode = new PromoCode({
      code: code.toUpperCase(),
      reward: parseInt(reward),
      maxUses: parseInt(maxUses),
      createdBy: req.user._id
    });
    
    await promoCode.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar código promocional' });
  }
});

app.get('/api/admin/promo-codes', requireAdmin, async (req, res) => {
  try {
    const promoCodes = await PromoCode.find().populate('createdBy', 'username');
    res.json(promoCodes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar códigos promocionais' });
  }
});

// Rotas do usuário
app.get('/api/user/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId, '-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

app.post('/api/user/redeem-code', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    
    const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });
    if (!promoCode) {
      return res.status(400).json({ error: 'Código inválido' });
    }
    
    if (promoCode.maxUses > 0 && promoCode.uses >= promoCode.maxUses) {
      return res.status(400).json({ error: 'Código esgotado' });
    }
    
    await User.findByIdAndUpdate(req.session.userId, {
      $inc: { coins: promoCode.reward }
    });
    
    await PromoCode.findByIdAndUpdate(promoCode._id, {
      $inc: { uses: 1 }
    });
    
    res.json({ success: true, reward: promoCode.reward });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao resgatar código' });
  }
});

// Socket.IO para chat em tempo real
io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);
  
  socket.on('join-chat', async (userId) => {
    const user = await User.findById(userId);
    if (user && !user.isBanned) {
      socket.userId = userId;
      socket.username = user.username;
      socket.join('global-chat');
    }
  });
  
  socket.on('send-message', async (data) => {
    if (!socket.userId) return;
    
    const user = await User.findById(socket.userId);
    if (!user || user.isBanned) return;
    
    const filteredMessage = filterBadWords(data.message);
    
    const chatMessage = new Chat({
      username: user.username,
      message: filteredMessage,
      isGlobal: true
    });
    
    await chatMessage.save();
    
    io.to('global-chat').emit('new-message', {
      username: user.username,
      message: filteredMessage,
      timestamp: new Date()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
  });
});

// Servir arquivos estáticos
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});