// C:\mongoDB\vips\src\index.js (COMPLETE CODE)

document.addEventListener('DOMContentLoaded', () => {
    // Define the URL for your backend server
    const BACKEND_URL = 'http://localhost:3001'; 
    
    // --- Get Elements ---
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const messageElement = document.getElementById('message');

    // --- Helper Function to Display Message ---
    const displayMessage = (msg, isError = false) => {
        messageElement.textContent = msg;
        messageElement.style.color = isError ? 'red' : 'green';
    };

    // --- 1. Sign Up Submission Handler (Corrected) ---
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        displayMessage('Processing registration...', false);

        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password').value;

        try {
            const response = await fetch(`${BACKEND_URL}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage(`Sign Up Success! ${data.message}`, false);
                // Clear fields on success
                document.getElementById('signup-username').value = '';
                document.getElementById('signup-password').value = '';
            } else {
                displayMessage(`Sign Up Failed: ${data.message}`, true);
            }
        } catch (error) {
            console.error('Network or server error:', error);
            displayMessage(`Error connecting to server: Check backend (port 3000) is running.`, true);
        }
    });

    // --- 2. Log In Submission Handler (Corrected) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        displayMessage('Attempting login...', false);

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${BACKEND_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage(`Login Success! ${data.message}`, false);
                // In a real application, you would save the authentication token here.
                console.log('Authentication Data:', data);
            } else {
                displayMessage(`Login Failed: ${data.message}`, true);
            }
        } catch (error) {
            console.error('Network or server error:', error);
            displayMessage(`Error connecting to server: Check backend (port 3000) is running.`, true);
        }
    });
});