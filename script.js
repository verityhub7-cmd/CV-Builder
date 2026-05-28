// ===== MODAL FUNCTIONS =====
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

function switchModal(closeId, openId) {
  closeModal(closeId);
  setTimeout(() => openModal(openId), 200);
}

// Close modal when clicking outside
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ===== TOAST =====
function showToast(msg, type = 'success') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ===== LOGIN =====
function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value.trim();
  if (!email || !pass) { showToast('Please fill in all fields.', 'error'); return; }
  localStorage.setItem('smartcv_user', JSON.stringify({ email }));
  closeModal('loginModal');
  showToast('✅ Login successful! Welcome back.');
  updateNavForUser(email);
}

// ===== SIGNUP =====
function handleSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPass').value.trim();
  if (!name || !email || !pass) { showToast('Please fill in all fields.', 'error'); return; }
  if (pass.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
  localStorage.setItem('smartcv_user', JSON.stringify({ name, email }));
  closeModal('signupModal');
  showToast(`🎉 Welcome, ${name}! Account created.`);
  updateNavForUser(name);
}

// ===== UPDATE NAV AFTER LOGIN =====
function updateNavForUser(label) {
  const btns = document.querySelector('.nav-buttons');
  if (!btns) return;
  btns.innerHTML = `
    <span style="font-size:14px;font-weight:600;color:#2563eb;">👋 ${label}</span>
    <button class="login-btn" onclick="handleLogout()">Logout</button>
  `;
}

function handleLogout() {
  localStorage.removeItem('smartcv_user');
  location.reload();
}

// ===== CHECK SESSION ON LOAD =====
window.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('smartcv_user') || 'null');
  if (user) updateNavForUser(user.name || user.email);
});
