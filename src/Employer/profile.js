const SERVER_URL = 'https://vips_works.onrender.com';
const API_URL = `${SERVER_URL}/api/auth`; // Matches your server.js auth routes

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const profileUsernameElement = document.getElementById('profile-username'); 
    const statFavoritesElement = document.getElementById('stat-favorites');
    const statFollowersElement = document.getElementById('stat-followers');
    const statFollowingElement = document.getElementById('stat-following');
    const profilePhotoElement = document.getElementById('profile-photo');
    const photoUploadInput = document.getElementById('photo-upload-input');
    const profileEmailElement = document.getElementById('profile-email');
    const profilePhoneElement = document.getElementById('profile-phone');
    const logoutLink = document.getElementById('logout-link'); 

    // --- Authentication Check ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html'; 
        return;
    }

    // --- Profile Fetching Logic ---
    const fetchProfile = async () => {
        try {
            const response = await fetch(`${API_URL}/me`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Display Information
                if (profileUsernameElement) profileUsernameElement.textContent = data.username;
                if (profileEmailElement) profileEmailElement.textContent = data.email;
                if (profilePhoneElement) profilePhoneElement.textContent = data.phone || "Not Set";
                
                // Display Stats (Defaulting to 0 if not in DB)
                if (statFavoritesElement) statFavoritesElement.textContent = data.rating || "4.9";
                if (statFollowersElement) statFollowersElement.textContent = (data.followers ? data.followers.length : 0);
                if (statFollowingElement) statFollowingElement.textContent = (data.following ? data.following.length : 0);

                // Load existing profile picture
                if (data.profilePicture && profilePhotoElement) {
                    profilePhotoElement.src = `${SERVER_URL}${data.profilePicture}`; 
                } else {
                    // Fallback if no image
                    profilePhotoElement.src = "https://via.placeholder.com/90";
                }
            } else {
                handleLogout();
            }
        } catch (error) {
            console.error('Network error:', error);
        }
    };

    // --- Photo Upload Logic ---
    const handlePhotoUpload = async (file) => {
        const formData = new FormData();
        formData.append('profileImage', file); 

        try {
            const response = await fetch(`${SERVER_URL}/api/profile/photo`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData 
            });

            if (response.ok) {
                const data = await response.json();
                profilePhotoElement.src = `${SERVER_URL}${data.path}?t=${new Date().getTime()}`; 
                alert('Profile picture updated!');
            } else {
                alert('Upload failed. Check server logs.');
            }
        } catch (error) {
            alert('Could not connect to the server for upload.');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '../login.html';
    };

    // --- Event Listeners ---
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    if (profilePhotoElement && photoUploadInput) {
        profilePhotoElement.addEventListener('click', () => photoUploadInput.click());
        photoUploadInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handlePhotoUpload(e.target.files[0]);
        });
    }

    fetchProfile();
});