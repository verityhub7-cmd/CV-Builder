const SUPABASE_URL = "https://wusbeadjjemhwuaozqqy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c2JlYWRqamVtaHd1YW96cXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTk3MjAsImV4cCI6MjA5NzE3NTcyMH0.1ySCcMm7-p-ypDAuadY_MtbMtcsQO8w12pOv4JhhTOc";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

let smartcvResumeId = localStorage.getItem('smartcv_resume_id') || '';
let smartcvSaveTimer = null;
let smartcvSaving = false;

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
  setTimeout(() => openModal(openId), 150);
}

document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

function showToast(message, type = 'success') {
  let toast = document.getElementById('globalToast') || document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function getFriendlyError(error) {
  const message = error?.message || String(error || 'Unknown error');
  if (message.toLowerCase().includes('failed to fetch')) {
    return 'Connection failed. Open this project through Live Server and check your Supabase URL and internet connection.';
  }
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }
  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Please confirm your email first, then login.';
  }
  return message;
}

async function getActiveSession() {
  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session) return null;

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      await client.auth.signOut();
      return null;
    }

    return { ...sessionData.session, user: userData.user };
  } catch (error) {
    console.error(error);
    return null;
  }
}

function getUserLabel(session) {
  return session?.user?.user_metadata?.full_name || session?.user?.email || 'User';
}

