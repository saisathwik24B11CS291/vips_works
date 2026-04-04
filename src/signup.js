import './styles.css';
// C:\mongoDB\vips\src\signup.js

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Use the full URL and port 5000 as defined in your server.js
    const API_URL = 'http://localhost:5000/api/auth'; 
    
    const signupForm = document.getElementById('signup-form');
    const messageElement = document.getElementById('message');

    if (!signupForm || !messageElement) {
        console.error("Required HTML elements (form or message div) not found.");
        return;
    }

    const displayMessage = (msg, isError = false) => {
        messageElement.textContent = msg;
        messageElement.style.color = isError ? 'red' : 'green';
    };

    // --- Sign Up Submission Handler ---
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        displayMessage('Processing registration...', false);

        // 2. Get the role from localStorage (set by your index.html)
        const role = localStorage.getItem('userRole') || 'worker';

        // 3. Collect all fields required by your Worker/Employer schemas
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const phone = document.getElementById('signup-phone') ? document.getElementById('signup-phone').value : "";

        try {
            // 4. Fetch using the absolute URL to port 5000
            const response = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    role, 
                    username, 
                    email, 
                    password, 
                    phone 
                })
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage(`Success! ${data.message || 'Account created.'}`, false);
                
                // 5. Redirect to the login page within the same subfolder
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000); 
            } else {
                displayMessage(`Sign Up Failed: ${data.error || data.message || 'Unknown error'}`, true);
            }
        } catch (error) {
            console.error('Network or server error:', error);
            displayMessage(`Error: Could not connect to server at port 5000. Is your backend running?`, true);
        }
    });
});