const supabaseUrl = "sb_publishable_uUoz0BeKqg04n1u8NmSaAQ_pCShdaR-";

const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdG5qZWN3b3Vkdm5xY292bmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDI2NjAsImV4cCI6MjA5NTQ3ODY2MH0.6vi-oaOJf06yUFOSbsvLxAK371y8qjufCRLpLid5IQk";
const client = supabase.createClient(
  supabaseUrl,
  supabaseKey
);

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
async function login() {

  const email =
    document.getElementById("email").value;

  const password =
    document.getElementById("password").value;

  const { data, error } =
    await client.auth.signInWithPassword({

      email: email,
      password: password

    });

  if(error){
    alert(error.message);
  }
  else{
    alert("Login Successful");
  }
}

// ===== SIGNUP =====
async function signup() {

  const name =
    document.getElementById("name").value;

  const email =
    document.getElementById("email").value;

  const password =
    document.getElementById("password").value;

  const { data, error } =
    await client
      .from('sign up')
      .insert([
        {
          name: name,
          email: email,
          password: password
        }
      ]);

  if(error){
    alert(error.message);
  }
  else{
    alert("Signup Successful");
  }
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

