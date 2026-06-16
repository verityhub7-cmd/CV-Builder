const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function switchModal(closeId, openId) {
  closeModal(closeId);
  setTimeout(() => openModal(openId), 200);
}

document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

function showToast(msg, type = 'success') {
  let toast = document.getElementById('globalToast') || document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3400);
}

async function getActiveSession() {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData || !sessionData.session) return null;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData || !userData.user) {
    await client.auth.signOut();
    return null;
  }

  return { ...sessionData.session, user: userData.user };
}

function getUserLabel(session) {
  if (!session || !session.user) return '';
  return session.user.user_metadata?.full_name || session.user.email || 'User';
}

async function ensureProfile(user) {
  if (!user) return;

  const profile = {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || ''
  };

  await client
    .from('profiles')
    .insert(profile)
    .select('id')
    .single();
}

async function getMyProfile() {
  const session = await getActiveSession();
  if (!session) return null;

  await ensureProfile(session.user);

  const { data, error } = await client
    .from('profiles')
    .select('id,email,full_name,is_pro,account_status,pro_purchased_at')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) return null;
  return data;
}

async function userIsPro() {
  const profile = await getMyProfile();
  return Boolean(profile && profile.account_status === 'active' && profile.is_pro === true);
}

async function updateNavFromSession() {
  const session = await getActiveSession();
  const btns = document.querySelector('.nav-buttons');
  if (!btns) return;

  if (!session) {
    btns.innerHTML = `
      <button class="login-btn" onclick="openModal('loginModal')">Login</button>
      <button class="signup-btn" onclick="openModal('signupModal')">Sign Up</button>
    `;
    return;
  }

  const profile = await getMyProfile();
  const label = (profile && profile.full_name) || getUserLabel(session);
  const accountType = profile && profile.is_pro ? 'Pro Account' : 'Free Account';
  btns.innerHTML = `
    <span style="font-size:14px;font-weight:700;color:#1f4fd8;">${accountType}: ${label}</span>
    <button class="login-btn" onclick="handleLogout()">Logout</button>
  `;
}

function saveAfterLogin(path) {
  localStorage.setItem('smartcv_after_login', path || 'form.html');
}

function consumeAfterLogin() {
  const path = localStorage.getItem('smartcv_after_login');
  if (path) localStorage.removeItem('smartcv_after_login');
  return path;
}

async function requireAuthAndOpenBuilder(path = 'form.html') {
  const session = await getActiveSession();
  if (session) {
    window.location.href = path;
    return;
  }
  saveAfterLogin(path);
  showToast('Please sign up or login first.', 'error');
  openModal('signupModal');
}

async function signup() {
  const fullName = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();

  if (!fullName || !email || !password) {
    alert("Please fill all fields.");
    return;
  }

  const { error } = await client.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Account created successfully. Please login.");
}

async function login() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    alert("Please fill all fields.");
    return;
  }

  const { error } = await client.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert("Invalid email or password.");
    return;
  }

  window.location.href = "form.html";
}

  closeModal('loginModal');
  await updateNavFromSession();
  showToast('Login successful.');
  const next = consumeAfterLogin();
  if (next) setTimeout(() => window.location.href = next, 700);
}

async function handleLogout() {
  await client.auth.signOut();
  localStorage.removeItem('smartcv_template');
  localStorage.removeItem('smartcv_after_login');
  location.href = 'index.html';
}

async function startCheckout(templateName = '') {
  const session = await getActiveSession();
  if (!session) {
    saveAfterLogin('form.html' + (templateName ? `?template=${encodeURIComponent(templateName)}` : ''));
    showToast('Please sign up or login before purchasing.', 'error');
    openModal('signupModal');
    return;
  }

  const pro = await userIsPro();
  if (pro) {
    showToast('Professional Builder is already active.');
    window.location.href = 'form.html' + (templateName ? `?template=${encodeURIComponent(templateName)}` : '');
    return;
  }

  const target = 'payment.html' + (templateName ? `?template=${encodeURIComponent(templateName)}` : '');
  window.location.href = target;
}

function prefillFormFromSession(session) {
  if (!session || !session.user) return;
  const nameField = document.getElementById('fullName');
  const emailField = document.getElementById('email');
  const name = session.user.user_metadata?.full_name || '';
  const email = session.user.email || '';

  if (nameField && name && !nameField.value) {
    nameField.value = name;
    nameField.dispatchEvent(new Event('input'));
  }
  if (emailField && email && !emailField.value) {
    emailField.value = email;
    emailField.dispatchEvent(new Event('input'));
  }
}

async function submitManualPayment() {
  const session = await getActiveSession();
  if (!session) {
    saveAfterLogin('payment.html');
    showToast('Please login first.', 'error');
    window.location.href = 'index.html?login=1&next=payment.html';
    return;
  }

  const pro = await userIsPro();
  if (pro) {
    showToast('Professional Builder is already active.');
    setTimeout(() => window.location.href = 'form.html', 700);
    return;
  }

  const method = document.getElementById('paymentMethod')?.value.trim();
  const transactionId = document.getElementById('transactionId')?.value.trim();
  const amount = Number(document.getElementById('paymentAmount')?.value || 1);
  const currency = document.getElementById('paymentCurrency')?.value.trim() || 'USD';

  if (!method || !transactionId || !amount) {
    showToast('Please enter payment method, amount, and transaction ID.', 'error');
    return;
  }

  const payload = {
    user_id: session.user.id,
    email: session.user.email || '',
    plan_name: 'professional_builder',
    amount,
    currency,
    payment_method: method,
    transaction_id: transactionId,
    status: 'pending'
  };

  const { error } = await client.from('payments').insert(payload);

  if (error) {
    if (error.code === '23505' || String(error.message).toLowerCase().includes('duplicate')) {
      showToast('This payment reference is already submitted.', 'error');
    } else {
      showToast(error.message || 'Payment reference was not submitted.', 'error');
    }
    return;
  }

  showToast('Payment reference submitted. Pro access will unlock after admin approval.');
  setTimeout(() => window.location.href = 'index.html', 1600);
}

window.addEventListener('DOMContentLoaded', async () => {
  await updateNavFromSession();
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next) saveAfterLogin(next);
  if (params.get('login') === '1') openModal('loginModal');
  if (params.get('signup') === '1') openModal('signupModal');
});
