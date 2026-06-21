const API_URL = "https://loveamon.onrender.com/api";

let token = null;
let currentUser = null;
let isLogin = false;

// ==================== UI HELPERS ====================

function showMessage(msg, type = 'error') {
  const old = document.querySelector('.msg-box');
  if (old) old.remove();

  const div = document.createElement('div');
  div.className = 'msg-box';
  div.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    padding: 15px 25px; border-radius: 10px; z-index: 10000;
    font-weight: 500; text-align: center; max-width: 90%; font-size: 14px;
    ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 
      type === 'loading' ? 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;' :
      'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'}
  `;
  div.textContent = msg;
  document.body.appendChild(div);

  if (type !== 'loading') {
    setTimeout(() => div.remove(), 5000);
  }
  return div;
}

function hideMessage() {
  const msg = document.querySelector('.msg-box');
  if (msg) msg.remove();
}

function setLoading(loading) {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.7' : '1';
  btn.textContent = loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up');
}

// ==================== FORM TOGGLE ====================

function toggleForm() {
  isLogin = !isLogin;
  const title = document.getElementById('form-title');
  const btn = document.getElementById('submit-btn');
  const toggleText = document.getElementById('toggle-text');

  if (!title || !btn || !toggleText) {
    console.error('Form elements not found!');
    return;
  }

  if (isLogin) {
    title.textContent = 'Log In';
    btn.textContent = 'Log In';
    toggleText.innerHTML = 'No account yet? <a href="#" onclick="toggleForm()">Sign Up</a>';
    document.getElementById('name').style.display = 'none';
    document.getElementById('gender').style.display = 'none';
    document.getElementById('interest').style.display = 'none';
  } else {
    title.textContent = 'Sign Up';
    btn.textContent = 'Sign Up';
    toggleText.innerHTML = 'Already have an account? <a href="#" onclick="toggleForm()">Log In</a>';
    document.getElementById('name').style.display = 'block';
    document.getElementById('gender').style.display = 'block';
    document.getElementById('interest').style.display = 'block';
  }
  hideMessage();
}

// ==================== MAIN SUBMIT ====================

async function submitForm() {
  console.log('=== SUBMIT FORM CALLED ===');
  
  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value;

  console.log('isLogin:', isLogin);
  console.log('email:', email);
  console.log('password:', password ? '***' : 'empty');

  if (!email || !password) {
    showMessage('❌ Please fill in all fields');
    return;
  }

  if (isLogin) {
    await doLogin(email, password);
  } else {
    const name = document.getElementById('name')?.value?.trim();
    const gender = document.getElementById('gender')?.value;
    const interest = document.getElementById('interest')?.value;

    console.log('name:', name);
    console.log('gender:', gender);
    console.log('interest:', interest);

    if (!name || !gender || !interest) {
      showMessage('❌ Please fill in all fields');
      return;
    }

    await doRegister(name, email, password, gender, interest);
  }
}

// ==================== REGISTER ====================

async function doRegister(name, email, password, gender, interest) {
  console.log('=== DO REGISTER ===');
  setLoading(true);
  showMessage('Creating account...', 'loading');

  try {
    const res = await fetch(API_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, gender, interest })
    });

    const data = await res.json();
    console.log('Register response:', res.status, data);

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    hideMessage();
    showMessage('✅ Account created! Please log in.', 'success');

    // Clear form
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    document.getElementById('name').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('interest').value = '';

    // Switch to login after 2 seconds
    setTimeout(() => {
      toggleForm();
    }, 2000);

  } catch (err) {
    console.error('Register error:', err);
    hideMessage();
    showMessage('❌ ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ==================== LOGIN ====================

async function doLogin(email, password) {
  console.log('=== DO LOGIN ===');
  setLoading(true);
  showMessage('Logging in...', 'loading');

  try {
    const res = await fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    console.log('Login response:', res.status, data);

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Save token and user
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));

    hideMessage();
    showMessage('✅ Login successful! Redirecting...', 'success');

    // Redirect to app after 1 second
    setTimeout(() => {
      console.log('Redirecting to app...');
      showApp();
    }, 1000);

  } catch (err) {
    console.error('Login error:', err);
    hideMessage();
    showMessage('❌ ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ==================== SHOW APP ====================

function showApp() {
  console.log('=== SHOW APP ===');
  
  const authSection = document.getElementById('auth-section');
  const app = document.getElementById('app');
  
  console.log('authSection:', authSection);
  console.log('app:', app);

  if (!authSection || !app) {
    console.error('App elements not found!');
    return;
  }

  authSection.style.display = 'none';
  app.style.display = 'block';

  // Update user name if element exists
  const nameEl = document.getElementById('current-user-name');
  if (nameEl && currentUser) {
    nameEl.textContent = currentUser.name || 'User';
  }

  console.log('App shown successfully');
}

// ==================== LOGOUT ====================

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  currentUser = null;
  
  const authSection = document.getElementById('auth-section');
  const app = document.getElementById('app');
  
  if (authSection) authSection.style.display = 'block';
  if (app) app.style.display = 'none';
  
  hideMessage();
  isLogin = false;
}

// ==================== INIT ====================

window.onload = function() {
  console.log('=== PAGE LOADED ===');
  
  token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      console.error('Failed to parse user:', e);
    }
  }

  console.log('token exists:', !!token);
  console.log('currentUser:', currentUser);

  if (token && currentUser) {
    showApp();
  } else {
    // Show auth section by default
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.style.display = 'block';
  }
};