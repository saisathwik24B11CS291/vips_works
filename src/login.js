import './styles.css';
// C:\mongoDB\vips\src\login.js

// C:\mongoDB\vips\src\login.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Use the full URL to Port 5000 to avoid "Cannot connect" errors
    const API_URL = window.location.origin + "/api/auth"; 
    
    const loginForm = document.getElementById('login-form');
    const messageElement = document.getElementById('message');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');

    if (!loginForm || !messageElement || !usernameInput || !passwordInput) {
        console.error("Missing required elements in login.html.");
        return;
    }

    const displayMessage = (msg, isError = false) => {
        messageElement.textContent = msg;
        messageElement.style.color = isError ? 'red' : 'green';
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        displayMessage('Attempting login...', false);

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        try {
            // Updated fetch to use the absolute path
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Save login data
                localStorage.setItem('token', data.token); 
                localStorage.setItem('username', data.username);
                localStorage.setItem('userRole', data.role);
                
                displayMessage(`Login Success! Welcome, ${data.username}!`, false);
                
                // Redirect based on role received from server
                setTimeout(() => {
                    if (data.role === 'employer') {
                        window.location.href = '../employer/profile.html'; 
                    } else {
                        window.location.href = '../worker/profile.html'; 
                    }
                }, 1000); 

            } else {
                displayMessage(`Login Failed: ${data.message || 'Invalid credentials'}`, true);
            }
        } catch (error) {
            console.error('Network error:', error);
            displayMessage(`Error: Cannot connect to server at ${API_URL}. Is your Backend running?`, true);
        }
    });
});