async function ensureProfile(user) {
  if (!user) return null;

  try {
    const { data: existing } = await client
      .from('profiles')
      .select('id,email,full_name,is_pro,account_status,plan_name,pro_purchased_at')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) return existing;

    const profile = {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      account_status: 'active',
      is_pro: false,
      plan_name: 'free'
    };

    const { data, error } = await client
      .from('profiles')
      .insert(profile)
      .select('id,email,full_name,is_pro,account_status,plan_name,pro_purchased_at')
      .maybeSingle();

    if (error) {
      console.warn('Profile insert skipped:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getMyProfile() {
  const session = await getActiveSession();
  if (!session) return null;

  let profile = await ensureProfile(session.user);
  if (profile) return profile;

  const { data, error } = await client
    .from('profiles')
    .select('id,email,full_name,is_pro,account_status,plan_name,pro_purchased_at')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

async function userIsPro() {
  const profile = await getMyProfile();
  return Boolean(profile && profile.account_status === 'active' && profile.is_pro === true);
}

async function updateNavFromSession() {
  const session = await getActiveSession();
  const navButtons = document.querySelector('.nav-buttons');
  if (!navButtons) return;

  if (!session) {
    navButtons.innerHTML = `
      <button class="login-btn" onclick="openModal('loginModal')">Login</button>
      <button class="signup-btn" onclick="openModal('signupModal')">Get Started Free</button>
    `;
    return;
  }

  const profile = await getMyProfile();
  const label = profile?.full_name || getUserLabel(session);
  const accountType = profile?.is_pro ? 'Pro Account' : 'Free Account';
  navButtons.innerHTML = `
    <span style="font-size:14px;font-weight:700;color:#1f4fd8;">${accountType}: ${escapeHTML(label)}</span>
    <button class="login-btn" onclick="handleLogout()">Logout</button>
    <button class="signup-btn" onclick="window.location.href='form.html'">Builder</button>
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
  const password = document.getElementById('signup-password')?.value.trim();

  if (!name || !email || !password) {
    showToast('Please fill in all fields.', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    if (error) {
      showToast(getFriendlyError(error), 'error');
      return;
    }

    if (data?.user) await ensureProfile(data.user);

    closeModal('signupModal');
    await updateNavFromSession();

    const next = consumeAfterLogin() || 'form.html';
    if (data?.session) {
      showToast('Account created successfully.', 'success');
      setTimeout(() => window.location.href = next, 700);
    } else {
      showToast('Account created successfully. Please login.', 'success');
      setTimeout(() => openModal('loginModal'), 500);
    }
  } catch (error) {
    console.error(error);
    showToast(getFriendlyError(error), 'error');
  }
}

async function login() {
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value.trim();

  if (!email || !password) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      showToast(getFriendlyError(error), 'error');
      return;
    }

    if (data?.user) await ensureProfile(data.user);
    const profile = await getMyProfile();

    if (profile?.account_status && profile.account_status !== 'active') {
      await client.auth.signOut();
      showToast('Your account is not active. Please contact support.', 'error');
      return;
    }

    closeModal('loginModal');
    await updateNavFromSession();
    showToast('Login successful.', 'success');

    const next = consumeAfterLogin() || 'form.html';
    setTimeout(() => window.location.href = next, 600);
  } catch (error) {
    console.error(error);
    showToast(getFriendlyError(error), 'error');
  }
}

async function handleLogout() {
  await client.auth.signOut();
  localStorage.removeItem('smartcv_after_login');
  localStorage.removeItem('smartcv_resume_id');
  window.location.href = 'index.html';
}

async function startCheckout(templateName = '') {
  const session = await getActiveSession();
  if (!session) {
    saveAfterLogin('payment.html' + (templateName ? `?template=${encodeURIComponent(templateName)}` : ''));
    showToast('Please sign up or login before purchasing.', 'error');
    openModal('signupModal');
    return;
  }

  if (await userIsPro()) {
    showToast('Professional Builder is already active.', 'success');
    window.location.href = 'form.html' + (templateName ? `?template=${encodeURIComponent(templateName)}` : '');
    return;
  }

  window.location.href = 'payment.html' + (templateName ? `?template=${encodeURIComponent(templateName)}` : '');
}

async function submitManualPayment() {
  const session = await getActiveSession();
  if (!session) {
    saveAfterLogin('payment.html');
    window.location.href = 'index.html?login=1&next=payment.html';
    return;
  }

  const paymentMethod = document.getElementById('paymentMethod')?.value || '';
  const transactionId = document.getElementById('transactionId')?.value.trim();
  const amount = Number(document.getElementById('paymentAmount')?.value || 1);
  const currency = document.getElementById('paymentCurrency')?.value || 'USD';

  if (!transactionId) {
    showToast('Please enter transaction ID.', 'error');
    return;
  }

  try {
    await ensureProfile(session.user);
    const { error } = await client.from('payments').insert({
      user_id: session.user.id,
      email: session.user.email || '',
      plan_name: 'professional_builder',
      amount,
      currency,
      payment_method: paymentMethod,
      transaction_id: transactionId,
      status: 'pending'
    });

    if (error) {
      if (error.code === '23505') {
        showToast('This transaction ID is already submitted.', 'error');
      } else {
        showToast(getFriendlyError(error), 'error');
      }
      return;
    }

    showToast('Payment reference submitted. Admin approval is required.', 'success');
    setTimeout(() => window.location.href = 'form.html?payment=success', 1000);
  } catch (error) {
    console.error(error);
    showToast(getFriendlyError(error), 'error');
  }
}

async function prefillFormFromSession(session) {
  const user = session?.user;
  if (!user) return;

  const profile = await ensureProfile(user);
  const fullName = profile?.full_name || user.user_metadata?.full_name || user.email || '';
  const email = profile?.email || user.email || '';

  const nameField = document.getElementById('fullName');
  const emailField = document.getElementById('email');

  if (nameField && !nameField.value) nameField.value = fullName;
  if (emailField && !emailField.value) emailField.value = email;
}

function scheduleAutoSave(delay = 900) {
  clearTimeout(smartcvSaveTimer);
  smartcvSaveTimer = setTimeout(() => saveResumeDraft(), delay);
}

function getCurrentTemplateName() {
  try {
    if (typeof currentTemplate !== 'undefined' && currentTemplate) return currentTemplate;
  } catch (error) {}
  return localStorage.getItem('smartcv_template') || 'ats';
}

function hasUsefulResumeData(data) {
  if (!data) return false;
  return Boolean(
    data.name || data.jobTitle || data.email || data.phone || data.location || data.linkedin ||
    data.summary || (Array.isArray(data.skills) && data.skills.length) ||
    (Array.isArray(data.education) && data.education.some(item => item.degree || item.institution || item.notes)) ||
    (Array.isArray(data.experience) && data.experience.some(item => item.title || item.company || item.desc))
  );
}

async function getOrCreateResumeId(session) {
  if (smartcvResumeId) return smartcvResumeId;

  const { data, error } = await client
    .from('resumes')
    .select('id')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data?.id) {
    smartcvResumeId = data.id;
    localStorage.setItem('smartcv_resume_id', smartcvResumeId);
    return smartcvResumeId;
  }

  return '';
}

async function saveResumeDraft() {
  if (smartcvSaving) return;
  if (typeof collectData !== 'function') return;

  const session = await getActiveSession();
  if (!session) return;

  const resumeData = collectData();
  if (!hasUsefulResumeData(resumeData)) return;

  smartcvSaving = true;
  try {
    const templateName = getCurrentTemplateName();
    const existingId = await getOrCreateResumeId(session);

    if (existingId) {
      const { error } = await client
        .from('resumes')
        .update({ template_name: templateName, resume_data: resumeData })
        .eq('id', existingId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    } else {
      const { data, error } = await client
        .from('resumes')
        .insert({ user_id: session.user.id, template_name: templateName, resume_data: resumeData })
        .select('id')
        .single();

      if (error) throw error;
      smartcvResumeId = data.id;
      localStorage.setItem('smartcv_resume_id', smartcvResumeId);
    }

    const status = document.getElementById('autosaveStatus');
    if (status) status.textContent = 'Saved to Supabase';
  } catch (error) {
    console.error('Resume auto save failed:', error);
    const status = document.getElementById('autosaveStatus');
    if (status) status.textContent = 'Auto save failed';
  } finally {
    smartcvSaving = false;
  }
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

window.addEventListener('DOMContentLoaded', async () => {
  await updateNavFromSession();

  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1') openModal('loginModal');
  if (params.get('signup') === '1') openModal('signupModal');
});
