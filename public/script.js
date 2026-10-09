const API_URL = "https://loveamon.onrender.com/api";

let token = null;
let currentUser = null;
let isLogin = false;
let currentChatUserId = null;
let currentVideoId = null;
let currentPublicProfileId = null;
let notifInterval = null;
let lastUnreadCount = 0;
let contextMenuMessageId = null;

let feedVideos = [];
let feedIndex = 0;
let touchStartY = null;
let feedSwipeBound = false;

let leafletMapInstance = null;

let worldSocket = null;
let worldCtx = null;
let worldUsers = {};
let worldMoveInterval = null;
const WORLD_SPEED = 4;
const WORLD_TALK_DISTANCE = 90;

// ==================== AUTH FAILURE HANDLING ====================

function handleAuthFailure(status) {
  if (status === 401) {
    showMessage('⚠️ Your session expired. Please log in again.', 'error');
    logout();
    return true;
  }
  return false;
}

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

  if (!title || !btn || !toggleText) return;

  if (isLogin) {
    title.textContent = 'Log In';
    btn.textContent = 'Log In';
    toggleText.innerHTML = 'No account yet? <a href="#" onclick="toggleForm()">Sign Up</a>';
    document.getElementById('name').style.display = 'none';
  } else {
    title.textContent = 'Sign Up';
    btn.textContent = 'Sign Up';
    toggleText.innerHTML = 'Already have an account? <a href="#" onclick="toggleForm()">Log In</a>';
    document.getElementById('name').style.display = 'block';
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

    if (!name) {
      showMessage('❌ Please fill in all fields');
      return;
    }

    await doRegister(name, email, password);
  }
}

// ==================== REGISTER ====================

async function doRegister(name, email, password) {
  setLoading(true);
  showMessage('Creating account...', 'loading');

  const slowTimer = setTimeout(() => {
    showMessage('⏳ Server is waking up, this can take up to a minute...', 'loading');
  }, 8000);

  try {
    const res = await fetch(API_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    clearTimeout(slowTimer);
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Registration failed');

    hideMessage();
    showMessage('✅ Account created! Please log in.', 'success');

    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    document.getElementById('name').value = '';

    setTimeout(() => { toggleForm(); }, 2000);

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

    if (!res.ok) throw new Error(data.message || 'Login failed');

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));

    hideMessage();
    showMessage('✅ Login successful! Redirecting...', 'success');

    setTimeout(() => { showApp(); }, 1000);

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
  if (!authSection || !app) return;

  authSection.style.display = 'none';
  app.style.display = 'block';

  const hasProfile = currentUser && currentUser.profilePicture;

  hideAllScreens();

  if (hasProfile) {
    document.getElementById('profile-setup').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'flex';
    showTab('videos');
    startNotifPolling();
  } else {
    document.getElementById('profile-setup').style.display = 'block';
  }
}

function pauseAllVideos() {
  document.querySelectorAll('video').forEach(v => {
    try { v.pause(); } catch (e) {}
  });
}

function hideAllScreens() {
  pauseAllVideos();
  [
    'matching-screen', 'messages-screen', 'my-profile-screen',
    'upload-video-screen', 'edit-profile-screen', 'chat-screen',
    'video-feed-screen', 'video-detail-screen', 'public-profile-screen',
    'map-screen', 'world-screen', 'camera-screen', 'portal-screen'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ==================== TAB NAVIGATION ====================

function showTab(tab) {
  hideAllScreens();
  document.querySelectorAll('#bottom-nav button').forEach(b => b.classList.remove('active'));

  if (tab === 'videos') {
    document.getElementById('video-feed-screen').style.display = 'block';
    document.getElementById('nav-videos').classList.add('active');
    closeFeedSearch();
    loadVideoFeed();
  } else if (tab === 'messages') {
    document.getElementById('messages-screen').style.display = 'block';
    document.getElementById('nav-messages').classList.add('active');
    loadConversations();
  } else if (tab === 'matching') {
    document.getElementById('matching-screen').style.display = 'block';
    document.getElementById('nav-matches').classList.add('active');
    loadProfiles();
  } else if (tab === 'profile') {
    document.getElementById('my-profile-screen').style.display = 'block';
    document.getElementById('nav-profile').classList.add('active');
    loadMyProfile();
    loadMyVideos();
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
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });

    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save profile');

    currentUser = { ...currentUser, ...data };
    localStorage.setItem('user', JSON.stringify(currentUser));

    hideMessage();
    showMessage('✅ Profile saved!', 'success');

    document.getElementById('profile-setup').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'flex';
    showTab('videos');
    startNotifPolling();

  } catch (err) {
    hideMessage();
    showMessage('❌ ' + err.message);
  }
}

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

// ==================== EDIT PROFILE PICTURE ====================

function openEditProfile() {
  hideAllScreens();
  document.getElementById('edit-profile-screen').style.display = 'block';
}

function closeEditProfile() {
  document.getElementById('edit-profile-screen').style.display = 'none';
  showTab('profile');
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

    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update photo');

    currentUser = { ...currentUser, ...data };
    localStorage.setItem('user', JSON.stringify(currentUser));

    hideMessage();
    showMessage('✅ Profile picture updated!', 'success');

    setTimeout(() => { closeEditProfile(); }, 1000);

  } catch (err) {
    hideMessage();
    showMessage('❌ ' + err.message);
  }
}

// ==================== MY PROFILE ====================

