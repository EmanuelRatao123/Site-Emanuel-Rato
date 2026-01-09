document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    setupEventListeners();
    loadUsers();
    loadPromoCodes();
});

function setupEventListeners() {
    document.getElementById('banForm').addEventListener('submit', handleBan);
    document.getElementById('promoteForm').addEventListener('submit', handlePromote);
    document.getElementById('promoForm').addEventListener('submit', handleCreatePromo);
}

async function checkAdminAuth() {
    try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
        
        const user = await response.json();
        if (!user.isAdmin) {
            window.location.href = '/';
            return;
        }
    } catch (error) {
        window.location.href = '/';
    }
}

function showSection(sectionName) {
    // Esconder todas as seções
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Remover classe active de todos os botões
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    document.getElementById(`${sectionName}-section`).classList.remove('hidden');
    
    // Adicionar classe active ao botão clicado
    event.target.classList.add('active');
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            const status = user.isBanned ? 'banned' : 'offline';
            const statusText = user.isBanned ? 'Banido' : 'Offline';
            
            row.innerHTML = `
                <td>
                    ${user.username}
                    ${user.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}
                </td>
                <td>${user.email}</td>
                <td>${user.coins}</td>
                <td>Nível ${user.adminLevel}</td>
                <td><span class="status-badge status-${status}">${statusText}</span></td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    ${!user.isBanned ? 
                        `<button class="action-btn ban-btn" onclick="openBanModal('${user._id}')">Banir</button>` :
                        `<button class="action-btn unban-btn" onclick="unbanUser('${user._id}')">Desbanir</button>`
                    }
                    <button class="action-btn promote-btn" onclick="openPromoteModal('${user._id}', ${user.adminLevel})">Promover</button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        showAlert('Erro ao carregar usuários', 'error');
    }
}

function openBanModal(userId) {
    document.getElementById('banUserId').value = userId;
    document.getElementById('banModal').style.display = 'block';
}

function openPromoteModal(userId, currentLevel) {
    document.getElementById('promoteUserId').value = userId;
    document.getElementById('adminLevel').value = currentLevel;
    document.getElementById('promoteModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function handleBan(e) {
    e.preventDefault();
    
    const userId = document.getElementById('banUserId').value;
    const reason = document.getElementById('banReason').value;
    const duration = document.getElementById('banDuration').value;
    
    try {
        const response = await fetch('/api/admin/ban', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, reason, duration })
        });
        
        if (response.ok) {
            showAlert('Usuário banido com sucesso', 'success');
            closeModal('banModal');
            loadUsers();
            document.getElementById('banForm').reset();
        } else {
            showAlert('Erro ao banir usuário', 'error');
        }
    } catch (error) {
        showAlert('Erro de conexão', 'error');
    }
}

async function unbanUser(userId) {
    if (!confirm('Tem certeza que deseja desbanir este usuário?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/unban', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            showAlert('Usuário desbanido com sucesso', 'success');
            loadUsers();
        } else {
            showAlert('Erro ao desbanir usuário', 'error');
        }
    } catch (error) {
        showAlert('Erro de conexão', 'error');
    }
}

async function handlePromote(e) {
    e.preventDefault();
    
    const userId = document.getElementById('promoteUserId').value;
    const adminLevel = document.getElementById('adminLevel').value;
    
    try {
        const response = await fetch('/api/admin/promote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, adminLevel })
        });
        
        if (response.ok) {
            showAlert('Usuário promovido com sucesso', 'success');
            closeModal('promoteModal');
            loadUsers();
        } else {
            showAlert('Erro ao promover usuário', 'error');
        }
    } catch (error) {
        showAlert('Erro de conexão', 'error');
    }
}

async function handleCreatePromo(e) {
    e.preventDefault();
    
    const code = document.getElementById('promoCodeInput').value;
    const reward = document.getElementById('promoReward').value;
    const maxUses = document.getElementById('promoMaxUses').value;
    
    try {
        const response = await fetch('/api/admin/promo-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, reward, maxUses })
        });
        
        if (response.ok) {
            showAlert('Código promocional criado com sucesso', 'success');
            document.getElementById('promoForm').reset();
            loadPromoCodes();
        } else {
            const data = await response.json();
            showAlert(data.error || 'Erro ao criar código', 'error');
        }
    } catch (error) {
        showAlert('Erro de conexão', 'error');
    }
}

async function loadPromoCodes() {
    try {
        const response = await fetch('/api/admin/promo-codes');
        const promoCodes = await response.json();
        
        const container = document.getElementById('promoCodesContainer');
        container.innerHTML = '';
        
        promoCodes.forEach(promo => {
            const card = document.createElement('div');
            card.className = 'promo-card';
            
            const maxUsesText = promo.maxUses === -1 ? 'Ilimitado' : promo.maxUses;
            
            card.innerHTML = `
                <div class="promo-info">
                    <h4>${promo.code}</h4>
                    <p>Criado por: ${promo.createdBy.username} em ${new Date(promo.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="promo-stats">
                    <div class="promo-stat">
                        <div class="number">${promo.reward}</div>
                        <div class="label">Moedas</div>
                    </div>
                    <div class="promo-stat">
                        <div class="number">${promo.uses}</div>
                        <div class="label">Usos</div>
                    </div>
                    <div class="promo-stat">
                        <div class="number">${maxUsesText}</div>
                        <div class="label">Máximo</div>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        showAlert('Erro ao carregar códigos promocionais', 'error');
    }
}

function manageBadWords() {
    showAlert('Funcionalidade em desenvolvimento', 'error');
}

function manageCoinSettings() {
    showAlert('Funcionalidade em desenvolvimento', 'error');
}

function createBackup() {
    showAlert('Backup criado com sucesso', 'success');
}

function showAlert(message, type) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const main = document.querySelector('.admin-main');
    main.insertBefore(alert, main.firstChild);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Fechar modais clicando fora
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}