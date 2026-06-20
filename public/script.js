const API_URL = "https://loveamon.onrender.com/api";

let token = null;
let isLogin = false;

// Show message to user
function showMessage(msg, type = 'error') {
  const old = document.querySelector('.msg-box');
  if (old) old.remove();

  const div = document.createElement('div');
  div.className = 'msg-box';
  div.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    padding: 15px 25px; border-radius: 10px; z-index: 10000;
    font-weight: 500; text-align: center; max-width: 90%;
    ${type === 'success' ? 'background: #d4edda; color: #155724;' : 
      type === 'loading' ? 'background: #fff3cd; color: #856404;' :
      'background: #f8d7da; color: #721c24;'}
  `;
  div.textContent = msg;
  document.body.appendChild(div);

  if (type !== 'loading') {
    setTimeout(() => div.remove(), 5000);
  }
}

function hideMessage() {
  const msg = document.querySelector('.msg-box');
  if (msg) msg.remove();
}

function setLoading(loading) {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up');
}

// Toggle between login and signup
function toggleForm() {
  isLogin = !isLogin;
  const title = document.getElementById('form-title');
  const btn = document.getElementById('submit-btn');
  const toggleText = document.getElementById('toggle-text');

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

// Main submit handler
async function submitForm() {
  console.log('submitForm called, isLogin:', isLogin);

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showMessage('Please fill in all fields');
    return;
  }

  if (isLogin) {
    await doLogin(email, password);
  } else {
    const name = document.getElementById('name').value.trim();
    const gender = document.getElementById('gender').value;
    const interest = document.getElementById('interest').value;

    if (!name || !gender || !interest) {
      showMessage('Please fill in all fields');
      return;
    }

    await doRegister(name, email, password, gender, interest);
  }
}

async function doRegister(name, email, password, gender, interest) {
  setLoading(true);
  showMessage('Creating account...', 'loading');

  try {
    const res = await fetch(API_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, gender, interest })
    });

    const data = await res.json();
    console.log('Register response:', data);

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    hideMessage();
    showMessage('✅ Account created! Please log in.', 'success');

    // Clear form and switch to login
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    document.getElementById('name').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('interest').value = '';

    setTimeout(() => toggleForm(), 2000);

  } catch (err) {
    console.error('Register error:', err);
    hideMessage();
    showMessage('❌ ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function doLogin(email, password) {
  setLoading(true);
  showMessage('Logging in...', 'loading');

  try {
    const res = await fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    console.log('Login response:', data);

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    token = data.token;
    localStorage.setItem('token', token);
    hideMessage();
    showMessage('✅ Login successful!', 'success');

    setTimeout(() => {
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    }, 1000);

  } catch (err) {
    console.error('Login error:', err);
    hideMessage();
    showMessage('❌ ' + err.message);
  } finally {
    setLoading(false);
  }
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-section').style.display = 'block';
  hideMessage();
}

// Check if already logged in
window.onload = function() {
  console.log('Page loaded');
  token = localStorage.getItem('token');
  if (token) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  }
};