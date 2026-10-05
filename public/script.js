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
const WORLD_TALK_DISTANCE = 40;

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

    if (!res.ok) throw new Error(data.message || 'Registration failed');

    hideMessage();
    showMessage('✅ Account created! Please log in.', 'success');

    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    document.getElementById('name').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('interest').value = '';

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
    'map-screen', 'world-screen'
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
        <video src="${v.url}" loop playsinline preload="metadata" crossorigin="anonymous" onclick="toggleSlidePlay(this)"></video>
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
  if (!container || container.style.display === 'none') return;
  const nav = document.getElementById('bottom-nav');
  const navH = nav ? nav.offsetHeight : 80;
  const top = container.getBoundingClientRect().top + window.pageYOffset;
  const h = Math.max(300, Math.floor(window.innerHeight - top - navH));
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

// ==================== SEARCH USERS ====================

async function searchUsers() {
  const input = document.getElementById('search-input');
  const q = input?.value?.trim();
  const container = document.getElementById('search-results');
  const feedContainer = document.getElementById('video-feed-container');

  if (!q) {
    container.innerHTML = '';
    feedContainer.style.display = 'block';
    fitFeedHeight();
    restoreFeedPosition();
    return;
  }

  feedContainer.style.display = 'none';
  container.innerHTML = '<p>Searching...</p>';

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

// ==================== WORLD (live moving avatars) ====================

const WORLD_W = 600;
const WORLD_H = 600;   // must match server.js
const WORLD_PAD = 24;  // avatar centre can't go closer than this to the edge

const WORLD_ROOMS = {
  park: {
    label: '🌳 Park',
    bg: 'linear-gradient(to bottom, #87ceeb 0%, #a8d8a8 60%, #7ba86b 100%)',
    decor: [['🌳', 70, 165], ['🌳', 530, 135], ['🌷', 300, 500], ['🌷', 150, 450], ['🌷', 470, 465]]
  },
  cafe: {
    label: '☕ Café',
    bg: 'linear-gradient(to bottom, #f6e6d0 0%, #e2c39b 55%, #b98a5e 100%)',
    decor: [['☕', 90, 135], ['🌿', 525, 120], ['🥐', 300, 135], ['🍰', 480, 490], ['☕', 110, 490]]
  },
  beach: {
    label: '🏖️ Beach',
    bg: 'linear-gradient(to bottom, #7fd6f5 0%, #4fb6e0 30%, #f3e2b3 45%, #ecd08f 100%)',
    decor: [['🌴', 80, 300], ['⛱️', 500, 390], ['🐚', 300, 520], ['🌴', 540, 285], ['🦀', 170, 480]]
  }
};

const WORLD_EMOTES = { heart: '❤️', wave: '👋', dance: '💃' };
const WORLD_EMOTE_MS = 2500;
const WORLD_BUBBLE_MS = 30000;   // chat bubbles stay 30 seconds (or until someone replies)
const WORLD_TRAIL_MS = 700;
const WORLD_WALK_SPEED = 190;    // pixels per second

let worldRoom = 'park';
let worldAnimFrame = null;
const worldImages = {}; // url -> { img, ok }
let worldScale = 1;
let worldTarget = null;          // where my avatar is walking to
let worldPointerDown = false;
let worldLastMoveSent = 0;
let worldLastFrame = 0;
let worldPromptUid = null;

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
  applyWorldRoomStyle();
  fitWorldCanvas();
  setupWorldPointer();

  if (!worldSocket) {
    worldSocket = io({ auth: { token } });

    worldSocket.on('connect', joinWorld);

    // Full list of everyone in MY room (sent on join, room change, and when someone arrives)
    worldSocket.on('world:state', ({ room, users }) => {
      const roomChanged = room !== worldRoom;
      worldRoom = room;
      if (roomChanged) worldTarget = null;
      applyWorldRoomStyle();

      const next = {};
      users.forEach(u => {
        const old = !roomChanged ? worldUsers[u.userId] : null;
        // while I'm walking, trust my own position over the server's older copy
        const keep = (u.userId === currentUser.id && old && worldTarget) ? { x: old.x, y: old.y } : null;
        const merged = Object.assign(old || { dx: u.x, dy: u.y, trail: [], phase: 0 }, u);
        if (keep) Object.assign(merged, keep);
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

// ---------- full-screen sizing ----------

function fitWorldCanvas() {
  const stage = document.getElementById('world-stage');
  const canvas = document.getElementById('world-canvas');
  if (!stage || !canvas) return;
  const s = Math.min(stage.clientWidth / WORLD_W, stage.clientHeight / WORLD_H);
  if (!(s > 0)) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = Math.floor(WORLD_W * s) + 'px';
  canvas.style.height = Math.floor(WORLD_H * s) + 'px';
  canvas.width = Math.floor(WORLD_W * s * dpr);
  canvas.height = Math.floor(WORLD_H * s * dpr);
  worldScale = canvas.width / WORLD_W;
}
window.addEventListener('resize', () => { if (isWorldOpen()) fitWorldCanvas(); });

// ---------- rooms ----------

function switchWorldRoom(room) {
  if (!worldSocket || room === worldRoom || !WORLD_ROOMS[room]) return;
  worldSocket.emit('world:switchRoom', { room });
}

function applyWorldRoomStyle() {
  const screen = document.getElementById('world-screen');
  const room = WORLD_ROOMS[worldRoom] || WORLD_ROOMS.park;
  if (screen) screen.style.background = room.bg;

  document.querySelectorAll('.world-room-btn').forEach(btn => {
    const active = btn.dataset.room === worldRoom;
    btn.style.background = active ? '#ff4d8d' : 'rgba(255,255,255,0.85)';
    btn.style.color = active ? 'white' : '#333';
  });
}

// ---------- movement: mouse / touch only ----------

function worldPointToTarget(e) {
  const canvas = document.getElementById('world-canvas');
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * WORLD_W / r.width;
  const y = (e.clientY - r.top) * WORLD_H / r.height;
  worldTarget = {
    x: Math.min(WORLD_W - WORLD_PAD, Math.max(WORLD_PAD, x)),
    y: Math.min(WORLD_H - WORLD_PAD, Math.max(WORLD_PAD, y))
  };
}

function setupWorldPointer() {
  const canvas = document.getElementById('world-canvas');
  if (canvas._worldBound) return;
  canvas._worldBound = true;

  // tap/click = walk there; hold and drag = keep steering
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    // tapping another character opens a chat with them (you stay in the game)
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * WORLD_W / r.width;
    const py = (e.clientY - r.top) * WORLD_H / r.height;
    const hit = Object.values(worldUsers).find(u =>
      u.userId !== currentUser.id && Math.hypot(u.dx - px, u.dy - py) < 26);
    if (hit) { openWorldChat(hit.userId, hit.name); return; }

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
  const step = WORLD_WALK_SPEED * dt;
  const arrived = dist <= step;

  if (arrived) {
    me.x = worldTarget.x;
    me.y = worldTarget.y;
    worldTarget = null;
  } else {
    me.x += dx / dist * step;
    me.y += dy / dist * step;
  }

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

function drawWorld() {
  if (!worldCtx) return;
  const ctx = worldCtx;
  const now = performance.now();
  const users = Object.values(worldUsers);

  updateWorldMovement(now);
  ctx.setTransform(worldScale, 0, 0, worldScale, 0, 0);
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);

  // scenery for this room
  const room = WORLD_ROOMS[worldRoom] || WORLD_ROOMS.park;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '30px serif';
  room.decor.forEach(([emoji, x, y]) => ctx.fillText(emoji, x, y));

  // boundary wall (avatars can't cross this)
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  worldRoundRect(ctx, 3, 3, WORLD_W - 6, WORLD_H - 6, 14);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  worldRoundRect(ctx, 6, 6, WORLD_W - 12, WORLD_H - 12, 12);
  ctx.stroke();

  // update animation state: glide towards the real position, detect walking, record trail
  users.forEach(u => {
    if (u.dx === undefined) { u.dx = u.x; u.dy = u.y; }
    if (!u.trail) u.trail = [];
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

  // avatars, back-to-front so lower ones overlap higher ones
  users.sort((a, b) => a.dy - b.dy).forEach(u => {
    const isMe = u.userId === currentUser.id;
    const dancing = u.emote && u.emote.type === 'dance';

    let bob = 0;
    let tilt = 0;
    if (dancing) {
      bob = -Math.abs(Math.sin(now / 120)) * 8;
      tilt = Math.sin(now / 90) * 0.35;
    } else if (u.moving) {
      bob = -Math.abs(Math.sin(u.phase)) * 4;
      tilt = Math.sin(u.phase) * 0.15;
    }

    // ground shadow (shrinks as the avatar hops)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(u.dx, u.dy + 19, 15 + bob * 0.4, 5 + bob * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(u.dx, u.dy + bob);
    ctx.rotate(tilt);

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

    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(u.name, u.dx, u.dy + 36);
  });

  // bubbles and emotes on top of everybody
  users.forEach(u => {
    if (u.bubble) drawWorldBubble(ctx, u, now);
    if (u.emote) drawWorldEmote(ctx, u, now);
  });
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
    document.getElementById('auth-section').style.display = 'block';
  }
};