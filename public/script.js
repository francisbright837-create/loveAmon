// ============================================
// CONFIGURATION
// ============================================
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : 'https://loveamon.onrender.com/api';

let token = null;
let currentUser = null;
let currentChatUserId = null;

// ============================================
// UI HELPERS - Replace alert() with proper feedback
// ============================================
function showMessage(message, type = 'error') {
  // Remove existing messages
  const existing = document.querySelector('.app-message');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = `app-message ${type}`;
  div.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 15px 25px;
    border-radius: 10px;
    font-weight: 500;
    z-index: 10000;
    animation: slideDown 0.3s ease;
    max-width: 90%;
    text-align: center;
    ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 
      type === 'loading' ? 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;' :
      'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'}
  `;
  
  if (type === 'loading') {
    div.innerHTML = `<span style="display:inline-block; width:16px; height:16px; border:2px solid #856404; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-right:10px; vertical-align:middle;"></span>${message}`;
  } else {
    div.textContent = message;
  }

  document.body.appendChild(div);

  // Auto-remove after 5 seconds for success/error
  if (type !== 'loading') {
    setTimeout(() => {
      if (div.parentNode) div.remove();
    }, 5000);
  }

  return div;
}

function hideMessage() {
  const msg = document.querySelector('.app-message');
  if (msg) msg.remove();
}

function setButtonLoading(button, loading) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = 'Please wait...';
    button.disabled = true;
    button.style.opacity = '0.7';
    button.style.cursor = 'not-allowed';
  } else {
    button.textContent = button.dataset.originalText || 'Sign Up';
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  }
}

// Add animation styles to head
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// ============================================
// INITIALIZATION
// ============================================
window.onload = function () {
  token = localStorage.getItem("token");
  if (token) {
    showApp();
  }
};

// ============================================
// FORM TOGGLE
// ============================================
function toggleForm() {
  const title = document.getElementById("form-title");
  const btn = document.getElementById("submit-btn");
  const toggleText = document.getElementById("toggle-text");

  if (title.textContent === "Sign Up") {
    title.textContent = "Log In";
    btn.textContent = "Log In";
    toggleText.innerHTML = 'No account yet? <a href="#" onclick="toggleForm()">Sign Up</a>';
    document.getElementById("name").style.display = "none";
    document.getElementById("gender").style.display = "none";
    document.getElementById("interest").style.display = "none";
  } else {
    title.textContent = "Sign Up";
    btn.textContent = "Sign Up";
    toggleText.innerHTML = 'Already have an account? <a href="#" onclick="toggleForm()">Log In</a>';
    document.getElementById("name").style.display = "block";
    document.getElementById("gender").style.display = "block";
    document.getElementById("interest").style.display = "block";
  }
  
  // Clear any messages
  hideMessage();
}

// ============================================
// ✅ FIXED SUBMIT HANDLER
// ============================================
async function submitForm() {
  const isLogin = document.getElementById("form-title").textContent === "Log In";
  const btn = document.getElementById("submit-btn");

  if (isLogin) {
    await login(btn);
  } else {
    await register(btn);
  }
}

// ============================================
// ✅ FIXED REGISTER - With proper feedback
// ============================================
async function register(btn) {
  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    gender: document.getElementById("gender").value,
    interest: document.getElementById("interest").value,
  };

  // Validation
  if (!payload.name || !payload.email || !payload.password || !payload.gender || !payload.interest) {
    showMessage("❌ Please fill in all fields!");
    return;
  }

  if (payload.password.length < 6) {
    showMessage("❌ Password must be at least 6 characters!");
    return;
  }

  if (!payload.email.includes('@')) {
    showMessage("❌ Please enter a valid email!");
    return;
  }

  setButtonLoading(btn, true);
  showMessage("Creating your account...", "loading");

  try {
    const res = await fetch(API_URL + "/auth/register", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || `Registration failed (${res.status})`);
    }

    // ✅ SUCCESS
    hideMessage();
    showMessage("✅ Account created! Please log in now.", "success");

    // Clear form
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
    document.getElementById("name").value = "";
    document.getElementById("gender").value = "";
    document.getElementById("interest").value = "";

    // Switch to login after 2 seconds
    setTimeout(() => {
      toggleForm();
    }, 2000);

  } catch (err) {
    console.error("Register error:", err);
    hideMessage();
    
    let msg = err.message;
    if (err.message === "Failed to fetch") {
      msg = "❌ Cannot connect to server. Is the server running?";
    }
    
    showMessage(msg, "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

// ============================================
// ✅ FIXED LOGIN - With proper feedback
// ============================================
async function login(btn) {
  const payload = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
  };

  if (!payload.email || !payload.password) {
    showMessage("❌ Please enter email and password!");
    return;
  }

  setButtonLoading(btn, true);
  showMessage("Logging in...", "loading");

  try {
    const res = await fetch(API_URL + "/auth/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || `Login failed (${res.status})`);
    }

    // ✅ SUCCESS
    hideMessage();
    
    token = data.token;
    localStorage.setItem("token", token);
    
    showMessage("✅ Login successful!", "success");

    setTimeout(() => {
      showApp();
    }, 1000);

  } catch (err) {
    console.error("Login error:", err);
    hideMessage();
    
    let msg = err.message;
    if (err.message === "Failed to fetch") {
      msg = "❌ Cannot connect to server. Check if server is running.";
    }
    
    showMessage(msg, "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

// ============================================
// LOGOUT
// ============================================
function logout() {
  localStorage.removeItem("token");
  token = null;
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("auth-section").style.display = "block";
  hideMessage();
}

// ============================================
// SHOW APP
// ============================================
async function showApp() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app").style.display = "block";

  try {
    const res = await fetch(API_URL + "/profile/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Session expired. Please log in again.");
    currentUser = await res.json();

    document.getElementById("current-user-name").textContent = currentUser.name;

    if (!currentUser.profilePicture || !currentUser.bio?.trim()) {
      document.getElementById("profile-setup").style.display = "block";
      document.getElementById("matching-screen").style.display = "none";
      document.getElementById("chat-screen").style.display = "none";
    } else {
      document.getElementById("profile-setup").style.display = "none";
      document.getElementById("matching-screen").style.display = "block";
      document.getElementById("chat-screen").style.display = "none";
      fetchProfiles();
    }
  } catch (err) {
    showMessage(err.message, "error");
    logout();
  }
}

// ============================================
// PHOTO PREVIEW
// ============================================
document.getElementById("photo-input")?.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = document.getElementById("photo-preview");
    preview.src = ev.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// ============================================
// SAVE PROFILE
// ============================================
async function saveProfile() {
  const bio = document.getElementById("bio").value.trim();
  const fileInput = document.getElementById("photo-input");

  let profilePicture = null;
  if (fileInput.files[0]) {
    profilePicture = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(fileInput.files[0]);
    });
  }

  if (!profilePicture && !bio) {
    showMessage("Please add at least a photo or a short bio!", "error");
    return;
  }

  try {
    const res = await fetch(API_URL + "/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ profilePicture, bio })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to save profile");
    }

    hideMessage();
    showMessage("✅ Profile saved!", "success");
    await showApp();
  } catch (err) {
    showMessage("Error: " + err.message, "error");
  }
}

// ============================================
// FETCH & DISPLAY PROFILES
// ============================================
async function fetchProfiles() {
  try {
    const res = await fetch(API_URL + "/match/profiles", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load profiles");

    const data = await res.json();
    const profiles = data.profiles || data;
    displayProfiles(profiles);
  } catch (err) {
    document.getElementById("profiles").innerHTML = `<p style="color:red">${err.message}</p>`;
  }
}

function displayProfiles(profiles) {
  const container = document.getElementById("profiles");
  container.innerHTML = "";

  if (!profiles || profiles.length === 0) {
    container.innerHTML = "<p>No other profiles available yet.</p>";
    return;
  }

  profiles.forEach(p => {
    const card = document.createElement("div");
    card.className = "profile-card";

    let imgHtml = p.profilePicture
      ? `<img src="${escapeHTML(p.profilePicture)}" alt="${escapeHTML(p.name)}">`
      : `<div style="height:200px; background:#eee; border-radius:10px; display:flex; align-items:center; justify-content:center;">No photo</div>`;

    card.innerHTML = `
      ${imgHtml}
      <h3>${escapeHTML(p.name)}</h3>
      <p><strong>Gender:</strong> ${escapeHTML(p.gender || "—")}</p>
      <p><strong>Looking for:</strong> ${escapeHTML(p.interest || "—")}</p>
      <p>${escapeHTML(p.bio || "No bio yet.")}</p>
      <button onclick="likeUser('${p._id}')">Like ❤️</button>
      <button onclick="openChat('${p._id}', '${escapeHTML(p.name)}')" style="margin-left:10px;">Message 💬</button>
    `;

    container.appendChild(card);
  });
}

// ============================================
// LIKE USER
// ============================================
async function likeUser(targetId) {
  try {
    const res = await fetch(API_URL + `/match/like/${targetId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Like failed");

    if (data.match) {
      showMessage("It's a match! 🎉", "success");
    } else {
      showMessage("Liked! 💕", "success");
    }

    fetchProfiles();
  } catch (err) {
    showMessage("Error: " + err.message, "error");
  }
}

