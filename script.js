const supabaseUrl = "https://pctnjecwoudvnqcovnkl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdG5qZWN3b3Vkdm5xY292bmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDI2NjAsImV4cCI6MjA5NTQ3ODY2MH0.6vi-oaOJf06yUFOSbsvLxAK371y8qjufCRLpLid5IQk";

const client = supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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
  const name = document.getElementById('signup-name')?.value.trim();
  const email = document.getElementById('signup-email')?.value.trim();
  const pass = document.getElementById('signup-password')?.value.trim();

  if (!name || !email || !pass) {
    showToast('Please fill in all fields.', 'error');
    return;
  }
  if (pass.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  const { data, error } = await client.auth.signUp({
    email,
    password: pass,
    options: { data: { full_name: name } }
  });

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  if (data && data.user) await ensureProfile(data.user);

  closeModal('signupModal');
  await updateNavFromSession();

  if (data && data.session) {
    showToast('Account created successfully.');
    const next = consumeAfterLogin();
    if (next) setTimeout(() => window.location.href = next, 700);
  } else {
    showToast('Account created. Please confirm your email, then login.');
  }
}

async function login() {
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value.trim();

  if (!email || !password) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message, 'error');
    return;
  }

  if (data && data.user) await ensureProfile(data.user);
  const profile = await getMyProfile();

  if (profile && profile.account_status && profile.account_status !== 'active') {
    await client.auth.signOut();
    showToast('Your account is not active. Please contact support.', 'error');
    return;
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
