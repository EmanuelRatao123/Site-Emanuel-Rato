let socket;
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
});

function setupEventListeners() {
    const loginForm = document.getElementById('loginFormElement');
    const registerForm = document.getElementById('registerFormElement');
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const messageInput = document.getElementById('messageInput');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (showRegisterLink) showRegisterLink.addEventListener('click', function(e) {
        e.preventDefault();
        showRegister();
    });
    if (showLoginLink) showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        showLogin();
    });
    if (messageInput) messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Botões que aparecem depois do login
    setTimeout(() => {
        const logoutBtn = document.getElementById('logoutBtn');
        const redeemBtn = document.getElementById('redeemBtn');
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        const openAdminBtn = document.getElementById('openAdminBtn');
        
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
        if (redeemBtn) redeemBtn.addEventListener('click', redeemCode);
        if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendMessage);
        if (openAdminBtn) openAdminBtn.addEventListener('click', function() {
            window.location.href = '/admin';
        });
    }, 100);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showMainContent();
            initializeSocket();
            setupEventListeners(); // Re-setup para botões novos
        } else if (data.error === 'Conta banida') {
            showBannedScreen(data.banReason, data.banExpires);
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Erro de conexão', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showMainContent();
            initializeSocket();
            setupEventListeners(); // Re-setup para botões novos
        } else {
            showAlert(data.error || 'Erro no cadastro', 'error');
        }
    } catch (error) {
        showAlert('Erro de conexão', 'error');
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        if (socket) {
            socket.disconnect();
        }
        showLogin();
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            showMainContent();
            initializeSocket();
            setupEventListeners(); // Re-setup para botões novos
        }
    } catch (error) {
        console.log('Usuário não autenticado');
    }
}

function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('bannedScreen').classList.add('hidden');
}

function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('bannedScreen').classList.add('hidden');
}

function showMainContent() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('bannedScreen').classList.add('hidden');
    
    document.getElementById('usernameDisplay').textContent = currentUser.username;
    document.getElementById('coinsDisplay').textContent = currentUser.coins;
    
    if (currentUser.isAdmin) {
        document.getElementById('adminPanel').classList.remove('hidden');
    }
}

function showBannedScreen(reason, expires) {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('bannedScreen').classList.remove('hidden');
    
    document.getElementById('banReason').textContent = `Motivo: ${reason}`;
    document.getElementById('banExpires').textContent = `Expira em: ${new Date(expires).toLocaleString()}`;
}

function initializeSocket() {
    socket = io();
    
    socket.emit('join-chat', currentUser.id || currentUser._id);
    
    socket.on('new-message', function(data) {
        addMessageToChat(data);
    });
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (message && socket) {
        socket.emit('send-message', { message });
        messageInput.value = '';
    }
}

function addMessageToChat(data) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <span class="username">${data.username}</span>
        <span class="timestamp">${timestamp}</span>
        <div>${data.message}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function redeemCode() {
    const code = document.getElementById('promoCode').value.trim();
    
    if (!code) {
        showAlert('Digite um código', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/user/redeem-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`Código resgatado! +${data.reward} moedas`, 'success');
            currentUser.coins += data.reward;
            document.getElementById('coinsDisplay').textContent = currentUser.coins;
            document.getElementById('promoCode').value = '';
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Erro ao resgatar código', 'error');
    }
}

function showAlert(message, type) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const container = document.querySelector('.auth-container:not(.hidden)') || 
                     document.querySelector('.main-content:not(.hidden)');
    
    if (container) {
        container.insertBefore(alert, container.firstChild);
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
}

// Bloquear DevTools
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C') ||
        (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});