async function loadMyProfile() {
  const container = document.getElementById('my-profile-details');
  container.innerHTML = '<p>Loading...</p>';

  try {
    const res = await fetch(API_URL + '/profile/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const user = await res.json();
    if (!res.ok) throw new Error(user.message || 'Failed to load profile');

    container.innerHTML = `
      ${user.profilePicture ? `<img src="${user.profilePicture}" style="width:180px; height:180px; object-fit:cover; border-radius:50%; margin-bottom:15px;">` : '<p>No profile picture yet.</p>'}
      <h3>${user.name}</h3>
      <p style="color:#666;">${user.followers?.length || 0} followers · ${user.following?.length || 0} following</p>
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
    if (handleAuthFailure(res.status)) return;
    const videos = await res.json();
    if (!res.ok) throw new Error(videos.message || 'Failed to load videos');

    if (!videos.length) {
      container.innerHTML = "<p>You haven't uploaded any videos yet.</p>";
      return;
    }

    container.innerHTML = videos.map(v => `
      <div style="margin-bottom:20px; text-align:left;">
        <video src="${v.url}" controls crossorigin="anonymous" style="width:100%; border-radius:8px; cursor:pointer;" onclick="openVideoDetail('${v._id}')"></video>
        ${v.caption ? `<p style="font-size:14px; color:#555; margin-top:5px;">${v.caption}</p>` : ''}
        <p style="font-size:13px; color:#888;">👁️ ${v.views || 0} views · ❤️ ${v.likes?.length || 0} likes · 💬 ${v.comments?.length || 0} comments</p>
        <button onclick="deleteMyVideo('${v._id}')" style="background:#d32f2f; margin-top:5px;">🗑️ Delete Video</button>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = '<p>Could not load your videos.</p>';
  }
}

async function deleteMyVideo(videoId) {
  if (!confirm('Delete this video permanently?')) return;

  try {
    const res = await fetch(API_URL + '/videos/' + videoId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete video');

    showMessage('✅ Video deleted', 'success');
    loadMyVideos();

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

// ==================== VIDEO UPLOAD ====================

function openUploadVideo() {
  hideAllScreens();
  document.getElementById('upload-video-screen').style.display = 'block';
}

function closeUploadVideo() {
  document.getElementById('upload-video-screen').style.display = 'none';
  showTab('videos');
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

    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload failed');

    statusDiv.textContent = '✅ Video uploaded successfully!';
    document.getElementById('video-input').value = '';
    document.getElementById('video-caption').value = '';

    setTimeout(() => { closeUploadVideo(); }, 1500);

  } catch (err) {
    statusDiv.textContent = '❌ ' + err.message;
  }
}

// ==================== VIDEO FEED (swipeable) ====================

async function loadVideoFeed() {
  const container = document.getElementById('video-feed');
  container.innerHTML = '<p class="feed-empty">Loading videos...</p>';

  try {
    const res = await fetch(API_URL + '/videos/feed', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const videos = await res.json();
    if (!res.ok) throw new Error(videos.message || 'Failed to load videos');

    feedVideos = videos;
    feedIndex = 0;

    if (!feedVideos.length) {
      container.innerHTML = '<p class="feed-empty">No videos yet. Check back later! 🎬</p>';
      return;
    }

    renderFeedSlides();
    setupFeedSwipe();

  } catch (err) {
    container.innerHTML = '<p class="feed-empty">Could not load videos.</p>';
  }
}

function renderFeedSlides() {
  const container = document.getElementById('video-feed');
  container.innerHTML = feedVideos.map((v, i) => {
    const liked = v.likes?.includes(currentUser.id);
    const heartIcon = liked ? '❤️' : '🤍';
    return `
      <div class="video-slide" data-index="${i}">
        <video src="${v.url}" loop playsinline preload="metadata" crossorigin="anonymous" onloadedmetadata="fitVideoMode(this)" onclick="toggleSlidePlay(this)"></video>
        <div class="slide-top">
          <strong onclick="openPublicProfile('${v.user?._id}')">${v.user?.name || 'Unknown'}</strong>
          ${v.user?._id !== currentUser.id ? `
            <button class="slide-follow-btn" id="slide-follow-${v._id}" onclick="followFromSlide('${v.user?._id}', '${v._id}')">
              ${v.isFollowingAuthor ? '✓ Following' : '+ Follow'}
            </button>
          ` : ''}
        </div>
        ${v.caption ? `<div class="slide-caption">${v.caption}</div>` : ''}
        <div class="slide-actions">
          <div style="text-align:center;">
            <button onclick="toggleLikeSlide('${v._id}')">${heartIcon}</button>
            <div class="slide-action-count">${v.likes?.length || 0}</div>
          </div>
          <div style="text-align:center;">
            <button onclick="openVideoDetail('${v._id}')">💬</button>
            <div class="slide-action-count">${v.comments?.length || 0}</div>
          </div>
          <div style="text-align:center;">
            <button onclick="shareVideo('${v.url}')">↗️</button>
            <div class="slide-action-count">Share</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  fitFeedHeight();
  restoreFeedPosition();
  observeFeedSlides();
}

function toggleSlidePlay(videoEl) {
  // if the browser forced the video to start muted, the first tap turns the sound on
  if (videoEl.muted && !videoEl.paused) { videoEl.muted = false; return; }
  if (videoEl.paused) videoEl.play().catch(() => {}); else videoEl.pause();
}

let feedObserver = null;
const feedViewed = new Set();

// Make the feed exactly as tall as the free space between the search bar and the bottom nav
function fitFeedHeight() {
  const container = document.getElementById('video-feed-container');
  const screen = document.getElementById('video-feed-screen');
  if (!container || !screen || container.style.display === 'none') return;
  const nav = document.getElementById('bottom-nav');
  const navH = nav ? nav.offsetHeight : 70;
  // the feed fills everything above the bottom nav bar
  screen.style.bottom = navH + 'px';
  const h = Math.max(300, Math.floor(window.innerHeight - navH));
  container.style.setProperty('--feed-h', h + 'px');
}

function restoreFeedPosition() {
  const container = document.getElementById('video-feed-container');
  if (!container) return;
  container.scrollTop = feedIndex * container.clientHeight;
}

function playSlideVideo(vid) {
  const p = vid.play();
  if (p && p.catch) {
    // some phones only allow muted autoplay when the swipe wasn't a direct tap
    p.catch(() => { vid.muted = true; vid.play().catch(() => {}); });
  }
}

// Plays the video you're looking at and pauses the rest
function observeFeedSlides() {
  const container = document.getElementById('video-feed-container');
  if (!container) return;
  if (feedObserver) feedObserver.disconnect();

  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const slide = entry.target;
      const vid = slide.querySelector('video');
      const idx = parseInt(slide.dataset.index);
      if (!vid) return;

      if (entry.isIntersecting) {
        feedIndex = idx;
        playSlideVideo(vid);
        const video = feedVideos[idx];
        if (video && !feedViewed.has(video._id)) {
          feedViewed.add(video._id);
          fetch(API_URL + '/videos/view/' + video._id, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
          }).catch(() => {});
        }
      } else {
        vid.pause();
      }
    });
  }, { root: container, threshold: 0.6 });

  container.querySelectorAll('.video-slide').forEach(s => feedObserver.observe(s));
}

// Swiping is now native scrolling (with snap), so we only need to keep the size right
function setupFeedSwipe() {
  if (feedSwipeBound) return;
  feedSwipeBound = true;
  window.addEventListener('resize', () => {
    fitFeedHeight();
    restoreFeedPosition();
  });
}

function goToSlide(index) {
  const container = document.getElementById('video-feed-container');
  if (!container || index < 0 || index >= feedVideos.length) return;
  container.scrollTo({ top: index * container.clientHeight, behavior: 'smooth' });
}

async function toggleLikeSlide(videoId) {
  try {
    const res = await fetch(API_URL + '/videos/like/' + videoId, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to like video');

    const video = feedVideos.find(v => v._id === videoId);
    if (video) {
      if (data.liked) {
        if (!video.likes.includes(currentUser.id)) video.likes.push(currentUser.id);
      } else {
        video.likes = video.likes.filter(id => id !== currentUser.id);
      }
    }
    renderFeedSlides();

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

async function followFromSlide(userId, videoId) {
  if (!userId) return;
  try {
    const profileRes = await fetch(API_URL + '/follow/' + userId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(profileRes.status)) return;
    const profile = await profileRes.json();

    const method = profile.isFollowing ? 'DELETE' : 'POST';
    const res = await fetch(API_URL + '/follow/' + userId, {
      method,
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update follow status');

    feedVideos.forEach(v => {
      if (v.user?._id === userId) v.isFollowingAuthor = data.following;
    });
    renderFeedSlides();

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

async function shareVideo(url) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Check out this video on LoveConnect!', url });
    } catch (err) {
      // user cancelled share sheet — no action needed
    }
  } else {
    try {
      await navigator.clipboard.writeText(url);
      showMessage('🔗 Link copied to clipboard!', 'success');
    } catch (err) {
      showMessage('❌ Could not copy link');
    }
  }
}

// ==================== FEED SEARCH (small button that expands) ====================

function openFeedSearch() {
  document.getElementById('feed-search-toggle').style.display = 'none';
  document.getElementById('feed-search-bar').style.display = 'flex';
  const input = document.getElementById('search-input');
  if (input) input.focus();
}

function closeFeedSearch() {
  const toggle = document.getElementById('feed-search-toggle');
  const bar = document.getElementById('feed-search-bar');
  const results = document.getElementById('search-results');
  const input = document.getElementById('search-input');
  if (toggle) toggle.style.display = 'flex';
  if (bar) bar.style.display = 'none';
  if (results) { results.innerHTML = ''; results.style.display = 'none'; }
  if (input) input.value = '';
}

// portrait videos fill the whole screen, landscape ones stay uncropped
function fitVideoMode(v) {
  v.style.objectFit = v.videoHeight > v.videoWidth ? 'cover' : 'contain';
}

// ==================== SEARCH USERS ====================

async function searchUsers() {
  const input = document.getElementById('search-input');
  const q = input?.value?.trim();
  const container = document.getElementById('search-results');

  if (!q) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '<p style="margin:10px;">Searching...</p>';

  try {
    const res = await fetch(API_URL + '/follow/search?q=' + encodeURIComponent(q), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const users = await res.json();
    if (!res.ok) throw new Error(users.message || 'Search failed');

    if (!users.length) {
      container.innerHTML = '<p>No users found.</p>';
      return;
    }

    container.innerHTML = users.map(u => `
      <div class="search-result-item" onclick="openPublicProfile('${u._id}')">
        ${u.profilePicture ? `<img src="${u.profilePicture}">` : ''}
        <div>
          <strong>${u.name}</strong>
          <p style="margin:0; color:#666; font-size:13px;">${u.bio || ''}</p>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = '<p>Could not search users.</p>';
  }
}

// ==================== PUBLIC PROFILE ====================

async function openPublicProfile(userId) {
  if (!userId) return;
  currentPublicProfileId = userId;
  hideAllScreens();
  document.getElementById('public-profile-screen').style.display = 'block';
  await loadPublicProfile(userId);
}

function closePublicProfile() {
  document.getElementById('public-profile-screen').style.display = 'none';
  currentPublicProfileId = null;
  showTab('videos');
}

async function loadPublicProfile(userId) {
  const details = document.getElementById('public-profile-details');
  const videosContainer = document.getElementById('public-profile-videos');
  details.innerHTML = '<p>Loading...</p>';
  videosContainer.innerHTML = '';

  try {
    const res = await fetch(API_URL + '/follow/' + userId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const profile = await res.json();
    if (!res.ok) throw new Error(profile.message || 'Failed to load profile');

    details.innerHTML = `
      ${profile.profilePicture ? `<img src="${profile.profilePicture}" style="width:150px; height:150px; object-fit:cover; border-radius:50%; margin-bottom:10px;">` : ''}
      <h3>${profile.name}</h3>
      <p style="color:#666;">${profile.followersCount} followers · ${profile.followingCount} following</p>
      <p>${profile.bio || ''}</p>
      ${!profile.isSelf ? `
        <button onclick="toggleFollow('${profile._id}')" style="background:${profile.isFollowing ? '#eee' : '#ff4d8d'}; color:${profile.isFollowing ? '#333' : 'white'};">
          ${profile.isFollowing ? 'Unfollow' : '+ Follow'}
        </button>
        <button onclick="openChat('${profile._id}', '${profile.name}')" style="background:#4d7cff;">💬 Message</button>
      ` : ''}
    `;

    if (!profile.videos.length) {
      videosContainer.innerHTML = '<p>No videos yet.</p>';
    } else {
      videosContainer.innerHTML = profile.videos.map(v => `
        <div style="margin-bottom:15px;">
          <video src="${v.url}" controls crossorigin="anonymous" style="width:100%; border-radius:8px; cursor:pointer;" onclick="openVideoDetail('${v._id}')"></video>
          ${v.caption ? `<p style="font-size:13px; color:#555;">${v.caption}</p>` : ''}
        </div>
      `).join('');
    }

  } catch (err) {
    details.innerHTML = '<p>Could not load profile.</p>';
  }
}

async function toggleFollow(userId) {
  try {
    const profileRes = await fetch(API_URL + '/follow/' + userId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(profileRes.status)) return;
    const profile = await profileRes.json();

    const method = profile.isFollowing ? 'DELETE' : 'POST';

    const res = await fetch(API_URL + '/follow/' + userId, {
      method,
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update follow status');

    loadPublicProfile(userId);

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

// ==================== VIDEO COMMENTS PANEL ====================

async function openVideoDetail(videoId) {
  currentVideoId = videoId;
  hideAllScreens();
  document.getElementById('video-detail-screen').style.display = 'block';
  await loadVideoDetail(videoId);
}

function closeVideoDetail() {
  document.getElementById('video-detail-screen').style.display = 'none';
  currentVideoId = null;
  showTab('videos');
}

async function loadVideoDetail(videoId) {
  const content = document.getElementById('video-detail-content');
  const commentsList = document.getElementById('video-comments-list');
  content.innerHTML = '<p>Loading...</p>';
  commentsList.innerHTML = '';

  try {
    const res = await fetch(API_URL + '/videos/' + videoId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const video = await res.json();
    if (!res.ok) throw new Error(video.message || 'Failed to load video');

    const liked = video.likes?.includes(currentUser.id);

    content.innerHTML = `
      <p onclick="openVideoDetailAuthor('${video.user?._id}')" style="cursor:pointer;"><strong>${video.user?.name || 'Unknown'}</strong></p>
      <video src="${video.url}" controls crossorigin="anonymous" style="width:100%; border-radius:8px;"></video>
      ${video.caption ? `<p style="margin-top:8px;">${video.caption}</p>` : ''}
      <p style="font-size:13px; color:#888;">👁️ ${video.views || 0} views</p>
      <button onclick="likeVideoDetail('${video._id}')" style="background:${liked ? '#ff4d8d' : '#eee'}; color:${liked ? 'white' : '#333'}; margin-top:10px;">${liked ? '❤️' : '🤍'} ${video.likes?.length || 0} Likes</button>
    `;

    if (!video.comments || !video.comments.length) {
      commentsList.innerHTML = '<p style="color:#888;">No comments yet. Be the first!</p>';
    } else {
      commentsList.innerHTML = video.comments.map(c => `
        <div class="comment-item">
          <strong>${c.user?.name || 'Someone'}:</strong> ${c.text}
        </div>
      `).join('');
    }

  } catch (err) {
    content.innerHTML = '<p>Could not load video.</p>';
  }
}

function openVideoDetailAuthor(userId) {
  if (userId) openPublicProfile(userId);
}

async function likeVideoDetail(videoId) {
  try {
    const res = await fetch(API_URL + '/videos/like/' + videoId, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to like video');

    loadVideoDetail(videoId);
  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

async function submitComment() {
  const input = document.getElementById('comment-input');
  const text = input?.value?.trim();
  if (!text || !currentVideoId) return;

  input.value = '';

  try {
    const res = await fetch(API_URL + '/videos/comment/' + currentVideoId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ text })
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to post comment');

    loadVideoDetail(currentVideoId);
  } catch (err) {
    showMessage('❌ ' + err.message);
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
    if (handleAuthFailure(res.status)) return;
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
        <button onclick="likeUser('${profile._id}', '${profile.name}')" style="background:${profile.alreadyLiked ? '#ff4d8d' : ''};">
          ${profile.alreadyLiked ? '💖 Liked' : '💖 Like'}
        </button>
        <button onclick="openChat('${profile._id}', '${profile.name}')" style="background:#4d7cff;">💬 Message</button>
        <button onclick="openPublicProfile('${profile._id}')" style="background:#555;">👤 View Profile</button>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = '<p>Could not load profiles. Try again later.</p>';
  }
}

async function likeUser(targetId, targetName) {
  try {
    const res = await fetch(API_URL + '/match/like/' + targetId, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to like user');

    if (data.match) {
      showMessage("🎉 It's a match with " + targetName + "!", 'success');
    } else if (data.alreadyLiked) {
      showMessage('You already liked ' + targetName, 'success');
    } else {
      showMessage('💕 Liked ' + targetName + '!', 'success');
    }

    loadProfiles();

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

// ==================== MESSAGES LIST ====================

async function loadConversations() {
  const container = document.getElementById('conversations-list');
  container.innerHTML = '<p>Loading conversations...</p>';

  try {
    const res = await fetch(API_URL + '/messages', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const conversations = await res.json();
    if (!res.ok) throw new Error(conversations.message || 'Failed to load conversations');

    if (!conversations.length) {
      container.innerHTML = '<p>No conversations yet. Go like or message someone! 💕</p>';
      return;
    }

    container.innerHTML = conversations.map(c => `
      <div class="conversation-item" onclick="openChat('${c.userId}', '${c.name}')">
        ${c.profilePicture ? `<img src="${c.profilePicture}">` : ''}
        <div style="flex:1;">
          <strong>${c.name}</strong>
          <p style="margin:0; color:#666; font-size:14px;">${c.lastMessage}</p>
        </div>
        ${c.unreadCount > 0 ? `<span style="background:red; color:white; border-radius:50%; padding:4px 10px; font-size:12px;">${c.unreadCount}</span>` : ''}
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = '<p>Could not load conversations.</p>';
  }
}

// ==================== CHAT ====================

async function openChat(userId, userName) {
  currentChatUserId = userId;
  hideAllScreens();
  document.getElementById('chat-screen').style.display = 'block';
  document.getElementById('chat-with-name').textContent = userName;
  await loadMessages(userId);
  checkUnreadMessages();
}

function closeChat() {
  document.getElementById('chat-screen').style.display = 'none';
  showTab('messages');
  currentChatUserId = null;
}

async function loadMessages(userId) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '<p style="text-align:center; color:#888;">Loading messages...</p>';

  try {
    const res = await fetch(API_URL + '/messages/' + userId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
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

function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return date + ' ' + time;
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

    const outer = document.createElement('div');
    outer.style.cssText = 'display:flex; flex-direction:column;' + (isMine ? ' align-items:flex-end;' : ' align-items:flex-start;');
    outer.style.margin = '5px 0';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;' + (isMine ? ' justify-content:flex-end;' : '');

    const bubble = document.createElement('div');
    bubble.style.cssText = isMine
      ? 'background:#ff4d8d; color:white; padding:10px; border-radius:10px; max-width:70%; text-align:right; cursor:pointer;'
      : 'background:#eee; color:#333; padding:10px; border-radius:10px; max-width:70%; text-align:left;';
    bubble.textContent = msg.deletedForEveryone ? '🚫 This message was deleted' : msg.text;
    if (msg.deletedForEveryone) bubble.style.fontStyle = 'italic';

    if (isMine && !msg.deletedForEveryone) {
      bubble.oncontextmenu = (e) => {
        e.preventDefault();
        openMessageContextMenu(e, msg._id);
      };
    }

    wrap.appendChild(bubble);
    outer.appendChild(wrap);

    const timeLabel = document.createElement('div');
    timeLabel.style.cssText = 'font-size:11px; color:#999; margin-top:2px;';
    timeLabel.textContent = formatMessageTime(msg.createdAt);
    outer.appendChild(timeLabel);

    container.appendChild(outer);
  });

  container.scrollTop = container.scrollHeight;
}

function openMessageContextMenu(e, messageId) {
  contextMenuMessageId = messageId;
  const menu = document.getElementById('msg-context-menu');
  menu.style.display = 'block';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 100) + 'px';
}

document.addEventListener('click', () => {
  const menu = document.getElementById('msg-context-menu');
  if (menu) menu.style.display = 'none';
});

async function confirmDeleteMessage(mode) {
  document.getElementById('msg-context-menu').style.display = 'none';
  if (!contextMenuMessageId) return;

  try {
    const res = await fetch(API_URL + '/messages/' + contextMenuMessageId + '?mode=' + mode, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete message');

    if (currentChatUserId) await loadMessages(currentChatUserId);

  } catch (err) {
    showMessage('❌ ' + err.message);
  } finally {
    contextMenuMessageId = null;
  }
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
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send message');

    await loadMessages(currentChatUserId);

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

// ==================== MAP ====================

const AVATAR_COLORS = ['#ff6b6b', '#4d7cff', '#25d366', '#ffa94d', '#9775fa', '#ff8fab', '#20c997', '#f783ac'];
const AVATAR_EMOJIS = ['🧍', '🧍‍♀️', '🕺', '💃', '🚶', '🚶‍♀️'];

function buildCartoonAvatarHTML(user) {
  const seed = parseInt(user._id.toString().slice(-6), 16);
  const color = AVATAR_COLORS[seed % AVATAR_COLORS.length];
  const emoji = AVATAR_EMOJIS[seed % AVATAR_EMOJIS.length];

  return `
    <div style="display:flex; flex-direction:column; align-items:center; cursor:pointer;">
      <div style="
        width:44px; height:44px; border-radius:50%;
        border:3px solid ${color}; overflow:hidden;
        background:white; display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
      ">
        ${user.profilePicture
          ? `<img src="${user.profilePicture}" style="width:100%; height:100%; object-fit:cover;">`
          : `<span style="font-size:22px;">${emoji}</span>`}
      </div>
      <div style="
        width:22px; height:28px; margin-top:-4px;
        background:${color}; border-radius:10px 10px 4px 4px;
        display:flex; align-items:flex-start; justify-content:center;
        font-size:14px; padding-top:2px;
      ">${emoji}</div>
    </div>
  `;
}

function openMap() {
  hideAllScreens();
  document.getElementById('map-screen').style.display = 'block';
  loadMapUsers();
}

function closeMap() {
  document.getElementById('map-screen').style.display = 'none';
  showTab('videos');
}

async function loadMapUsers() {
  try {
    const res = await fetch(API_URL + '/follow/map/users', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (handleAuthFailure(res.status)) return;
    const users = await res.json();
    if (!res.ok) throw new Error(users.message || 'Failed to load map');

    if (!leafletMapInstance) {
      leafletMapInstance = L.map('leaflet-map').setView([-15.7861, 35.0058], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(leafletMapInstance);
    } else {
      leafletMapInstance.eachLayer(layer => {
        if (layer instanceof L.Marker) leafletMapInstance.removeLayer(layer);
      });
      leafletMapInstance.invalidateSize();
    }

    users.forEach(u => {
      const icon = L.divIcon({
        html: buildCartoonAvatarHTML(u),
        className: '',
        iconSize: [50, 70],
        iconAnchor: [25, 70]
      });

      const marker = L.marker([u.lat, u.lng], { icon }).addTo(leafletMapInstance);
      marker.bindPopup(`
        <div style="text-align:center; min-width:140px;">
          <div style="
            background:#f0f0f0; border-radius:16px; padding:8px 12px;
            font-size:14px; margin-bottom:8px; position:relative;
          ">
            💬 Talk to <strong>${u.name}</strong>?
          </div>
          <button onclick="openChat('${u._id}', '${u.name}')" style="padding:8px 18px; background:#ff4d8d; color:white; border:none; border-radius:16px; cursor:pointer; font-weight:600;">Yes, message them</button>
        </div>
      `);
    });

  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

// ==================== WORLD (big town: houses, cars, places to visit) ====================

const WORLD_W = 2400;
const WORLD_H = 1600;  // must match server.js
const WORLD_PAD = 24;

const WORLD_EMOTES = { heart: '❤️', wave: '👋', dance: '💃' };
const WORLD_EMOTE_MS = 2500;
const WORLD_BUBBLE_MS = 30000;   // chat bubbles stay 30 seconds (or until someone replies)
const WORLD_TRAIL_MS = 700;
const WORLD_WALK_SPEED = 230;    // world units per second
const WORLD_CAR_SPEED = 560;

// where each "go to" button drops you
const WORLD_PLACES = {
  plaza:  { x: 1200, y: 700 },
  park:   { x: 520,  y: 560 },
  cafe:   { x: 1600, y: 520 },
  beach:  { x: 560,  y: 1180 },
  houses: { x: 1700, y: 1235 }
};

let worldRoom = 'town';
let worldAnimFrame = null;
const worldImages = {}; // url -> { img, ok }
let worldScale = 1, worldZoom = 1, worldDpr = 1;
let worldViewW = 600, worldViewH = 600, worldCssW = 0, worldCssH = 0, worldMiniY = 70;
let worldCamX = 0, worldCamY = 0, worldCamSnap = true;
let worldTarget = null;          // where my avatar is walking to
let worldPointerDown = false;
let worldLastMoveSent = 0;
let worldLastFrame = 0;
let worldPromptUid = null;
let worldVehicle = null;         // the car I'm driving (emoji) or null

function isWorldOpen() {
  return document.getElementById('world-screen').style.display !== 'none';
}

function joinWorld() {
  if (!worldSocket || !isWorldOpen()) return;
  worldSocket.emit('world:join', {
    name: currentUser.name,
    profilePicture: currentUser.profilePicture
  });
}

function openWorld() {
  hideAllScreens();
  document.getElementById('world-screen').style.display = 'flex';

  const canvas = document.getElementById('world-canvas');
  worldCtx = canvas.getContext('2d');
  worldTarget = null;
  worldLastFrame = 0;
  worldCamSnap = true;
  fitWorldCanvas();
  setupWorldPointer();

  if (!worldSocket) {
    worldSocket = io({ auth: { token } });

    worldSocket.on('connect', joinWorld);

    // Full list of everyone in the town (sent on join and when someone arrives)
    worldSocket.on('world:state', ({ room, users }) => {
      worldRoom = room;
      const next = {};
      users.forEach(u => {
        const old = worldUsers[u.userId];
        const isMe = u.userId === currentUser.id;
        // while I'm walking, trust my own position over the server's older copy
        const keep = (isMe && old && worldTarget) ? { x: old.x, y: old.y } : null;
        const merged = Object.assign(old || { dx: u.x, dy: u.y, trail: [], phase: 0 }, u);
        if (keep) Object.assign(merged, keep);
        if (isMe) merged.vehicle = worldVehicle;
        next[u.userId] = merged;
      });
      worldUsers = next;
      checkWorldProximity();
    });

    worldSocket.on('world:userMoved', ({ userId, x, y }) => {
      const u = worldUsers[userId];
      if (u) { u.x = x; u.y = y; }
    });

    worldSocket.on('world:userLeft', ({ userId }) => {
      delete worldUsers[userId];
      checkWorldProximity();
    });

    worldSocket.on('world:vehicle', ({ userId, vehicle }) => {
      const u = worldUsers[userId];
      if (u && userId !== currentUser.id) u.vehicle = vehicle || null;
    });

    worldSocket.on('world:emote', ({ userId, emote }) => {
      const u = worldUsers[userId];
      if (u && WORLD_EMOTES[emote]) u.emote = { type: emote, start: performance.now() };
    });

    worldSocket.on('world:chat', ({ userId, text }) => {
      const u = worldUsers[userId];
      if (!u) return;
      // a reply from someone else ends the earlier bubbles; otherwise they last 30 seconds
      Object.values(worldUsers).forEach(o => { if (o.userId !== userId) o.bubble = null; });
      u.bubble = { text: String(text), until: performance.now() + WORLD_BUBBLE_MS };
    });
  } else if (worldSocket.connected) {
    joinWorld();
  }

  startWorldLoop();
}

// shared clean-up when leaving the world for any reason
function leaveWorld() {
  closeWorldChat();
  document.getElementById('world-screen').style.display = 'none';
  stopWorldLoop();
  worldTarget = null;
  worldPointerDown = false;
  worldPromptUid = null;
  worldVehicle = null;
  const exitBtn = document.getElementById('world-exit-car');
  if (exitBtn) exitBtn.style.display = 'none';

  // tell the server we left so our avatar doesn't stay standing there (it also saves our position)
  if (worldSocket && worldSocket.connected) worldSocket.emit('world:leave');
  worldUsers = {};
}

function closeWorld() {
  leaveWorld();
  showTab('videos');
}

function openMapFromWorld() {
  leaveWorld();
  openMap();
}

// ---------- full-screen canvas + camera zoom ----------

function fitWorldCanvas() {
  const stage = document.getElementById('world-stage');
  const canvas = document.getElementById('world-canvas');
  if (!stage || !canvas) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!(w > 0 && h > 0)) return;

  worldDpr = window.devicePixelRatio || 1;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * worldDpr);
  canvas.height = Math.floor(h * worldDpr);

  worldCssW = w; worldCssH = h;
  worldZoom = Math.min(1.35, Math.max(0.65, Math.min(w, h) / 640));
  worldScale = worldZoom * worldDpr;
  worldViewW = w / worldZoom;
  worldViewH = h / worldZoom;

  const bar = document.getElementById('world-topbar');
  worldMiniY = (bar ? bar.offsetHeight : 56) + 8;
}
window.addEventListener('resize', () => { if (isWorldOpen()) fitWorldCanvas(); });

// ---------- places, cars ----------

function goToPlace(key) {
  const me = worldUsers[currentUser.id];
  const p = WORLD_PLACES[key];
  if (!me || !p || !worldSocket) return;
  me.x = p.x + (Math.random() * 60 - 30);
  me.y = p.y + (Math.random() * 30 - 15);
  me.dx = me.x; me.dy = me.y;
  worldTarget = null;
  worldCamSnap = true;
  worldSocket.emit('world:move', { x: me.x, y: me.y });
  checkWorldProximity();
}

function enterWorldCar(car) {
  const me = worldUsers[currentUser.id];
  if (!me || !worldSocket) return;
  if (Math.hypot(me.x - car.x, me.y - car.y) > 170) {
    showMessage('🚗 Walk closer to the car first');
    return;
  }
  worldVehicle = car.e;
  me.vehicle = car.e;
  worldTarget = null;
  worldSocket.emit('world:vehicle', { vehicle: car.e });
  document.getElementById('world-exit-car').style.display = 'inline-block';
}

function exitWorldCar() {
  const me = worldUsers[currentUser.id];
  worldVehicle = null;
  if (me) me.vehicle = null;
  if (worldSocket) worldSocket.emit('world:vehicle', { vehicle: null });
  document.getElementById('world-exit-car').style.display = 'none';
}

// ---------- movement: mouse / touch only ----------

function worldEventPoint(e) {
  const r = document.getElementById('world-canvas').getBoundingClientRect();
  return {
    x: worldCamX + (e.clientX - r.left) / worldZoom,
    y: worldCamY + (e.clientY - r.top) / worldZoom
  };
}

function worldPointToTarget(e) {
  const p = worldEventPoint(e);
  worldTarget = {
    x: Math.min(WORLD_W - WORLD_PAD, Math.max(WORLD_PAD, p.x)),
    y: Math.min(WORLD_H - WORLD_PAD, Math.max(WORLD_PAD, p.y))
  };
}

function setupWorldPointer() {
  const canvas = document.getElementById('world-canvas');
  if (canvas._worldBound) return;
  canvas._worldBound = true;

  // tap/click = walk there; hold and drag = keep steering
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = worldEventPoint(e);

    // tapping another character opens a chat with them (you stay in the game)
    const hit = Object.values(worldUsers).find(u =>
      u.userId !== currentUser.id && Math.hypot(u.dx - p.x, u.dy - p.y) < 30);
    if (hit) { openWorldChat(hit.userId, hit.name); return; }

    // tapping a portal: walk close, then it asks if you want to enter
    const portal = worldActivePortals().find(pp => Math.hypot(pp.x - p.x, pp.y - p.y) < 55);
    if (portal) {
      const me0 = worldUsers[currentUser.id];
      if (worldUsedPortals.has(portal.id)) showMessage('🔒 That portal is sealed. Find another one!');
      else if (me0 && Math.hypot(me0.x - portal.x, me0.y - portal.y) < 120) enterPortal(portal.id);
      else showMessage('🌀 Walk closer to the portal');
      return;
    }

    // tapping a parked car hops in (walk close first)
    const car = WORLD_PARKED_CARS.find(c => Math.hypot(c.x - p.x, c.y - p.y) < 40);
    if (car && !worldVehicle) { enterWorldCar(car); return; }

    worldPointerDown = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    worldPointToTarget(e);
  });
  canvas.addEventListener('pointermove', e => {
    if (worldPointerDown) worldPointToTarget(e);
  });
  const release = () => { worldPointerDown = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}

// called every frame from drawWorld()
function updateWorldMovement(now) {
  const dt = Math.min(0.05, (now - (worldLastFrame || now)) / 1000);
  worldLastFrame = now;

  const me = worldUsers[currentUser.id];
  if (!me || !worldTarget || !worldSocket) return;

  const dx = worldTarget.x - me.x;
  const dy = worldTarget.y - me.y;
  const dist = Math.hypot(dx, dy);
  const step = (worldVehicle ? WORLD_CAR_SPEED : WORLD_WALK_SPEED) * dt;
  const arrived = dist <= step;
  let nx = arrived ? worldTarget.x : me.x + dx / dist * step;
  let ny = arrived ? worldTarget.y : me.y + dy / dist * step;

  // houses, the pond and the sea are solid: slide along them instead of walking through
  if (!worldBlocked(me.x, me.y) && worldBlocked(nx, ny)) {
    if (!worldBlocked(nx, me.y)) ny = me.y;
    else if (!worldBlocked(me.x, ny)) nx = me.x;
    else { worldTarget = null; return; }
  }

  const moved = Math.hypot(nx - me.x, ny - me.y);
  if (Math.abs(nx - me.x) > 0.01) me.face = nx > me.x ? 1 : -1;
  me.x = nx;
  me.y = ny;
  if (arrived || moved < step * 0.25) worldTarget = null; // got there, or pushed against a wall

  if (arrived || now - worldLastMoveSent > 50) {
    worldSocket.emit('world:move', { x: me.x, y: me.y });
    worldLastMoveSent = now;
  }
  checkWorldProximity();
}

// ---------- emotes & chat ----------

function sendWorldEmote(emote) {
  if (!worldSocket || !WORLD_EMOTES[emote]) return;
  worldSocket.emit('world:emote', { emote });
}

function sendWorldChat() {
  const input = document.getElementById('world-chat-input');
  const text = input?.value?.trim();
  if (!text || !worldSocket) return;
  worldSocket.emit('world:chat', { text });
  input.value = '';
}

// ---------- proximity ----------

function checkWorldProximity() {
  const me = worldUsers[currentUser.id];
  const prompt = document.getElementById('world-talk-prompt');
  if (!me || !prompt) return;

  let nearest = null;
  let nearestDist = Infinity;

  Object.entries(worldUsers).forEach(([uid, u]) => {
    if (uid === currentUser.id) return;
    const dist = Math.hypot(u.x - me.x, u.y - me.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { uid, ...u };
    }
  });

  if (nearest && nearestDist < WORLD_TALK_DISTANCE) {
    if (worldPromptUid === nearest.uid) return; // already showing, don't rebuild every frame
    worldPromptUid = nearest.uid;
    prompt.textContent = '';
    const label = document.createElement('span');
    label.textContent = '💬 ' + nearest.name + ' is nearby';
    const btn = document.createElement('button');
    btn.textContent = 'Talk';
    btn.style.cssText = 'width:auto; padding:4px 10px; margin:0 0 0 8px; display:inline-block;';
    btn.onclick = () => openWorldChat(nearest.uid, nearest.name);
    prompt.append(label, btn);
    prompt.style.display = 'block';
  } else {
    worldPromptUid = null;
    prompt.style.display = 'none';
  }
}

// ---------- in-game private chat (stays inside the world) ----------

let worldChatUid = null;
let worldChatTimer = null;

function worldAuthHeaders(json) {
  const h = { 'Authorization': 'Bearer ' + token };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function openWorldChat(uid, name) {
  worldChatUid = uid;
  document.getElementById('wchat-title').textContent = '💬 ' + name;
  document.getElementById('wchat-list').textContent = '';
  document.getElementById('wchat-panel').style.display = 'flex';
  await loadWorldChat(true);
  if (worldChatTimer) clearInterval(worldChatTimer);
  worldChatTimer = setInterval(() => loadWorldChat(false), 3000); // pick up replies
  const input = document.getElementById('wchat-input');
  if (input) input.focus();
}

function closeWorldChat() {
  worldChatUid = null;
  if (worldChatTimer) clearInterval(worldChatTimer);
  worldChatTimer = null;
  const panel = document.getElementById('wchat-panel');
  if (panel) panel.style.display = 'none';
}

async function loadWorldChat(forceScroll) {
  const uid = worldChatUid;
  if (!uid) return;
  try {
    const res = await fetch(API_URL + '/messages/' + uid, { headers: worldAuthHeaders(false) });
    if (handleAuthFailure(res.status)) return;
    const msgs = await res.json();
    if (!res.ok || uid !== worldChatUid) return;

    const box = document.getElementById('wchat-list');
    const atBottom = forceScroll || box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.textContent = '';
    msgs.forEach(m => {
      const mine = String((m.sender && m.sender._id) || m.sender) === String(currentUser.id);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; margin:4px 0; justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';';
      const bub = document.createElement('div');
      bub.textContent = m.text;
      bub.style.cssText = 'max-width:75%; padding:8px 12px; border-radius:14px; font-size:14px; word-break:break-word; text-align:left; ' +
        (mine ? 'background:#ff4d8d; color:white;' : 'background:#e9e9ee; color:#222;');
      row.appendChild(bub);
      box.appendChild(row);
    });
    if (atBottom) box.scrollTop = box.scrollHeight;

    fetch(API_URL + '/messages/read/' + uid, { method: 'PUT', headers: worldAuthHeaders(false) }).catch(() => {});
  } catch (err) { /* try again on the next poll */ }
}

async function sendWorldDirect() {
  const input = document.getElementById('wchat-input');
  const text = input?.value?.trim();
  if (!text || !worldChatUid) return;
  input.value = '';
  try {
    const res = await fetch(API_URL + '/messages/' + worldChatUid, {
      method: 'POST',
      headers: worldAuthHeaders(true),
      body: JSON.stringify({ text })
    });
    if (handleAuthFailure(res.status)) return;
    if (!res.ok) throw new Error('Could not send');
    await loadWorldChat(true);
  } catch (err) {
    showMessage('❌ ' + err.message);
  }
}

// ---------- drawing ----------

function startWorldLoop() {
  if (worldAnimFrame) return;
  const tick = () => {
    drawWorld();
    worldAnimFrame = requestAnimationFrame(tick);
  };
  worldAnimFrame = requestAnimationFrame(tick);
}

function stopWorldLoop() {
  if (worldAnimFrame) cancelAnimationFrame(worldAnimFrame);
  worldAnimFrame = null;
}

function getWorldImage(url) {
  let entry = worldImages[url];
  if (!entry) {
    const img = new Image();
    entry = { img, ok: false };
    img.crossOrigin = 'anonymous';
    img.onload = () => { entry.ok = true; };
    img.src = url;
    worldImages[url] = entry;
  }
  return entry.ok ? entry.img : null;
}

function worldRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function worldWrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  const push = () => { if (line) lines.push(line); line = ''; };

  text.split(' ').forEach(word => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width <= maxWidth) { line = test; return; }
    push();
    // a single very long word: break it by characters
    if (ctx.measureText(word).width > maxWidth) {
      for (const ch of word) {
        if (ctx.measureText(line + ch).width > maxWidth) push();
        line += ch;
      }
    } else {
      line = word;
    }
  });
  push();
  return lines.slice(0, maxLines);
}

function drawWorldBubble(ctx, u, now) {
  const remaining = u.bubble.until - now;
  if (remaining <= 0) { u.bubble = null; return; }

  ctx.font = '12px Arial';
  const lines = worldWrapText(ctx, u.bubble.text, 130, 4);
  const lineH = 15;
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16;
  const h = lines.length * lineH + 10;
  const bx = Math.min(WORLD_W - 4 - w, Math.max(4, u.dx - w / 2));
  const by = Math.max(4, u.dy - 26 - h);

  ctx.save();
  ctx.globalAlpha = Math.min(1, remaining / 500); // fade out in the last 0.5s
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  worldRoundRect(ctx, bx, by, w, h, 10);
  ctx.fill();
  ctx.stroke();

  // little tail pointing at the avatar
  ctx.beginPath();
  ctx.moveTo(u.dx - 5, by + h - 0.5);
  ctx.lineTo(u.dx + 5, by + h - 0.5);
  ctx.lineTo(u.dx, by + h + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 5 + lineH / 2 + i * lineH));
  ctx.restore();
}

function drawWorldEmote(ctx, u, now) {
  const age = now - u.emote.start;
  if (age > WORLD_EMOTE_MS) { u.emote = null; return; }

  const emoji = WORLD_EMOTES[u.emote.type];
  const side = u.dx > WORLD_W - 70 ? -28 : 28;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '24px serif';

  if (u.emote.type === 'heart') {
    // three hearts floating up one after another
    for (let i = 0; i < 3; i++) {
      const t = (age - i * 250) / 1800;
      if (t < 0 || t > 1) continue;
      ctx.globalAlpha = 1 - t * t;
      ctx.fillText(emoji, u.dx + (i - 1) * 14 + Math.sin(t * 6) * 4, u.dy - 30 - t * 40);
    }
  } else {
    const t = age / WORLD_EMOTE_MS;
    ctx.globalAlpha = 1 - t * t * t;
    const wiggle = u.emote.type === 'wave' ? Math.sin(now / 90) * 6 : 0;
    ctx.fillText(emoji, u.dx + side + wiggle, u.dy - 20 - t * 14);
  }
  ctx.restore();
}

// ---------- the town map ----------

const WORLD_EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';

const WORLD_BUILDINGS = [];
['#f4a6a6', '#a6c8f4', '#f4e0a6', '#b6e3b0', '#d9b6f0', '#f4c8a6'].forEach((color, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  WORLD_BUILDINGS.push({
    x: 1400 + col * 280, y: row ? 1340 : 1060, w: 200, h: 140, color,
    roof: 'tri', roofH: 70, roofColor: ['#a8453a', '#3a5ca8', '#8a6d2f'][col], label: 'Home ' + (i + 1)
  });
});
WORLD_BUILDINGS.push(
  { x: 1500, y: 220, w: 320, h: 180, color: '#e8c9a0', roof: 'flat', roofH: 0, roofColor: '#c0392b', sign: '☕', label: 'Café' },
  { x: 1880, y: 250, w: 200, h: 150, color: '#f2b8a0', roof: 'flat', roofH: 0, roofColor: '#27ae60', sign: '🍕', label: 'Pizza' },
  { x: 2130, y: 270, w: 170, h: 130, color: '#b8c8f2', roof: 'flat', roofH: 0, roofColor: '#2980b9', sign: '🛍️', label: 'Shop' },
  { x: 760,  y: 1040, w: 180, h: 120, color: '#ffd9a0', roof: 'flat', roofH: 0, roofColor: '#e67e22', sign: '🍹', label: 'Beach Bar' }
);

// things you can't walk through: buildings, the pond, the sea
const WORLD_SOLIDS = WORLD_BUILDINGS.map(b => ({ x: b.x, y: b.y - b.roofH, w: b.w, h: b.h + b.roofH }));
WORLD_SOLIDS.push({ x: 395, y: 275, w: 210, h: 110 }, { x: 0, y: 1345, w: 1140, h: 255 });

// cars you can hop into (tap one while standing close)
const WORLD_PARKED_CARS = [
  { e: '🚗', x: 1500, y: 1235 }, { e: '🚙', x: 1780, y: 1235 }, { e: '🚕', x: 2060, y: 1235 },
  { e: '🚓', x: 1480, y: 716 },  { e: '🏎️', x: 1900, y: 716 },  { e: '🚌', x: 760, y: 716 }
];

// cars driving around the roads for everyone to see (position comes from the clock, so it matches)
const WORLD_TRAFFIC = [
  { e: '🚕', lane: 'E', off: 0,    sp: 150 }, { e: '🚙', lane: 'E', off: 1100, sp: 125 },
  { e: '🚌', lane: 'W', off: 300,  sp: 110 }, { e: '🚗', lane: 'W', off: 1500, sp: 150 },
  { e: '🚓', lane: 'S', off: 200,  sp: 140 }, { e: '🏎️', lane: 'N', off: 700,  sp: 175 }
];

const WORLD_DECOR = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [];
  const put = (e, x0, y0, x1, y1, n, s, avoid) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      if (avoid && avoid(x, y)) continue;
      out.push({ e, x, y, s });
    }
  };
  const inPond = (x, y) => x > 350 && x < 650 && y > 230 && y < 430;
  const nearBar = (x, y) => x > 730 && x < 970 && y > 960 && y < 1190;

  put('🌳', 100, 100, 1000, 660, 26, 56, inPond);
  put('🌲', 100, 100, 1000, 660, 12, 56, inPond);
  put('🌷', 100, 100, 1000, 660, 26, 26, inPond);
  put('🌼', 100, 100, 1000, 660, 18, 24, inPond);
  put('🌴', 100, 990, 1020, 1300, 14, 64, nearBar);
  put('⛱️', 120, 1000, 1000, 1300, 6, 52, nearBar);
  put('🐚', 100, 1000, 1020, 1320, 10, 24, nearBar);
  put('🌳', 2210, 970, 2330, 1530, 6, 56);
  put('🌳', 1345, 970, 1385, 1530, 4, 56);
  put('🌷', 1350, 1210, 2330, 1260, 14, 24);
  [['🪴', 1070, 710], ['🪴', 1330, 710], ['🪴', 1070, 930], ['🪴', 1330, 930],
   ['🪑', 380, 450], ['🪑', 620, 450], ['🪑', 500, 200]].forEach(([e, x, y]) => out.push({ e, x, y, s: 36 }));
  return out;
})();

function worldBlocked(x, y) {
  for (const r of WORLD_SOLIDS) {
    if (x > r.x - 12 && x < r.x + r.w + 12 && y > r.y - 8 && y < r.y + r.h + 14) return true;
  }
  return false;
}

function worldTrafficPos(c, t) {
  const span = (c.lane === 'E' || c.lane === 'W' ? WORLD_W : WORLD_H) + 240;
  const d = (t * c.sp + c.off) % span;
  if (c.lane === 'E') return { x: d - 120, y: 795, flip: true, rot: 0 };
  if (c.lane === 'W') return { x: WORLD_W + 120 - d, y: 845, flip: false, rot: 0 };
  if (c.lane === 'S') return { x: 1170, y: d - 120, flip: false, rot: -Math.PI / 2 };
  return { x: 1230, y: WORLD_H + 120 - d, flip: false, rot: Math.PI / 2 };
}

function drawWorldCarEmoji(ctx, e, x, y, size, flip, rot) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.font = size + 'px ' + WORLD_EMOJI_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e, 0, 0);
  ctx.restore();
}

function drawWorldGround(ctx, t) {
  ctx.fillStyle = '#8fd18a'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);          // grass
  ctx.fillStyle = '#a3e29a'; ctx.fillRect(60, 60, 980, 620);                // park
  ctx.fillStyle = '#e9d9bf'; ctx.fillRect(1340, 60, 1000, 620);             // café street
  ctx.fillStyle = '#a6e29a'; ctx.fillRect(1340, 960, 1000, 580);            // neighbourhood
  ctx.fillStyle = '#f3e2b3'; ctx.fillRect(60, 960, 980, 385);               // beach sand
  ctx.fillStyle = '#d9d4c7'; ctx.fillRect(1040, 680, 320, 280);             // plaza

  // sea with moving waves
  ctx.fillStyle = '#3fa9dc'; ctx.fillRect(0, 1340, 1140, 260);
  ctx.lineWidth = 4;
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = k === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    for (let x = 0; x <= 1140; x += 30) {
      const y = 1340 + k * 60 + Math.sin(t * 2 + x / 40 + k) * 5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // pond
  ctx.fillStyle = '#7ec8ef';
  ctx.beginPath(); ctx.ellipse(500, 330, 125, 72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#58b9ea';
  ctx.beginPath(); ctx.ellipse(500, 330, 108, 58, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  const rip = (t % 3) / 3;
  ctx.beginPath(); ctx.ellipse(470, 320, 10 + rip * 40, 5 + rip * 20, 0, 0, Math.PI * 2); ctx.stroke();

  // roads
  ctx.fillStyle = '#4a4a55';
  ctx.fillRect(0, 760, WORLD_W, 120);
  ctx.fillRect(1140, 0, 120, WORLD_H);
  ctx.fillStyle = '#4a4a55'; ctx.fillRect(1140, 760, 120, 120);
  ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 4; ctx.setLineDash([30, 26]);
  ctx.beginPath();
  ctx.moveTo(0, 820); ctx.lineTo(1140, 820); ctx.moveTo(1260, 820); ctx.lineTo(WORLD_W, 820);
  ctx.moveTo(1200, 0); ctx.lineTo(1200, 760); ctx.moveTo(1200, 880); ctx.lineTo(1200, WORLD_H);
  ctx.stroke();
  ctx.setLineDash([]);

  // zone names painted on the ground
  ctx.font = 'bold 54px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.fillText('🌳 Park', 550, 125);
  ctx.fillText('☕ Café Street', 1840, 130);
  ctx.fillText('🏖️ Beach', 420, 1010);
  ctx.fillText('🏠 Neighbourhood', 1840, 1515);
}

function drawWorldBuilding(ctx, b) {
  const { x, y, w, h } = b;
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 6, y + h - 4, w, 10);
  ctx.fillStyle = b.color; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);

  if (b.roof === 'tri') {
    ctx.fillStyle = b.roofColor;
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + w / 2, y - b.roofH); ctx.lineTo(x + w + 12, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else {
    for (let i = 0; i * 20 < w; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : b.roofColor;
      ctx.fillRect(x + i * 20, y, Math.min(20, w - i * 20), 26);
    }
  }

  const wy = y + (b.roof === 'tri' ? 24 : 46);
  ctx.fillStyle = 'rgba(180,225,255,0.95)';
  ctx.fillRect(x + 16, wy, 38, 34); ctx.fillRect(x + w - 54, wy, 38, 34);
  ctx.strokeRect(x + 16, wy, 38, 34); ctx.strokeRect(x + w - 54, wy, 38, 34);

  ctx.fillStyle = '#6b4226'; ctx.fillRect(x + w / 2 - 16, y + h - 52, 32, 52);
  ctx.fillStyle = '#ffd24d'; ctx.beginPath(); ctx.arc(x + w / 2 + 9, y + h - 26, 3, 0, Math.PI * 2); ctx.fill();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (b.sign) { ctx.font = '40px ' + WORLD_EMOJI_FONT; ctx.fillText(b.sign, x + w / 2, y + 70); }

  ctx.font = 'bold 15px Arial';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.fillStyle = 'white';
  ctx.strokeText(b.label, x + w / 2, y - b.roofH - 12);
  ctx.fillText(b.label, x + w / 2, y - b.roofH - 12);
}

function drawWorldAvatar(ctx, u, now) {
  const isMe = u.userId === currentUser.id;
  const dancing = u.emote && u.emote.type === 'dance';

  let bob = 0, tilt = 0;
  if (dancing) {
    bob = -Math.abs(Math.sin(now / 120)) * 8;
    tilt = Math.sin(now / 90) * 0.35;
  } else if (u.moving) {
    bob = -Math.abs(Math.sin(u.phase)) * 4;
    tilt = Math.sin(u.phase) * 0.15;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(u.dx, u.dy + 19, (u.vehicle ? 26 : 15) + bob * 0.4, 5 + bob * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  if (u.vehicle) {
    drawWorldCarEmoji(ctx, u.vehicle, u.dx, u.dy + 8, 60, (u.face || -1) > 0, 0);
  }

  ctx.save();
  ctx.translate(u.dx, u.dy + bob - (u.vehicle ? 22 : 0));
  ctx.rotate(u.vehicle ? 0 : tilt);
  if (u.vehicle) ctx.scale(0.7, 0.7);

  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fillStyle = isMe ? '#ff4d8d' : '#4d7cff';
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.stroke();

  const img = u.profilePicture ? getWorldImage(u.profilePicture) : null;
  if (img) {
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, -15, -15, 30, 30);
  }
  ctx.restore();

  ctx.fillStyle = '#222';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.strokeText(u.name, u.dx, u.dy + (u.vehicle ? 46 : 36));
  ctx.fillText(u.name, u.dx, u.dy + (u.vehicle ? 46 : 36));
}

function drawWorldMinimap(ctx) {
  ctx.setTransform(worldDpr, 0, 0, worldDpr, 0, 0);
  const mw = 120, mh = Math.round(120 * WORLD_H / WORLD_W), mx = 10, my = worldMiniY;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;

  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = '#8fd18a'; ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#3fa9dc'; ctx.fillRect(mx, my + 1340 * sy, 1140 * sx, 260 * sy);
  ctx.fillStyle = '#4a4a55';
  ctx.fillRect(mx, my + 760 * sy, mw, 120 * sy);
  ctx.fillRect(mx + 1140 * sx, my, 120 * sx, mh);
  ctx.fillStyle = '#c0785a';
  WORLD_BUILDINGS.forEach(b => ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy)));
  ctx.restore();

  Object.values(worldUsers).forEach(u => {
    const isMe = u.userId === currentUser.id;
    ctx.fillStyle = isMe ? '#ff1f6b' : '#2f5dff';
    ctx.beginPath();
    ctx.arc(mx + u.dx * sx, my + u.dy * sy, isMe ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  });

  worldActivePortals().forEach(p => {
    ctx.fillStyle = worldUsedPortals.has(p.id) ? '#888' : '#c05cff';
    ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, mw, mh);
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + worldCamX * sx, my + worldCamY * sy, Math.min(mw, worldViewW * sx), Math.min(mh, worldViewH * sy));
}

function drawWorld() {
  if (!worldCtx || !worldCssW) return;
  const ctx = worldCtx;
  const now = performance.now();
  const t = Date.now() / 1000;
  const users = Object.values(worldUsers);

  updateWorldMovement(now);
  worldPortalTick();

  // animation state: glide towards the real position, detect walking, record trail
  users.forEach(u => {
    if (u.dx === undefined) { u.dx = u.x; u.dy = u.y; }
    if (!u.trail) u.trail = [];
    if (Math.abs(u.x - u.dx) > 0.5) u.face = u.x > u.dx ? 1 : -1;
    u.dx += (u.x - u.dx) * 0.35;
    u.dy += (u.y - u.dy) * 0.35;
    u.moving = Math.hypot(u.x - u.dx, u.y - u.dy) > 0.6;

    if (u.moving) {
      u.phase = (u.phase || 0) + 0.4;
      const last = u.trail[u.trail.length - 1];
      if (!last || Math.hypot(last.x - u.dx, last.y - u.dy) > 7) {
        u.trail.push({ x: u.dx, y: u.dy, t: now });
      }
    }
    while (u.trail.length && now - u.trail[0].t > WORLD_TRAIL_MS) u.trail.shift();
  });

  // the camera follows me
  const me = worldUsers[currentUser.id];
  if (me) {
    const tx = Math.min(Math.max(0, me.dx - worldViewW / 2), Math.max(0, WORLD_W - worldViewW));
    const ty = Math.min(Math.max(0, me.dy - worldViewH / 2), Math.max(0, WORLD_H - worldViewH));
    if (worldCamSnap) { worldCamX = tx; worldCamY = ty; worldCamSnap = false; }
    else { worldCamX += (tx - worldCamX) * 0.18; worldCamY += (ty - worldCamY) * 0.18; }
  }

  ctx.setTransform(worldDpr, 0, 0, worldDpr, 0, 0);
  ctx.fillStyle = '#2d6a3e';
  ctx.fillRect(0, 0, worldCssW, worldCssH);
  ctx.setTransform(worldScale, 0, 0, worldScale, -worldCamX * worldScale, -worldCamY * worldScale);

  const vx0 = worldCamX - 140, vy0 = worldCamY - 160, vx1 = worldCamX + worldViewW + 140, vy1 = worldCamY + worldViewH + 140;
  const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

  drawWorldGround(ctx, t);

  // fading trail
  users.forEach(u => {
    const isMe = u.userId === currentUser.id;
    u.trail.forEach(p => {
      const life = 1 - (now - p.t) / WORLD_TRAIL_MS;
      ctx.globalAlpha = Math.max(0, life) * 0.35;
      ctx.fillStyle = isMe ? '#ff4d8d' : '#4d7cff';
      ctx.beginPath();
      ctx.arc(p.x, p.y + 12, 8 * life + 2, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  ctx.globalAlpha = 1;

  // everything that stands on the ground, drawn back-to-front
  const items = [];
  WORLD_DECOR.forEach(d => {
    if (!inView(d.x, d.y)) return;
    items.push({ y: d.y + d.s * 0.4, draw: () => {
      ctx.font = d.s + 'px ' + WORLD_EMOJI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.e, d.x, d.y);
    } });
  });
  WORLD_BUILDINGS.forEach(b => {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y - b.roofH > vy1 || b.y + b.h < vy0) return;
    items.push({ y: b.y + b.h, draw: () => drawWorldBuilding(ctx, b) });
  });
  WORLD_PARKED_CARS.forEach(c => {
    if (!inView(c.x, c.y)) return;
    items.push({ y: c.y, draw: () => drawWorldCarEmoji(ctx, c.e, c.x, c.y, 52, false, 0) });
  });
  WORLD_TRAFFIC.forEach(c => {
    const p = worldTrafficPos(c, t);
    if (!inView(p.x, p.y)) return;
    items.push({ y: p.y, draw: () => drawWorldCarEmoji(ctx, c.e, p.x, p.y, 48, p.flip, p.rot) });
  });
  worldActivePortals().forEach(p => {
    if (!inView(p.x, p.y)) return;
    items.push({ y: p.y + 30, draw: () => drawWorldPortal(ctx, p, t, worldUsedPortals.has(p.id)) });
  });
  users.forEach(u => items.push({ y: u.dy + 19, draw: () => drawWorldAvatar(ctx, u, now) }));

  items.sort((a, b) => a.y - b.y).forEach(it => it.draw());

  // bubbles and emotes on top of everybody
  users.forEach(u => {
    if (u.bubble) drawWorldBubble(ctx, u, now);
    if (u.emote) drawWorldEmote(ctx, u, now);
  });

  drawWorldMinimap(ctx);
}

// ==================== PORTALS & THE DEMON DIMENSION ====================
// Portals open in the town (everyone sees the same ones, because they come from the clock).
// Walk into one to fight demons: 5 levels, 3 lives, knife and arrows only.

const PORTAL_SLOT_MS = 120000;   // a new pair of portals every 2 minutes
const PORTAL_SPOTS = [
  { x: 300, y: 520 },  { x: 780, y: 560 },  { x: 1560, y: 540 }, { x: 2200, y: 520 },
  { x: 500, y: 1120 }, { x: 900, y: 1250 }, { x: 1700, y: 930 }, { x: 2200, y: 1240 }
];
const worldUsedPortals = new Set();   // portals that already sealed behind me
let worldLastPortalSlot = null;
let worldPortalPromptId = null;

function worldActivePortals(now) {
  now = now || Date.now();
  const slot = Math.floor(now / PORTAL_SLOT_MS);
  const n = PORTAL_SPOTS.length;
  const a = (Math.imul(slot, 2654435761) >>> 0) % n;
  const b = (a + 1 + ((Math.imul(slot + 7, 40503) >>> 0) % (n - 1))) % n;
  return [a, b].map((idx, k) => ({
    id: slot + '-' + k, x: PORTAL_SPOTS[idx].x, y: PORTAL_SPOTS[idx].y, endsAt: (slot + 1) * PORTAL_SLOT_MS
  }));
}

function worldPortalTick() {
  const slot = Math.floor(Date.now() / PORTAL_SLOT_MS);
  if (worldLastPortalSlot !== null && slot !== worldLastPortalSlot) showMessage('🌀 New portals opened in the town!');
  worldLastPortalSlot = slot;

  const me = worldUsers[currentUser.id];
  const prompt = document.getElementById('world-portal-prompt');
  if (!me || !prompt || dimActive) return;

  const near = worldActivePortals().find(p => Math.hypot(p.x - me.x, p.y - me.y) < 75 && !worldUsedPortals.has(p.id));
  if (!near) {
    if (worldPortalPromptId) { worldPortalPromptId = null; prompt.style.display = 'none'; }
    return;
  }
  if (worldPortalPromptId === near.id) return;
  worldPortalPromptId = near.id;
  prompt.textContent = '';
  const label = document.createElement('span');
  label.textContent = '🌀 Demon portal · 5 levels · 3 lives';
  const btn = document.createElement('button');
  btn.textContent = 'Enter';
  btn.style.cssText = 'width:auto; padding:6px 14px; margin:0 0 0 10px; display:inline-block;';
  btn.onclick = () => enterPortal(near.id);
  prompt.append(label, btn);
  prompt.style.display = 'block';
}

function drawWorldPortal(ctx, p, t, used) {
  const left = Math.max(0, p.endsAt - Date.now());
  const pulse = 1 + Math.sin(t * 4) * 0.05;
  ctx.save();
  ctx.translate(p.x, p.y);

  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 100 * pulse);
  g.addColorStop(0, used ? 'rgba(120,120,120,0.35)' : 'rgba(170,80,255,0.6)');
  g.addColorStop(1, 'rgba(170,80,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 100 * pulse, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = used ? '#2a2a2a' : '#12052a';
  ctx.beginPath(); ctx.ellipse(0, 0, 34 * pulse, 52 * pulse, 0, 0, Math.PI * 2); ctx.fill();

  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = used ? '#888' : (k % 2 ? '#6df2ff' : '#d27bff');
    ctx.lineWidth = 4 - k;
    const a0 = t * (2 + k) + k * 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, (36 - k * 9) * pulse, (54 - k * 13) * pulse, 0, a0, a0 + Math.PI * 1.4);
    ctx.stroke();
  }
  ctx.restore();

  const s = Math.ceil(left / 1000);
  const text = used ? '🔒 Sealed' : '🌀 Portal ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.fillStyle = 'white';
  ctx.strokeText(text, p.x, p.y - 74);
  ctx.fillText(text, p.x, p.y - 74);
}

function enterPortal(id) {
  if (!worldActivePortals().some(p => p.id === id) || worldUsedPortals.has(id)) {
    showMessage('The portal closed');
    return;
  }
  dimPortalId = id;
  worldPortalPromptId = null;
  const prompt = document.getElementById('world-portal-prompt');
  if (prompt) prompt.style.display = 'none';
  leaveWorld();       // our avatar disappears from the town while we fight
  startDimension();
}

// ---------- the dimension ----------

const DIM_W = 600, DIM_H = 800, DIM_MAX_ARROWS = 12;

const DIM_LEVELS = [
  { name: 'The Gate',       imp: 6,  ogre: 0, fiend: 0, skull: 0, boss: 0 },
  { name: 'Ashen Fields',   imp: 8,  ogre: 2, fiend: 0, skull: 0, boss: 0 },
  { name: 'Cinder Halls',   imp: 8,  ogre: 3, fiend: 3, skull: 0, boss: 0 },
  { name: 'The Bone Pit',   imp: 8,  ogre: 3, fiend: 3, skull: 3, boss: 0 },
  { name: 'The Demon Lord', imp: 5,  ogre: 2, fiend: 3, skull: 3, boss: 1 }
];
const DIM_TYPES = {
  imp:   { e: '😈', hp: 2,  sp: 62,  r: 15, size: 34,  shoot: 0 },
  ogre:  { e: '👹', hp: 6,  sp: 42,  r: 22, size: 46,  shoot: 0 },
  fiend: { e: '👺', hp: 3,  sp: 70,  r: 16, size: 36,  shoot: 2.8 },
  skull: { e: '💀', hp: 2,  sp: 105, r: 14, size: 32,  shoot: 0 },
  boss:  { e: '👿', hp: 36, sp: 48,  r: 46, size: 104, shoot: 2.2 }
};

let dimActive = false, dimRaf = null, dimCtx = null, dimPortalId = null, dim = null;
let dimScale = 1, dimOffX = 0, dimOffY = 0, dimDpr = 1, dimCssW = 0, dimCssH = 0, dimLast = 0;

const DIM_CRACKS = (() => {
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < 9; i++) {
    let x = rnd() * DIM_W, y = rnd() * DIM_H;
    const pts = [[x, y]];
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 120; y += (rnd() - 0.5) * 120; pts.push([x, y]); }
    out.push(pts);
  }
  return out;
})();

const dimRnd = (a, b) => a + Math.random() * (b - a);
const dimClamp = p => ({ x: Math.min(DIM_W - 20, Math.max(20, p.x)), y: Math.min(DIM_H - 20, Math.max(20, p.y)) });

function fitDimCanvas() {
  const screen = document.getElementById('portal-screen');
  const canvas = document.getElementById('dim-canvas');
  const w = screen.clientWidth, h = screen.clientHeight;
  if (!(w > 0 && h > 0)) return;
  dimDpr = window.devicePixelRatio || 1;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dimDpr); canvas.height = Math.floor(h * dimDpr);
  dimCssW = w; dimCssH = h;
  const topH = 64, botH = 96;
  dimScale = Math.max(0.3, Math.min(w / DIM_W, (h - topH - botH) / DIM_H));
  dimOffX = (w - DIM_W * dimScale) / 2;
  dimOffY = topH + (h - topH - botH - DIM_H * dimScale) / 2;
}
window.addEventListener('resize', () => { if (dimActive) fitDimCanvas(); });

function setupDimPointer() {
  const c = document.getElementById('dim-canvas');
  if (c._bound) return;
  c._bound = true;
  const pt = e => {
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left - dimOffX) / dimScale, y: (e.clientY - r.top - dimOffY) / dimScale };
  };
  let down = false;
  c.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!dim || dim.state === 'over') return;
    const p = pt(e);
    // tap a demon: close = knife, far = arrow
    const m = dim.mons.find(mo => Math.hypot(mo.x - p.x, mo.y - p.y) < mo.r + 14);
    if (m) {
      if (Math.hypot(m.x - dim.px, m.y - dim.py) < 100 + m.r) dimKnife(m); else dimBow(m);
      return;
    }
    down = true;
    if (c.setPointerCapture) c.setPointerCapture(e.pointerId);
    dim.target = dimClamp(p);
  });
  c.addEventListener('pointermove', e => { if (down && dim) dim.target = dimClamp(pt(e)); });
  const up = () => { down = false; };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
}

function startDimension() {
  hideAllScreens();
  document.getElementById('portal-screen').style.display = 'block';
  document.getElementById('dim-end').style.display = 'none';
  dimCtx = document.getElementById('dim-canvas').getContext('2d');
  dimActive = true;
  fitDimCanvas();
  setupDimPointer();

  dim = {
    level: 0, lives: 3, arrows: 10, px: DIM_W / 2, py: DIM_H * 0.78, target: null, face: { x: 0, y: -1 },
    knifeCd: 0, bowCd: 0, arrowRegen: 0, invuln: 0, hitFlash: 0,
    mons: [], queue: [], shots: [], fireballs: [], drops: [], fx: [], slash: null,
    spawnT: 0, state: 'intro', stateT: 0, banner: '', t: 0
  };
  beginDimLevel(0);
  dimLast = performance.now();
  dimRaf = requestAnimationFrame(dimTick);
}

function beginDimLevel(i) {
  const L = DIM_LEVELS[i], d = dim;
  d.level = i;
  d.mons = []; d.shots = []; d.fireballs = []; d.drops = [];
  d.arrows = Math.max(d.arrows, 10);
  d.queue = [];
  ['imp', 'ogre', 'fiend', 'skull', 'boss'].forEach(k => { for (let n = 0; n < L[k]; n++) d.queue.push(k); });
  d.queue.sort(() => Math.random() - 0.5);
  const bi = d.queue.indexOf('boss');
  if (bi > 0) { d.queue.splice(bi, 1); d.queue.unshift('boss'); }
  d.state = 'intro'; d.stateT = 2.2;
  d.banner = 'Level ' + (i + 1) + ' · ' + L.name;
  d.spawnT = 0;
  updateDimHud();
}

function updateDimHud() {
  const d = dim;
  if (!d) return;
  document.getElementById('dim-hearts').textContent = '❤️'.repeat(Math.max(0, d.lives)) + '🖤'.repeat(Math.max(0, 3 - d.lives));
  document.getElementById('dim-level').textContent = 'Level ' + (d.level + 1) + ' / 5';
  document.getElementById('dim-arrows').textContent = d.arrows;
  document.getElementById('dim-bow').style.opacity = d.arrows > 0 ? '1' : '0.45';
}

function dimNearest() {
  let best = null, bd = Infinity;
  dim.mons.forEach(m => {
    const dd = Math.hypot(m.x - dim.px, m.y - dim.py);
    if (dd < bd) { bd = dd; best = m; }
  });
  return best;
}

function dimAimAt(m) {
  if (m) {
    const dx = m.x - dim.px, dy = m.y - dim.py, l = Math.hypot(dx, dy) || 1;
    dim.face = { x: dx / l, y: dy / l };
  }
  return dim.face;
}

function dimKnife(target) {
  const d = dim;
  if (!dimActive || !d || d.state === 'over' || d.knifeCd > 0) return;
  const f = dimAimAt(target || dimNearest());
  const RANGE = 84;
  d.knifeCd = 0.38;
  d.slash = { ang: Math.atan2(f.y, f.x), t: 0.18 };
  d.mons.slice().forEach(mo => {
    const dx = mo.x - d.px, dy = mo.y - d.py, dist = Math.hypot(dx, dy);
    if (dist > RANGE + mo.r) return;
    const dot = (dx * f.x + dy * f.y) / (dist || 1);
    if (dot < 0.2 && dist > mo.r + 22) return;           // outside the swing
    hitMonster(mo, 2, f.x, f.y, 260);
  });
  // a knife can slice fireballs out of the air
  d.fireballs = d.fireballs.filter(fb => !(Math.hypot(fb.x - d.px, fb.y - d.py) < RANGE && ((fb.x - d.px) * f.x + (fb.y - d.py) * f.y) > 0));
}

function dimBow(target) {
  const d = dim;
  if (!dimActive || !d || d.state === 'over' || d.bowCd > 0 || d.arrows <= 0) return;
  const f = dimAimAt(target || dimNearest());
  d.arrows--;
  d.bowCd = 0.5;
  d.shots.push({ x: d.px + f.x * 16, y: d.py + f.y * 16, vx: f.x * 560, vy: f.y * 560, life: 1.1 });
  updateDimHud();
}

function dimBurst(x, y, n, colors, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = dimRnd(speed * 0.3, speed);
    dim.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: dimRnd(0.25, 0.6), col: colors[i % colors.length] });
  }
}

function hitMonster(m, dmg, kx, ky, force) {
  m.hp -= dmg;
  m.flash = 0.12;
  const f = m.type === 'boss' ? force * 0.15 : force;
  m.kx += kx * f; m.ky += ky * f;
  dimBurst(m.x, m.y, 4, ['#ffd23f', '#ff7a3d'], 160);
  if (m.hp <= 0) killMonster(m);
}

function killMonster(m) {
  dim.mons = dim.mons.filter(o => o !== m);
  dimBurst(m.x, m.y, m.type === 'boss' ? 60 : 14, ['#ff4d4d', '#ff9f3d', '#ffe066'], m.type === 'boss' ? 380 : 220);
  if (m.type !== 'boss' && Math.random() < 0.22) dim.drops.push({ x: m.x, y: m.y, life: 9 });
}

function spawnDimMonster(type, x, y) {
  const d = dim, T = DIM_TYPES[type];
  if (x === undefined) {
    for (let tries = 0; tries < 6; tries++) {
      const side = Math.floor(Math.random() * 4);
      x = side === 0 ? 24 : side === 1 ? DIM_W - 24 : dimRnd(30, DIM_W - 30);
      y = side === 2 ? 24 : side === 3 ? DIM_H - 24 : dimRnd(30, DIM_H - 30);
      if (Math.hypot(x - d.px, y - d.py) > 230) break;
    }
  }
  d.mons.push({
    type, x, y, hp: T.hp, maxHp: T.hp, r: T.r,
    sp: T.sp * (1 + 0.09 * d.level) * dimRnd(0.9, 1.1),
    shootT: T.shoot ? dimRnd(1, 1 + T.shoot) : 0, summonT: 7, flash: 0, kx: 0, ky: 0
  });
}

function dimFire(m, angleOffset) {
  const d = dim;
  const a = Math.atan2(d.py - m.y, d.px - m.x) + (angleOffset || 0);
  const sp = 150 + 12 * d.level;
  d.fireballs.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 5 });
}

function hurtDimPlayer(sx, sy) {
  const d = dim;
  if (d.invuln > 0 || d.state === 'over') return;
  d.lives--;
  d.invuln = 1.6;
  d.hitFlash = 0.3;
  const dx = d.px - sx, dy = d.py - sy, l = Math.hypot(dx, dy) || 1;
  const p = dimClamp({ x: d.px + dx / l * 55, y: d.py + dy / l * 55 });
  d.px = p.x; d.py = p.y;
  dimBurst(d.px, d.py, 12, ['#ff4d6d', '#ffffff'], 200);
  updateDimHud();
  if (d.lives <= 0) endDimension('lose');
}

function movePlayer(dt) {
  const d = dim;
  if (!d.target) return;
  const dx = d.target.x - d.px, dy = d.target.y - d.py, dist = Math.hypot(dx, dy);
  const step = 270 * dt;
  if (dist <= step) { d.px = d.target.x; d.py = d.target.y; d.target = null; return; }
  d.px += dx / dist * step; d.py += dy / dist * step;
  d.face = { x: dx / dist, y: dy / dist };
}

function updateDim(dt) {
  const d = dim;
  d.t += dt;
  d.fx.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; });
  d.fx = d.fx.filter(f => f.life > 0);
  if (d.slash) { d.slash.t -= dt; if (d.slash.t <= 0) d.slash = null; }
  if (d.state === 'over') return;

  movePlayer(dt);
  d.knifeCd = Math.max(0, d.knifeCd - dt);
  d.bowCd = Math.max(0, d.bowCd - dt);
  d.invuln = Math.max(0, d.invuln - dt);
  d.hitFlash = Math.max(0, d.hitFlash - dt);

  if (d.state === 'intro') { d.stateT -= dt; if (d.stateT <= 0) d.state = 'fight'; return; }
  if (d.state === 'cleared') {
    d.stateT -= dt;
    if (d.stateT <= 0) {
      if (d.level + 1 >= DIM_LEVELS.length) endDimension('win'); else beginDimLevel(d.level + 1);
    }
    return;
  }

  // arrows slowly come back
  if (d.arrows < DIM_MAX_ARROWS) {
    d.arrowRegen += dt;
    if (d.arrowRegen >= 1.0) { d.arrowRegen = 0; d.arrows++; updateDimHud(); }
  }

  // demons arrive one by one
  d.spawnT -= dt;
  if (d.queue.length && d.spawnT <= 0 && d.mons.length < 14) {
    spawnDimMonster(d.queue.shift());
    d.spawnT = Math.max(0.35, 1.1 - 0.17 * d.level);
  }

  d.mons.slice().forEach(m => {
    const dx = d.px - m.x, dy = d.py - m.y, dist = Math.hypot(dx, dy) || 1;
    m.x += (dx / dist * m.sp + m.kx) * dt;
    m.y += (dy / dist * m.sp + m.ky) * dt;
    const decay = Math.min(1, 8 * dt);
    m.kx -= m.kx * decay; m.ky -= m.ky * decay;
    m.flash = Math.max(0, m.flash - dt);
    m.x = Math.min(DIM_W - 10, Math.max(10, m.x));
    m.y = Math.min(DIM_H - 10, Math.max(10, m.y));

    d.mons.forEach(o => {                       // don't stack on top of each other
      if (o === m) return;
      const ox = m.x - o.x, oy = m.y - o.y, od = Math.hypot(ox, oy) || 1, min = (m.r + o.r) * 0.8;
      if (od < min) { m.x += ox / od * (min - od) * 0.5; m.y += oy / od * (min - od) * 0.5; }
    });

    const T = DIM_TYPES[m.type];
    if (T.shoot) {
      m.shootT -= dt;
      if (m.shootT <= 0) {
        if (m.type === 'boss') { dimFire(m, -0.3); dimFire(m, 0); dimFire(m, 0.3); } else dimFire(m, 0);
        m.shootT = Math.max(1.1, T.shoot - 0.12 * d.level) + Math.random() * 0.5;
      }
    }
    if (m.type === 'boss') {
      m.summonT -= dt;
      if (m.summonT <= 0 && d.mons.length < 12) { spawnDimMonster('imp', m.x, m.y); spawnDimMonster('imp', m.x + 20, m.y); m.summonT = 8; }
    }
    if (dist < m.r + 14) hurtDimPlayer(m.x, m.y);
  });

  d.shots.forEach(s => {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    const hit = d.mons.find(m => Math.hypot(m.x - s.x, m.y - s.y) < m.r + 4);
    if (hit) { s.life = 0; hitMonster(hit, 1, s.vx / 560, s.vy / 560, 60); }
    if (s.x < 0 || s.x > DIM_W || s.y < 0 || s.y > DIM_H) s.life = 0;
  });
  d.shots = d.shots.filter(s => s.life > 0);

  d.fireballs.forEach(fb => {
    fb.x += fb.vx * dt; fb.y += fb.vy * dt; fb.life -= dt;
    if (Math.hypot(fb.x - d.px, fb.y - d.py) < 20) { fb.life = 0; hurtDimPlayer(fb.x - fb.vx, fb.y - fb.vy); }
    if (fb.x < -20 || fb.x > DIM_W + 20 || fb.y < -20 || fb.y > DIM_H + 20) fb.life = 0;
  });
  d.fireballs = d.fireballs.filter(fb => fb.life > 0);

  d.drops.forEach(p => {                        // dropped arrows
    p.life -= dt;
    if (Math.hypot(p.x - d.px, p.y - d.py) < 26) { p.life = 0; d.arrows = Math.min(DIM_MAX_ARROWS, d.arrows + 3); updateDimHud(); }
  });
  d.drops = d.drops.filter(p => p.life > 0);

  if (d.state === 'fight' && !d.queue.length && !d.mons.length) {
    d.state = 'cleared';
    d.stateT = 2.4;
    d.banner = 'Level ' + (d.level + 1) + ' cleared!';
    if ((d.level === 1 || d.level === 3) && d.lives < 3) { d.lives++; d.banner += '  +1 ❤️'; updateDimHud(); }
  }
}

function endDimension(result) {
  dim.state = 'over';
  const win = result === 'win';
  document.getElementById('dim-end-title').textContent = win ? '🏆 Dimension cleared!' : '💀 You were defeated';
  document.getElementById('dim-end-text').textContent = win
    ? 'You beat all 5 levels and the Demon Lord is gone!'
    : 'The portal sealed behind you. Go back to the town and find another portal to try again.';
  document.getElementById('dim-end').style.display = 'flex';
}

// leaves the dimension (after winning, losing, or running away) and goes back to the town
function exitDimension() {
  dimActive = false;
  if (dimRaf) cancelAnimationFrame(dimRaf);
  dimRaf = null;
  if (dimPortalId) worldUsedPortals.add(dimPortalId);   // that portal is sealed now
  document.getElementById('dim-end').style.display = 'none';
  document.getElementById('portal-screen').style.display = 'none';
  openWorld();
}

function dimTick(now) {
  if (!dimActive) return;
  const dt = Math.min(0.05, (now - dimLast) / 1000);
  dimLast = now;
  updateDim(dt);
  drawDim();
  dimRaf = requestAnimationFrame(dimTick);
}

function drawDim() {
  const ctx = dimCtx, d = dim;
  if (!ctx || !d || !dimCssW) return;
  ctx.setTransform(dimDpr, 0, 0, dimDpr, 0, 0);
  ctx.fillStyle = '#0d0618';
  ctx.fillRect(0, 0, dimCssW, dimCssH);
  ctx.setTransform(dimScale * dimDpr, 0, 0, dimScale * dimDpr, dimOffX * dimDpr, dimOffY * dimDpr);
  const t = d.t;

  // floor
  const g = ctx.createRadialGradient(DIM_W / 2, DIM_H / 2, 60, DIM_W / 2, DIM_H / 2, 540);
  g.addColorStop(0, '#4a1238'); g.addColorStop(1, '#14061c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DIM_W, DIM_H);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,120,40,' + (0.45 + Math.sin(t * 2) * 0.15).toFixed(2) + ')';
  DIM_CRACKS.forEach(pts => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); });
  ctx.fillStyle = 'rgba(255,170,80,0.55)';
  for (let i = 0; i < 26; i++) {                // floating embers
    const x = (i * 83 + Math.sin(t + i) * 20) % DIM_W, y = DIM_H - ((t * 30 + i * 61) % DIM_H);
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.lineWidth = 6; ctx.strokeStyle = '#ff5a1f';
  ctx.strokeRect(3, 3, DIM_W - 6, DIM_H - 6);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  d.drops.forEach(p => { ctx.font = '26px ' + WORLD_EMOJI_FONT; ctx.fillText('🏹', p.x, p.y + Math.sin(t * 6) * 3); });

  // demons, back to front
  d.mons.slice().sort((a, b) => a.y - b.y).forEach(m => {
    const T = DIM_TYPES[m.type];
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(m.x, m.y + m.r * 0.8, m.r, m.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (m.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = T.size + 'px ' + WORLD_EMOJI_FONT;
    ctx.fillText(T.e, m.x, m.y);
    if (m.hp < m.maxHp && m.type !== 'boss') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(m.x - m.r, m.y - m.r - 10, m.r * 2, 5);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(m.x - m.r, m.y - m.r - 10, m.r * 2 * (m.hp / m.maxHp), 5);
    }
    if (m.type === 'boss') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(60, 14, DIM_W - 120, 12);
      ctx.fillStyle = '#ff2d55'; ctx.fillRect(60, 14, (DIM_W - 120) * Math.max(0, m.hp / m.maxHp), 12);
    }
  });

  d.fireballs.forEach(fb => { ctx.font = '24px ' + WORLD_EMOJI_FONT; ctx.fillText('🔥', fb.x, fb.y); });

  // player
  const blink = d.invuln > 0 && Math.floor(t * 14) % 2 === 0;
  if (!blink) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(d.px, d.py + 16, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(d.px, d.py, 17, 0, Math.PI * 2);
    ctx.fillStyle = d.hitFlash > 0 ? '#ff4d4d' : '#ff4d8d'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();
    const img = currentUser.profilePicture ? getWorldImage(currentUser.profilePicture) : null;
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.arc(d.px, d.py, 14, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, d.px - 14, d.py - 14, 28, 28); ctx.restore();
    }
    ctx.font = '18px ' + WORLD_EMOJI_FONT;
    ctx.fillText('🗡️', d.px + d.face.x * 26, d.py + d.face.y * 26);
  }

  d.shots.forEach(s => {
    const a = Math.atan2(s.vy, s.vx);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
    ctx.strokeStyle = '#f4e4b0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(6, -5); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  });

  if (d.slash) {
    const k = d.slash.t / 0.18;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * k).toFixed(2) + ')';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(d.px, d.py, 56, d.slash.ang - 1.0, d.slash.ang + 1.0); ctx.stroke();
  }

  d.fx.forEach(f => { ctx.globalAlpha = Math.min(1, f.life * 3); ctx.fillStyle = f.col; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); });
  ctx.globalAlpha = 1;

  if (d.state === 'intro' || d.state === 'cleared') {
    ctx.save();
    ctx.globalAlpha = Math.min(1, d.stateT * 1.5);
    ctx.font = 'bold 34px Arial'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.fillStyle = '#ffe066';
    ctx.strokeText(d.banner, DIM_W / 2, DIM_H * 0.32);
    ctx.fillText(d.banner, DIM_W / 2, DIM_H * 0.32);
    ctx.restore();
  }
}

// ==================== CAMERA (photos, videos, AI environments & characters) ====================
// The "AI" part is on-device person segmentation (MediaPipe): it cuts you out of the camera
// picture so a new place and a cartoon character can be put behind you. Nothing is sent to a server
// until the user presses Post.

const CAM_W = 720, CAM_H = 1280, CAM_MAX_SEC = 60;
const CAM_EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const CAM_ENVS = {
  none:   { label: '🚫 My room' },
  park:   { label: '🌳 Park',  stops: ['#87ceeb', '#a8d8a8', '#7ba86b'], decor: [['🌳',90,520],['🌳',640,470],['🌷',140,1150],['🌷',560,1180],['☁️',520,150],['☁️',140,260]] },
  cafe:   { label: '☕ Café',  stops: ['#f6e6d0', '#e2c39b', '#b98a5e'], decor: [['☕',110,300],['🥐',600,380],['🍰',580,1150],['🌿',120,1100],['🖼️',360,180]] },
  beach:  { label: '🏖️ Beach', stops: ['#7fd6f5', '#4fb6e0', '#f3e2b3', '#ecd08f'], decor: [['🌴',90,700],['🌴',640,640],['☀️',560,170],['🐚',200,1190],['⛱️',540,1100]] },
  space:  { label: '🚀 Space', stops: ['#05051a', '#1a0b3d', '#3b1a6b'], stars: true, decor: [['🪐',560,260],['🌙',130,200],['🚀',150,1100]] },
  city:   { label: '🌃 City',  stops: ['#0b1030', '#3a1c71', '#d76d77'], city: true, decor: [['🌙',580,180]] },
  hearts: { label: '💖 Love',  stops: ['#ffd1e3', '#ff9ec4', '#ff4d88'], decor: [['💖',120,260],['💕',600,380],['💗',160,1120],['💘',580,1060]] }
};
const CAM_CHARS = ['none', '🐱', '🐶', '🦄', '🤖', '👻', '🐻', '🐼', '🦊', '🐸'];

let camStream = null, camRecorder = null, camChunks = [], camRaf = null, camActive = false;
let camVideo = null, camCanvas = null, camCtx = null;
let camSegmenter = null, camAIFailed = false, camAIStarting = false;
let camFacing = 'user', camMode = 'photo', camEnv = 'none', camChar = 'none';
let camRecording = false, camTimerId = null, camStartedAt = 0;
let camResult = null, camResultUrl = null;
const camEnvCache = {};

function camStatus(text) {
  const el = document.getElementById('cam-status');
  if (!el) return;
  el.textContent = text || '';
  el.style.display = text ? 'block' : 'none';
}

function camEnvLayer(key) {
  if (camEnvCache[key]) return camEnvCache[key];
  const env = CAM_ENVS[key];
  const c = document.createElement('canvas');
  c.width = CAM_W; c.height = CAM_H;
  const g = c.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, CAM_H);
  env.stops.forEach((col, i) => grad.addColorStop(i / (env.stops.length - 1), col));
  g.fillStyle = grad;
  g.fillRect(0, 0, CAM_W, CAM_H);

  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  if (env.stars) {
    for (let i = 0; i < 110; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.4 + rnd() * 0.6).toFixed(2) + ')';
      g.fillRect(rnd() * CAM_W, rnd() * CAM_H * 0.85, 3, 3);
    }
  }
  if (env.city) {
    const base = CAM_H * 0.86;
    for (let x = 0; x < CAM_W; ) {
      const w = 60 + Math.floor(rnd() * 60), h = 220 + Math.floor(rnd() * 420);
      g.fillStyle = '#120a2a';
      g.fillRect(x, base - h, w, h + (CAM_H - base));
      for (let wy = base - h + 16; wy < base - 10; wy += 34) {
        for (let wx = x + 10; wx < x + w - 14; wx += 22) {
          if (rnd() > 0.45) { g.fillStyle = 'rgba(255,214,102,0.85)'; g.fillRect(wx, wy, 9, 14); }
        }
      }
      x += w + 4;
    }
  }
  g.font = '110px ' + CAM_EMOJI_FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  (env.decor || []).forEach(([e, x, y]) => g.fillText(e, x, y));

  camEnvCache[key] = c;
  return c;
}

function camCover(src) {
  const iw = src.videoWidth || src.width, ih = src.videoHeight || src.height;
  const scale = Math.max(CAM_W / iw, CAM_H / ih);
  const sw = CAM_W / scale, sh = CAM_H / scale;
  return [(iw - sw) / 2, (ih - sh) / 2, sw, sh];
}

function camMirror(ctx) {
  if (camFacing === 'user') { ctx.translate(CAM_W, 0); ctx.scale(-1, 1); }
}

function drawCamChar(ctx, t) {
  if (camChar === 'none') return;
  ctx.font = '260px ' + CAM_EMOJI_FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(camChar, CAM_W * 0.78, CAM_H * 0.70 + Math.sin(t * 3) * 18);
  ctx.font = '120px ' + CAM_EMOJI_FONT;
  ctx.fillText(camChar, CAM_W * 0.16, CAM_H * 0.80 + Math.sin(t * 3 + 1.5) * 14);
}

// results = AI output (person cut-out). null = plain camera picture
function camDraw(results) {
  if (!camActive) return;
  const ctx = camCtx, t = performance.now() / 1000;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, CAM_W, CAM_H);

  if (!results) {
    const [sx, sy, sw, sh] = camCover(camVideo);
    ctx.save(); camMirror(ctx);
    ctx.drawImage(camVideo, sx, sy, sw, sh, 0, 0, CAM_W, CAM_H);
    ctx.restore();
    return;
  }

  const [sx, sy, sw, sh] = camCover(results.image);
  // 1) the person only
  ctx.save(); camMirror(ctx);
  ctx.drawImage(results.segmentationMask, sx, sy, sw, sh, 0, 0, CAM_W, CAM_H);
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(results.image, sx, sy, sw, sh, 0, 0, CAM_W, CAM_H);
  ctx.restore();

  // 2) behind the person: character, then the place
  ctx.globalCompositeOperation = 'destination-over';
  drawCamChar(ctx, t);
  if (camEnv !== 'none') {
    ctx.drawImage(camEnvLayer(camEnv), 0, 0);
  } else {
    ctx.save(); camMirror(ctx);
    ctx.drawImage(results.image, sx, sy, sw, sh, 0, 0, CAM_W, CAM_H);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

async function camLoop() {
  if (!camActive) return;
  try {
    if (camVideo.readyState >= 2) {
      if (camSegmenter && (camEnv !== 'none' || camChar !== 'none')) {
        await camSegmenter.send({ image: camVideo });
      } else {
        camDraw(null);
      }
    }
  } catch (err) {
    console.error('Camera AI error:', err);
    camSegmenter = null; camAIFailed = true;
    camStatus('AI effects are not available on this phone - using the plain camera');
    camDraw(null);
  }
  camRaf = requestAnimationFrame(camLoop);
}

async function initCamAI() {
  if (camSegmenter || camAIFailed || camAIStarting) return;
  camAIStarting = true;
  camStatus('Loading AI effects...');
  try {
    if (!window.SelfieSegmentation) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/vendor/selfie/selfie_segmentation.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const seg = new SelfieSegmentation({ locateFile: f => '/vendor/selfie/' + f });
    seg.setOptions({ modelSelection: 1 });
    seg.onResults(camDraw);
    await seg.initialize();
    camSegmenter = seg;
    camStatus('');
  } catch (err) {
    console.error('Could not load camera AI:', err);
    camAIFailed = true;
    camStatus('AI effects could not load - plain camera only');
  }
  camAIStarting = false;
}

async function startCamStream() {
  stopCamStream();
  const video = { facingMode: camFacing, width: { ideal: 720 }, height: { ideal: 1280 } };
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch (err) {
    camStream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); // mic refused
  }
  camVideo.srcObject = camStream;
  await camVideo.play();
}

function stopCamStream() {
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  camStream = null;
}

async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage('❌ This browser cannot use the camera');
    return;
  }
  hideAllScreens();
  document.getElementById('camera-screen').style.display = 'block';

  camVideo = document.getElementById('cam-video');
  camCanvas = document.getElementById('cam-canvas');
  camCtx = camCanvas.getContext('2d');
  buildCamChips();
  closeCamPreview();
  setCamMode('photo');

  try {
    await startCamStream();
  } catch (err) {
    closeCamera();
    showMessage('❌ Could not open the camera. Please allow camera access.');
    return;
  }
  camActive = true;
  camLoop();
  initCamAI();
}

function closeCamera() {
  camActive = false;
  if (camRaf) cancelAnimationFrame(camRaf);
  if (camRecording && camRecorder) { camRecorder.onstop = null; try { camRecorder.stop(); } catch (e) {} }
  camRecording = false;
  clearInterval(camTimerId);
  stopCamStream();
  closeCamPreview();
  document.getElementById('camera-screen').style.display = 'none';
  openUploadVideo();
}

async function flipCamera() {
  if (camRecording) return;
  camFacing = camFacing === 'user' ? 'environment' : 'user';
  try { await startCamStream(); } catch (err) { showMessage('❌ Could not switch camera'); }
}

// ---------- chips & modes ----------

function buildCamChips() {
  const envBox = document.getElementById('cam-envs');
  const charBox = document.getElementById('cam-chars');
  if (envBox.children.length) { refreshCamChips(); return; }

  Object.keys(CAM_ENVS).forEach(key => {
    const b = document.createElement('button');
    b.className = 'cam-chip'; b.dataset.env = key;
    b.textContent = CAM_ENVS[key].label;
    b.onclick = () => { camEnv = key; refreshCamChips(); };
    envBox.appendChild(b);
  });
  CAM_CHARS.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'cam-chip'; b.dataset.char = ch;
    b.textContent = ch === 'none' ? '🚫' : ch;
    b.onclick = () => { camChar = ch; refreshCamChips(); };
    charBox.appendChild(b);
  });
  refreshCamChips();
}

function refreshCamChips() {
  document.querySelectorAll('#cam-envs .cam-chip').forEach(b => b.classList.toggle('on', b.dataset.env === camEnv));
  document.querySelectorAll('#cam-chars .cam-chip').forEach(b => b.classList.toggle('on', b.dataset.char === camChar));
}

function setCamMode(mode) {
  if (camRecording) return;
  camMode = mode;
  document.getElementById('cam-mode-photo').classList.toggle('on', mode === 'photo');
  document.getElementById('cam-mode-video').classList.toggle('on', mode === 'video');
}

// ---------- shutter: photo or video ----------

function camShutter() {
  if (camMode === 'photo') {
    camCanvas.toBlob(b => { if (b) showCamPreview(b, 'photo'); }, 'image/jpeg', 0.92);
  } else if (camRecording) {
    camStopRecording();
  } else {
    camStartRecording();
  }
}

function camStartRecording() {
  if (!window.MediaRecorder) { showMessage('❌ This browser cannot record video'); return; }
  const out = camCanvas.captureStream(30);
  if (camStream) camStream.getAudioTracks().forEach(t => out.addTrack(t));

  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mime = types.find(t => MediaRecorder.isTypeSupported(t));
  const opts = { videoBitsPerSecond: 2500000 };
  if (mime) opts.mimeType = mime;

  camChunks = [];
  camRecorder = new MediaRecorder(out, opts);
  camRecorder.ondataavailable = e => { if (e.data && e.data.size) camChunks.push(e.data); };
  camRecorder.onstop = () => {
    const type = (camRecorder.mimeType || 'video/webm').split(';')[0];
    showCamPreview(new Blob(camChunks, { type }), 'video');
  };
  camRecorder.start(1000);

  camRecording = true;
  camStartedAt = Date.now();
  document.getElementById('cam-shutter').classList.add('rec');
  const timer = document.getElementById('cam-timer');
  timer.style.display = 'block';
  camTimerId = setInterval(() => {
    const s = Math.floor((Date.now() - camStartedAt) / 1000);
    timer.textContent = '● ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (s >= CAM_MAX_SEC) camStopRecording();
  }, 250);
}

function camStopRecording() {
  if (!camRecording) return;
  camRecording = false;
  clearInterval(camTimerId);
  document.getElementById('cam-shutter').classList.remove('rec');
  document.getElementById('cam-timer').style.display = 'none';
  try { camRecorder.stop(); } catch (e) {}
}

// ---------- preview, save, post ----------

function showCamPreview(blob, kind) {
  camResult = { blob, kind };
  if (camResultUrl) URL.revokeObjectURL(camResultUrl);
  camResultUrl = URL.createObjectURL(blob);

  const img = document.getElementById('cam-preview-img');
  const vid = document.getElementById('cam-preview-video');
  img.style.display = kind === 'photo' ? 'block' : 'none';
  vid.style.display = kind === 'video' ? 'block' : 'none';
  if (kind === 'photo') img.src = camResultUrl;
  else { vid.src = camResultUrl; vid.play().catch(() => {}); }

  document.getElementById('cam-caption').style.display = kind === 'video' ? 'block' : 'none';
  document.getElementById('cam-post-btn').style.display = kind === 'video' ? 'block' : 'none';
  document.getElementById('cam-profile-btn').style.display = kind === 'photo' ? 'block' : 'none';
  document.getElementById('cam-msg').textContent = '';
  document.getElementById('cam-preview').style.display = 'flex';
}

function closeCamPreview() {
  const p = document.getElementById('cam-preview');
  if (p) p.style.display = 'none';
  const vid = document.getElementById('cam-preview-video');
  if (vid) { vid.pause(); vid.removeAttribute('src'); }
  camResult = null;
}

function camSaveToDevice() {
  if (!camResult) return;
  const ext = camResult.kind === 'photo' ? 'jpg' : (camResult.blob.type.includes('mp4') ? 'mp4' : 'webm');
  const a = document.createElement('a');
  a.href = camResultUrl;
  a.download = 'loveconnect-' + Date.now() + '.' + ext;
  document.body.appendChild(a); a.click(); a.remove();
}

async function camPostVideo() {
  if (!camResult || camResult.kind !== 'video') return;
  const msg = document.getElementById('cam-msg');
  const caption = document.getElementById('cam-caption').value.trim();
  const ext = camResult.blob.type.includes('mp4') ? 'mp4' : 'webm';
  msg.textContent = 'Uploading... ⏳';
  try {
    const formData = new FormData();
    formData.append('video', camResult.blob, 'recording.' + ext);
    if (caption) formData.append('caption', caption);
    const res = await fetch(API_URL + '/videos/upload', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload failed');
    msg.textContent = '✅ Posted!';
    document.getElementById('cam-caption').value = '';
    setTimeout(() => { closeCamera(); showTab('videos'); }, 900);
  } catch (err) {
    msg.textContent = '❌ ' + err.message;
  }
}

async function camUseAsProfilePhoto() {
  if (!camResult || camResult.kind !== 'photo') return;
  const msg = document.getElementById('cam-msg');
  msg.textContent = 'Saving... ⏳';
  try {
    const formData = new FormData();
    formData.append('photo', camResult.blob, 'photo.jpg');
    const res = await fetch(API_URL + '/profile/setup', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData
    });
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not save photo');
    if (data.profilePicture) currentUser.profilePicture = data.profilePicture;
    msg.textContent = '✅ Profile photo updated!';
    setTimeout(() => { closeCamera(); showTab('profile'); }, 900);
  } catch (err) {
    msg.textContent = '❌ ' + err.message;
  }
}

// ==================== NOTIFICATIONS ====================

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function startNotifPolling() {
  requestNotificationPermission();
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
    if (handleAuthFailure(res.status)) return;
    const data = await res.json();
    const dot = document.getElementById('nav-msg-dot');

    if (data.count > 0) {
      if (dot) dot.style.display = 'block';
      if (data.count > lastUnreadCount) {
        showMessage('💌 You have a new message!', 'success');
        sendBrowserNotification('LoveConnect', 'You have a new message! 💌');
        if (currentChatUserId) {
          loadMessages(currentChatUserId);
        }
      }
    } else {
      if (dot) dot.style.display = 'none';
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

  if (worldSocket) {
    worldSocket.disconnect();
    worldSocket = null;
  }

  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('app').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';

  hideMessage();
  isLogin = false;

  document.getElementById('form-title').textContent = 'Sign Up';
  document.getElementById('submit-btn').textContent = 'Sign Up';
  document.getElementById('name').style.display = 'block';
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
    document.getElementById('auth-section').style.display = 'block';
  }
};