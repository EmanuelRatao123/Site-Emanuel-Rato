require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
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

// Configurar SQLite
const db = new sqlite3.Database('database.db');

// Criar tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    coins INTEGER DEFAULT 0,
    isAdmin INTEGER DEFAULT 0,
    adminLevel INTEGER DEFAULT 0,
    isBanned INTEGER DEFAULT 0,
    banReason TEXT,
    banExpires TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    reward INTEGER,
    uses INTEGER DEFAULT 0,
    maxUses INTEGER DEFAULT -1,
    createdBy INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    isGlobal INTEGER DEFAULT 1
  )`);

  // Criar admin padrão
  const adminUsername = process.env.ADMIN_USERNAME || 'Emanuel';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdmLegal123';
  
  db.get('SELECT * FROM users WHERE username = ?', [adminUsername], (err, row) => {
    if (!row) {
      bcrypt.hash(adminPassword, 12, (err, hash) => {
        db.run(`INSERT INTO users (username, email, password, coins, isAdmin, adminLevel) 
                VALUES (?, ?, ?, ?, ?, ?)`, 
                [adminUsername, 'admin@site.com', hash, 10000, 1, 10]);
      });
    }
  });
});

// Configurações de segurança
app.use(helmet({
  contentSecurityPolicy: false
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

// Middleware de autenticação
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    req.user = user;
    next();
  });
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
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
    if (user) {
      return res.status(400).json({ error: 'Usuário ou email já existe' });
    }

    bcrypt.hash(password, 12, (err, hash) => {
      db.run(`INSERT INTO users (username, email, password, coins) VALUES (?, ?, ?, ?)`,
        [username, email, hash, 100], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Erro ao criar usuário' });
          }
          
          req.session.userId = this.lastID;
          res.json({ 
            success: true, 
            user: { username, isAdmin: false, coins: 100 } 
          });
        });
    });
  });
});

app.post('/api/login', [
  body('username').trim().escape(),
  body('password').exists()
], (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], (err, user) => {
    if (!user) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    bcrypt.compare(password, user.password, (err, match) => {
      if (!match) {
        return res.status(400).json({ error: 'Credenciais inválidas' });
      }

      if (user.isBanned && new Date(user.banExpires) > new Date()) {
        return res.status(403).json({ 
          error: 'Conta banida',
          banReason: user.banReason,
          banExpires: user.banExpires
        });
      }

      req.session.userId = user.id;
      res.json({ 
        success: true, 
        user: { 
          username: user.username, 
          isAdmin: user.isAdmin,
          coins: user.coins
        } 
      });
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Rotas do painel administrativo
app.get('/api/admin/users', requireAdmin, (req, res) => {
  db.all('SELECT id, username, email, coins, isAdmin, adminLevel, isBanned, banReason, banExpires, createdAt FROM users ORDER BY createdAt DESC', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
    res.json(users);
  });
});

app.post('/api/admin/ban', requireAdmin, (req, res) => {
  const { userId, reason, duration } = req.body;
  
  const banExpires = new Date();
  banExpires.setHours(banExpires.getHours() + parseInt(duration));
  
  db.run('UPDATE users SET isBanned = 1, banReason = ?, banExpires = ? WHERE id = ?',
    [reason, banExpires.toISOString(), userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao banir usuário' });
      }
      res.json({ success: true });
    });
});

app.post('/api/admin/unban', requireAdmin, (req, res) => {
  const { userId } = req.body;
  
  db.run('UPDATE users SET isBanned = 0, banReason = NULL, banExpires = NULL WHERE id = ?',
    [userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao desbanir usuário' });
      }
      res.json({ success: true });
    });
});

app.post('/api/admin/promote', requireAdmin, (req, res) => {
  const { userId, adminLevel } = req.body;
  
  db.run('UPDATE users SET isAdmin = ?, adminLevel = ? WHERE id = ?',
    [adminLevel > 0 ? 1 : 0, parseInt(adminLevel), userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao promover usuário' });
      }
      res.json({ success: true });
    });
});

app.post('/api/admin/promo-code', requireAdmin, (req, res) => {
  const { code, reward, maxUses } = req.body;
  
  db.run('INSERT INTO promo_codes (code, reward, maxUses, createdBy) VALUES (?, ?, ?, ?)',
    [code.toUpperCase(), parseInt(reward), parseInt(maxUses), req.user.id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao criar código promocional' });
      }
      res.json({ success: true });
    });
});

app.get('/api/admin/promo-codes', requireAdmin, (req, res) => {
  db.all(`SELECT p.*, u.username as createdByUsername 
          FROM promo_codes p 
          LEFT JOIN users u ON p.createdBy = u.id 
          ORDER BY p.createdAt DESC`, (err, promoCodes) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar códigos promocionais' });
    }
    
    const formatted = promoCodes.map(p => ({
      ...p,
      createdBy: { username: p.createdByUsername }
    }));
    
    res.json(formatted);
  });
});

// Rotas do usuário
app.get('/api/user/profile', requireAuth, (req, res) => {
  db.get('SELECT id, username, email, coins, isAdmin, adminLevel FROM users WHERE id = ?', 
    [req.session.userId], (err, user) => {
      if (err || !user) {
        return res.status(500).json({ error: 'Erro ao buscar perfil' });
      }
      res.json(user);
    });
});

app.post('/api/user/redeem-code', requireAuth, (req, res) => {
  const { code } = req.body;
  
  db.get('SELECT * FROM promo_codes WHERE code = ?', [code.toUpperCase()], (err, promoCode) => {
    if (!promoCode) {
      return res.status(400).json({ error: 'Código inválido' });
    }
    
    if (promoCode.maxUses > 0 && promoCode.uses >= promoCode.maxUses) {
      return res.status(400).json({ error: 'Código esgotado' });
    }
    
    db.run('UPDATE users SET coins = coins + ? WHERE id = ?', 
      [promoCode.reward, req.session.userId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Erro ao resgatar código' });
        }
        
        db.run('UPDATE promo_codes SET uses = uses + 1 WHERE id = ?', [promoCode.id]);
        res.json({ success: true, reward: promoCode.reward });
      });
  });
});

// Socket.IO para chat em tempo real
io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);
  
  socket.on('join-chat', (userId) => {
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
      if (user && !user.isBanned) {
        socket.userId = userId;
        socket.username = user.username;
        socket.join('global-chat');
      }
    });
  });
  
  socket.on('send-message', (data) => {
    if (!socket.userId) return;
    
    db.get('SELECT * FROM users WHERE id = ?', [socket.userId], (err, user) => {
      if (!user || user.isBanned) return;
      
      const filteredMessage = filterBadWords(data.message);
      
      db.run('INSERT INTO chat_messages (username, message) VALUES (?, ?)',
        [user.username, filteredMessage], (err) => {
          if (!err) {
            io.to('global-chat').emit('new-message', {
              username: user.username,
              message: filteredMessage,
              timestamp: new Date()
            });
          }
        });
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