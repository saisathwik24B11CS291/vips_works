const API_BASE = "http://localhost:5000";
const token = localStorage.getItem('token');

// Function to fetch users from backend
async function searchUsers(query = '') {
    try {
        const res = await fetch(`${API_BASE}/api/users/search?query=${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await res.json();
        displayResults(users);
    } catch (err) {
        console.error("Search failed:", err);
    }
}

// Function to display results in the modern list style
function displayResults(users) {
    const resultsContainer = document.getElementById('search-results');
    
    if (!users || users.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; margin-top:20px;">No accounts found</p>';
        return;
    }

    resultsContainer.innerHTML = users.map(user => `
        <div class="user-row" onclick="window.location.href='chat.html?id=${user._id}'">
            <div class="user-avatar-container">
                <img src="${user.profilePicture ? API_BASE + user.profilePicture : 'placeholder.png'}" 
                     class="user-avatar" 
                     onerror="this.src='../../public/worker/placeholder.png'">
                <div class="status-dot"></div> 
            </div>
            
            <div class="user-info">
                <span class="user-name">${user.username}</span>
                <span class="user-meta">${user.profession || 'Active now'}</span>
            </div>

            <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            </div>
        </div>
    `).join('');
}

// Listen for typing in the search bar
document.querySelector('.search-input').addEventListener('input', (e) => {
    searchUsers(e.target.value);
});

// Load all users initially
searchUsers();