// ============================================
// CHAT FUNCTIONS
// ============================================
function openChat(userId, userName) {
  currentChatUserId = userId;
  document.getElementById("matching-screen").style.display = "none";
  document.getElementById("chat-screen").style.display = "block";
  document.getElementById("chat-with-name").textContent = userName;
  
  fetchMessages(userId);
  
  window.chatInterval = setInterval(() => fetchMessages(userId), 3000);
}

function closeChat() {
  document.getElementById("chat-screen").style.display = "none";
  document.getElementById("matching-screen").style.display = "block";
  currentChatUserId = null;
  if (window.chatInterval) clearInterval(window.chatInterval);
}

async function fetchMessages(userId) {
  try {
    const res = await fetch(API_URL + `/messages/${userId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error("Failed to load messages");
    
    const messages = await res.json();
    displayMessages(messages);
  } catch (err) {
    console.error("Fetch messages error:", err);
  }
}

function displayMessages(messages) {
  const container = document.getElementById("chat-messages");
  container.innerHTML = "";
  
  if (messages.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#888;'>No messages yet. Say hi! 👋</p>";
    return;
  }
  
  messages.forEach(msg => {
    const isMe = msg.sender._id === currentUser._id || msg.sender === currentUser._id;
    const msgDiv = document.createElement("div");
    msgDiv.style.cssText = isMe 
      ? "background:#ff4d8d; color:white; padding:10px 15px; border-radius:15px 15px 0 15px; margin:5px 0 5px auto; max-width:70%; text-align:right;"
      : "background:#f0f0f0; color:#333; padding:10px 15px; border-radius:15px 15px 15px 0; margin:5px auto 5px 0; max-width:70%;";
    
    msgDiv.innerHTML = `
      <small style="opacity:0.7; font-size:11px;">${escapeHTML(msg.sender.name || "User")}</small><br>
      ${escapeHTML(msg.text)}
      <br><small style="opacity:0.5; font-size:10px;">${new Date(msg.createdAt).toLocaleTimeString()}</small>
    `;
    
    container.appendChild(msgDiv);
  });
  
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  
  if (!text || !currentChatUserId) return;
  
  try {
    const res = await fetch(API_URL + `/messages/${currentChatUserId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });
    
    if (!res.ok) throw new Error("Failed to send message");
    
    input.value = "";
    fetchMessages(currentChatUserId);
  } catch (err) {
    showMessage("Error sending message: " + err.message, "error");
  }
}

// Allow Enter key to send message
document.addEventListener("DOMContentLoaded", function() {
  const msgInput = document.getElementById("message-input");
  if (msgInput) {
    msgInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") sendMessage();
    });
  }
});

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}