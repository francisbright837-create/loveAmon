const API_URL = "https://loveamon.onrender.com/api";

let token = null;
let currentUser = null;
let isLogin = false;
let currentChatUserId = null;
let notifInterval = null;
let lastUnreadCount = 0;

// ==================== UI HELPERS ====================

function showMessage(msg, type = 'error') {
  const old = document.querySelector('.msg-box');
  if (old) old.remove();

  const div = document.createElement('div');
  div.className = 'msg-box ' + type;
  div.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    padding: 15px 25px; border-radius: 10px; z-index: 10000;
    font-weight: 500; text-align: center; max-width: 90%; font-size: 14px;
    ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' :
      type === 'loading' ? 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;' :
      'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'};
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
  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value;

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

    if (!name || !gender || !interest) {
      showMessage('❌ Please fill in all fields');
      return;
    }

    await doRegister(name, email, password, gender, interest);
  }
}

// ==================== REGISTER ====================

async function doRegister(name, email, password, gender, interest) {
  setLoading(true);
  showMessage('Creating account...', 'loading');

  const slowTimer = setTimeout(() => {
    showMessage('⏳ Server is waking up, this can take up to a minute...', 'loading');
  }, 8000);

  try {
    const res = await fetch(API_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, gender, interest })
    });

    clearTimeout(slowTimer);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    hideMessage();
    showMessage('✅ Account created! Please log in.', 'success');

    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    document.getElementById('name').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('interest').value = '';

    setTimeout(() => {
      toggleForm();
    }, 2000);

  } catch (err) {
    clearTimeout(slowTimer);
    hideMessage();
    showMessage('❌ ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ==================== LOGIN ====================

async function doLogin(email, password) {
  setLoading(true);
  showMessage('Logging in...', 'loading');

  const slowTimer = setTimeout(() => {
    showMessage('⏳ Server is waking up, this can take up to a minute...', 'loading');
  }, 8000);

  try {
    const res = await fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    clearTimeout(slowTimer);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));

    hideMessage();
    showMessage('✅ Login successful! Redirecting...', 'success');

    setTimeout(() => {
      showApp();
    }, 1000);

  } catch (err) {
    clearTimeout(slowTimer);
    hideMessage();
    showMessage('❌ ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ==================== SHOW APP ====================

function showApp() {
  const authSection = document.getElementById('auth-section');
  const app = document.getElementById('app');

  if (!authSection || !app) {
    console.error('App elements not found!');
    return;
  }

  authSection.style.display = 'none';
  app.style.display = 'block';

  const nameEl = document.getElementById('current-user-name');
  if (nameEl && currentUser) {
    nameEl.textContent = currentUser.name || 'User';
  }

  const hasProfile = currentUser && currentUser.profilePicture;

  document.getElementById('chat-screen').style.display = 'none';
  document.getElementById('upload-video-screen').style.display = 'none';
  document.getElementById('edit-profile-screen').style.display = 'none';
  document.getElementById('my-profile-screen').style.display = 'none';

  if (hasProfile) {
    document.getElementById('profile-setup').style.display = 'none';
    document.getElementById('matching-screen').style.display = 'block';
    loadProfiles();
    startNotifPolling();
  } else {
    document.getElementById('profile-setup').style.display = 'block';
    document.getElementById('matching-screen').style.display = 'none';
  }
}

// ==================== PROFILE SETUP ====================

async function saveProfile() {
  const photoInput = document.getElementById('photo-input');
  const bio = document.getElementById('bio')?.value?.trim() || '';
  const file = photoInput?.files?.[0];

  showMessage('Saving profile...', 'loading');

  try {
    const formData = new FormData();
    if (bio) formData.append('bio', bio);
    if (file) formData.append('photo', file);

    const res = await fetch(API_URL + '/profile/setup', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to save profile');
    }

    currentUser = { ...currentUser, ...data };
    localStorage.setItem('user', JSON.stringify(currentUser));

    hideMessage();
    showMessage('✅ Profile saved!', 'success');

    document.getElementById('profile-setup').style.display = 'none';
    document.getElementById('matching-screen').style.display = 'block';
    loadProfiles();
    startNotifPolling();

  } catch (err) {
    hideMessage();
    showMessage('❌ ' + err.message);
  }
}

// Handles photo preview for both the initial setup input and the edit-profile input
document.addEventListener('change', (e) => {
  if (e.target && (e.target.id === 'photo-input' || e.target.id === 'edit-photo-input')) {
    const file = e.target.files[0];
    if (!file) return;
    const previewId = e.target.id === 'photo-input' ? 'photo-preview' : 'edit-photo-preview';
    const preview = document.getElementById(previewId);
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.src = ev.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

// ==================== EDIT PROFILE PICTURE (after setup) ====================

function openEditProfile() {
  document.getElementById('matching-screen').style.display = 'none';
  document.getElementById('edit-profile-screen').style.display = 'block';
}

function closeEditProfile() {
  document.getElementById('edit-profile-screen').style.display = 'none';
  document.getElementById('matching-screen').style.display = 'block';
}

async function updateProfilePicture() {
  const fileInput = document.getElementById('edit-photo-input');
  const file = fileInput?.files?.[0];

  if (!file) {
    showMessage('❌ Please choose a photo first');
    return;
  }

  showMessage('Saving photo...', 'loading');

  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await fetch(API_URL + '/profile/setup', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to update photo');

    currentUser = { ...currentUser, ...data };
    localStorage.setItem('user', JSON.stringify(currentUser));

    hideMessage();
    showMessage('✅ Profile picture updated!', 'success');

    setTimeout(() => {
      closeEditProfile();
      loadProfiles();
    }, 1000);

  } catch (err) {
    hideMessage();
    showMessage('❌ ' + err.message);
  }
}

// ==================== MY PROFILE ====================

function openMyProfile() {
  document.getElementById('matching-screen').style.display = 'none';
  document.getElementById('my-profile-screen').style.display = 'block';
  loadMyProfile();
  loadMyVideos();
}

function closeMyProfile() {
  document.getElementById('my-profile-screen').style.display = 'none';
  document.getElementById('matching-screen').style.display = 'block';
}

async function loadMyProfile() {
  const container = document.getElementById('my-profile-details');
  container.innerHTML = '<p>Loading...</p>';

  try {
    const res = await fetch(API_URL + '/profile/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const user = await res.json();

    if (!res.ok) throw new Error(user.message || 'Failed to load profile');

    container.innerHTML = `
      ${user.profilePicture ? `<img src="${user.profilePicture}" style="width:180px; height:180px; object-fit:cover; border-radius:50%; margin-bottom:15px;">` : '<p>No profile picture yet.</p>'}
      <h3>${user.name}</h3>
      <p>${user.bio || 'No bio yet.'}</p>
    `;
  } catch (err) {
    container.innerHTML = '<p>Could not load your profile.</p>';
  }
}

async function loadMyVideos() {
  const container = document.getElementById('my-videos-list');
  container.innerHTML = '<p>Loading your videos...</p>';

  try {
    const res = await fetch(API_URL + '/videos/my-videos', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const videos = await res.json();

    if (!res.ok) throw new Error(videos.message || 'Failed to load videos');

    if (!videos.length) {
      container.innerHTML = '<p>You haven\'t uploaded any videos yet.</p>';
      return;
    }

    container.innerHTML = videos.map(v => `
      <div style="margin-bottom:20px; text-align:left;">
        <video src="${v.url}" controls crossorigin="anonymous" style="width:100%; border-radius:8px;"></video>
        ${v.caption ? `<p style="font-size:14px; color:#555; margin-top:5px;">${v.caption}</p>` : ''}
        <p style="font-size:13px; color:#888;">👁️ ${v.views || 0} views</p>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = '<p>Could not load your videos.</p>';
  }
}

// ==================== VIDEO UPLOAD ====================

function openUploadVideo() {
  document.getElementById('matching-screen').style.display = 'none';
  document.getElementById('upload-video-screen').style.display = 'block';
}

function closeUploadVideo() {
  document.getElementById('upload-video-screen').style.display = 'none';
  document.getElementById('matching-screen').style.display = 'block';
}

async function uploadVideo() {
  const fileInput = document.getElementById('video-input');
  const caption = document.getElementById('video-caption')?.value?.trim() || '';
  const file = fileInput?.files?.[0];
  const statusDiv = document.getElementById('upload-status');

  if (!file) {
    statusDiv.textContent = '❌ Please choose a video file first';
    return;
  }

  statusDiv.textContent = 'Uploading... this may take a moment ⏳';

  try {
    const formData = new FormData();
    formData.append('video', file);
    if (caption) formData.append('caption', caption);

    const res = await fetch(API_URL + '/videos/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Upload failed');

    statusDiv.textContent = '✅ Video uploaded successfully!';
    document.getElementById('video-input').value = '';
    document.getElementById('video-caption').value = '';

    setTimeout(() => {
      closeUploadVideo();
    }, 1500);

  } catch (err) {
    statusDiv.textContent = '❌ ' + err.message;
  }
}

// ==================== MATCHING / PROFILES ====================

async function loadProfiles() {
  const container = document.getElementById('profiles');
  if (!container) return;
  container.innerHTML = '<p>Loading profiles...</p>';

  try {
    const res = await fetch(API_URL + '/match/profiles', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to load profiles');

    if (!data.profiles || data.profiles.length === 0) {
      container.innerHTML = '<p>No profiles found right now. Check back later! 💕</p>';
      return;
    }

    container.innerHTML = '';
    data.profiles.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.innerHTML = `
        ${profile.profilePicture ? `<img src="${profile.profilePicture}" alt="${profile.name}">` : ''}
        <h3>${profile.name}</h3>
        <p>${profile.bio || 'No bio yet.'}</p>
        <button onclick="likeUser('${profile._id}', '${profile.name}')">💖 Like</button>
        <button onclick="openChat('${profile._id}', '${profile.name}')" style="background:#4d7cff;">💬 Message</button>
        <button onclick="viewVideos('${profile._id}', '${profile.name}')" style="background:#555;">🎬 View Videos</button>
        <div id="videos-${profile._id}" style="margin-top:10px;"></div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = '<p>Could not load profiles. Try again later.</p>';
    console.error('Load profiles error:', err);
  }
}

async function likeUser(targetId, targetName) {
  try {
    const res = await fetch(API_URL + '/match/like/' + targetId, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to like user');

    if (data.match) {
      showMessage("🎉 It's a match with " + targetName + "!", 'success');
    } else {
      showMessage('💕 Liked ' + targetName + '!', 'success');
    }

    loadProfiles();

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

async function viewVideos(userId, userName) {
  const container = document.getElementById('videos-' + userId);
  if (!container) return;

  if (container.dataset.loaded === 'true') {
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
    return;
  }

  container.innerHTML = '<p>Loading videos...</p>';

  try {
    const res = await fetch(API_URL + '/videos/user/' + userId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const videos = await res.json();

    if (!res.ok) throw new Error(videos.message || 'Failed to load videos');

    if (!videos.length) {
      container.innerHTML = '<p>' + userName + ' has no videos yet.</p>';
    } else {
      container.innerHTML = videos.map(v => `
        <video src="${v.url}" controls crossorigin="anonymous" style="width:100%; border-radius:8px; margin-top:8px;"></video>
        ${v.caption ? `<p style="font-size:13px; color:#555;">${v.caption}</p>` : ''}
      `).join('');
    }
    container.dataset.loaded = 'true';

  } catch (err) {
    container.innerHTML = '<p>Could not load videos.</p>';
  }
}

// ==================== CHAT ====================

async function openChat(userId, userName) {
  currentChatUserId = userId;
  document.getElementById('matching-screen').style.display = 'none';
  document.getElementById('chat-screen').style.display = 'block';
  document.getElementById('chat-with-name').textContent = userName;
  await loadMessages(userId);
  checkUnreadMessages();
}

function closeChat() {
  document.getElementById('chat-screen').style.display = 'none';
  document.getElementById('matching-screen').style.display = 'block';
  currentChatUserId = null;
}

async function loadMessages(userId) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '<p style="text-align:center; color:#888;">Loading messages...</p>';

  try {
    const res = await fetch(API_URL + '/messages/' + userId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const messages = await res.json();

    if (!res.ok) throw new Error(messages.message || 'Failed to load messages');

    renderMessages(messages);

    fetch(API_URL + '/messages/read/' + userId, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token }
    });

  } catch (err) {
    container.innerHTML = '<p style="text-align:center; color:#888;">Could not load messages.</p>';
  }
}

function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  if (!messages.length) {
    container.innerHTML = '<p style="text-align:center; color:#888;">Say hello! 👋</p>';
    return;
  }

  messages.forEach(msg => {
    const senderId = msg.sender._id || msg.sender;
    const isMine = senderId === currentUser.id;
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = isMine
      ? 'background:#ff4d8d; color:white; padding:10px; border-radius:10px; margin:5px 0 5px auto; max-width:70%; text-align:right;'
      : 'background:#eee; color:#333; padding:10px; border-radius:10px; margin:5px auto 5px 0; max-width:70%; text-align:left;';
    msgDiv.textContent = msg.text;
    container.appendChild(msgDiv);
  });

  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input?.value?.trim();
  if (!text || !currentChatUserId) return;

  input.value = '';

  try {
    const res = await fetch(API_URL + '/messages/' + currentChatUserId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to send message');

    await loadMessages(currentChatUserId);

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

// ==================== NOTIFICATIONS ====================

function startNotifPolling() {
  checkUnreadMessages();
  if (notifInterval) clearInterval(notifInterval);
  notifInterval = setInterval(checkUnreadMessages, 10000);
}

function stopNotifPolling() {
  if (notifInterval) clearInterval(notifInterval);
  notifInterval = null;
}

async function checkUnreadMessages() {
  if (!token) return;
  try {
    const res = await fetch(API_URL + '/messages/unread/count', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const badge = document.getElementById('notif-badge');

    if (data.count > 0) {
      if (badge) {
        badge.textContent = data.count;
        badge.style.display = 'inline-block';
      }
      if (data.count > lastUnreadCount) {
        showMessage('💌 You have a new message!', 'success');
      }
    } else {
      if (badge) badge.style.display = 'none';
    }

    lastUnreadCount = data.count;
  } catch (err) {
    console.error('Notif check error:', err);
  }
}

// ==================== LOGOUT ====================

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  currentUser = null;

  stopNotifPolling();

  const authSection = document.getElementById('auth-section');
  const app = document.getElementById('app');

  if (authSection) authSection.style.display = 'block';
  if (app) app.style.display = 'none';

  hideMessage();
  isLogin = false;

  document.getElementById('form-title').textContent = 'Sign Up';
  document.getElementById('submit-btn').textContent = 'Sign Up';
  document.getElementById('name').style.display = 'block';
  document.getElementById('gender').style.display = 'block';
  document.getElementById('interest').style.display = 'block';
}

// ==================== INIT ====================

window.onload = function() {
  token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');

  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      console.error('Failed to parse user:', e);
    }
  }

  if (token && currentUser) {
    showApp();
  } else {
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.style.display = 'block';
  }
};