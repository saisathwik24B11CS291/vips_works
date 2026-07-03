(function () {
  const STORAGE_KEY = "vips.language";
  const DEFAULT_LANGUAGE = "en";
  const neverTranslate = new Set(["VIPs"]);

  const digitMaps = {
    hi: "०१२३४५६७८९",
    mr: "०१२३४५६७८९",
    bn: "০১২৩৪৫৬৭৮৯",
    gu: "૦૧૨૩૪૫૬૭૮૯",
    te: "౦౧౨౩౪౫౬౭౮౯",
    ta: "௦௧௨௩௪௫௬௭௮௯",
    kn: "೦೧೨೩೪೫೬೭೮೯",
    ml: "൦൧൨൩൪൫൬൭൮൯",
    ur: "۰۱۲۳۴۵۶۷۸۹"
  };

  const languages = [
    { code: "en", nativeName: "English", englishName: "English" },
    { code: "hi", nativeName: "\u0939\u093f\u0928\u094d\u0926\u0940", englishName: "Hindi" },
    { code: "te", nativeName: "\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41", englishName: "Telugu" },
    { code: "ta", nativeName: "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd", englishName: "Tamil" },
    { code: "kn", nativeName: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1", englishName: "Kannada" },
    { code: "ml", nativeName: "\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02", englishName: "Malayalam" },
    { code: "mr", nativeName: "\u092e\u0930\u093e\u0920\u0940", englishName: "Marathi" },
    { code: "bn", nativeName: "\u09ac\u09be\u0982\u09b2\u09be", englishName: "Bengali" },
    { code: "gu", nativeName: "\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0", englishName: "Gujarati" },
    { code: "ur", nativeName: "\u0627\u0631\u062f\u0648", englishName: "Urdu" }
  ];

  const hi = {
    "Settings": "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938",
    "Username": "\u092f\u0942\u091c\u0930\u0928\u0947\u092e",
    "Choose Username": "\u092f\u0942\u091c\u0930\u0928\u0947\u092e \u091a\u0941\u0928\u0947\u0902",
    "Your Username": "\u0905\u092a\u0928\u093e \u092f\u0942\u091c\u0930\u0928\u0947\u092e",
    "Enter your username": "\u0905\u092a\u0928\u093e \u092f\u0942\u091c\u0930\u0928\u0947\u092e \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902",
    "Choose a username": "\u090f\u0915 \u092f\u0942\u091c\u0930\u0928\u0947\u092e \u091a\u0941\u0928\u0947\u0902",
    "Password": "\u092a\u093e\u0938\u0935\u0930\u094d\u0921",
    "Create Password": "\u092a\u093e\u0938\u0935\u0930\u094d\u0921 \u092c\u0928\u093e\u090f\u0902",
    "Create a password": "\u090f\u0915 \u092a\u093e\u0938\u0935\u0930\u094d\u0921 \u092c\u0928\u093e\u090f\u0902",
    "Email Address": "\u0908\u092e\u0947\u0932 \u092a\u0924\u093e",
    "Phone Number": "\u092b\u094b\u0928 \u0928\u0902\u092c\u0930",
    "Login": "\u0932\u0949\u0917\u093f\u0928",
    "Signup": "\u0938\u093e\u0907\u0928\u0905\u092a",
    "Dashboard": "\u0921\u0948\u0936\u092c\u094b\u0930\u094d\u0921",
    "Save": "\u0938\u0947\u0935",
    "Back": "\u0935\u093e\u092a\u0938",
    "Language": "\u092d\u093e\u0937\u093e",
    "App Language": "\u090f\u092a \u092d\u093e\u0937\u093e",
    "Choose the language used across VIPs.": "VIPs \u092e\u0947\u0902 \u0907\u0938\u094d\u0924\u0947\u092e\u093e\u0932 \u0939\u094b\u0928\u0947 \u0935\u093e\u0932\u0940 \u092d\u093e\u0937\u093e \u091a\u0941\u0928\u0947\u0902\u0964",
    "Select Language": "\u092d\u093e\u0937\u093e \u091a\u0941\u0928\u0947\u0902",
    "Language updated": "\u092d\u093e\u0937\u093e \u0905\u092a\u0921\u0947\u091f \u0939\u0941\u0908",
    "Settings updated": "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938 \u0905\u092a\u0921\u0947\u091f \u0939\u0941\u0908",
    "Settings updated successfully": "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938 \u0938\u092b\u0932\u0924\u093e\u092a\u0942\u0930\u094d\u0935\u0915 \u0905\u092a\u0921\u0947\u091f \u0939\u0941\u0908",
    "Error saving settings": "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938 \u0938\u0947\u0935 \u0928\u0939\u0940\u0902 \u0939\u0941\u0908",
    "Server connection failed": "\u0938\u0930\u094d\u0935\u0930 \u0915\u0928\u0947\u0915\u094d\u0936\u0928 \u0935\u093f\u092b\u0932",
    "Preferences": "\u092a\u0938\u0902\u0926",
    "Privacy & Connections": "\u0917\u094b\u092a\u0928\u0940\u092f\u0924\u093e \u0914\u0930 \u0915\u0928\u0947\u0915\u094d\u0936\u0928",
    "Follow to View Details": "\u0935\u093f\u0935\u0930\u0923 \u0926\u0947\u0916\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092b\u0949\u0932\u094b",
    "Workers must follow you to see Phone & Email": "\u092b\u094b\u0928 \u0914\u0930 \u0908\u092e\u0947\u0932 \u0926\u0947\u0916\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0935\u0930\u094d\u0915\u0930\u094d\u0938 \u0915\u094b \u0906\u092a\u0915\u094b \u092b\u0949\u0932\u094b \u0915\u0930\u0928\u093e \u0939\u094b\u0917\u093e",
    "Auto-Accept Follow Requests": "\u092b\u0949\u0932\u094b \u0905\u0928\u0941\u0930\u094b\u0927 \u0905\u092a\u0928\u0947-\u0906\u092a \u0938\u094d\u0935\u0940\u0915\u093e\u0930 \u0915\u0930\u0947\u0902",
    "Instantly accept worker follow requests": "\u0935\u0930\u094d\u0915\u0930 \u092b\u0949\u0932\u094b \u0905\u0928\u0941\u0930\u094b\u0927 \u0924\u0941\u0930\u0902\u0924 \u0938\u094d\u0935\u0940\u0915\u093e\u0930 \u0915\u0930\u0947\u0902",
    "Danger Zone": "\u0938\u093e\u0935\u0927\u093e\u0928\u0940 \u0915\u094d\u0937\u0947\u0924\u094d\u0930",
    "Account": "\u0916\u093e\u0924\u093e",
    "Delete Account": "\u0916\u093e\u0924\u093e \u0939\u091f\u093e\u090f\u0902",
    "Logout": "\u0932\u0949\u0917\u0906\u0909\u091f",
    "Are you sure you want to logout?": "\u0915\u094d\u092f\u093e \u0906\u092a \u0938\u091a \u092e\u0947\u0902 \u0932\u0949\u0917\u0906\u0909\u091f \u0915\u0930\u0928\u093e \u091a\u093e\u0939\u0924\u0947 \u0939\u0948\u0902?",
    "Notifications": "\u0938\u0942\u091a\u0928\u093e\u090f\u0902",
    "Notifications (Soon)": "\u0938\u0942\u091a\u0928\u093e\u090f\u0902 (\u091c\u0932\u094d\u0926)",
    "Push Notifications": "\u092a\u0941\u0936 \u0938\u0942\u091a\u0928\u093e\u090f\u0902",
    "Notification preferences updated": "\u0938\u0942\u091a\u0928\u093e \u092a\u0938\u0902\u0926 \u0905\u092a\u0921\u0947\u091f \u0939\u0941\u0908",
    "Jobs For You": "\u0906\u092a\u0915\u0947 \u0932\u093f\u090f \u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902",
    "Job": "\u0928\u094c\u0915\u0930\u0940",
    "Jobs": "\u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902",
    "Invited": "\u0906\u092e\u0902\u0924\u094d\u0930\u093f\u0924",
    "Posted": "\u092a\u094b\u0938\u094d\u091f \u0915\u0940 \u0917\u0908",
    "Search invited jobs": "\u0906\u092e\u0902\u0924\u094d\u0930\u093f\u0924 \u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902 \u0916\u094b\u091c\u0947\u0902",
    "Search posted jobs": "\u092a\u094b\u0938\u094d\u091f \u0915\u0940 \u0917\u0908 \u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902 \u0916\u094b\u091c\u0947\u0902",
    "Find Services": "\u0938\u0947\u0935\u093e\u090f\u0902 \u0916\u094b\u091c\u0947\u0902",
    "Post a Job": "\u0928\u094c\u0915\u0930\u0940 \u092a\u094b\u0938\u094d\u091f \u0915\u0930\u0947\u0902",
    "Post Job": "\u0928\u094c\u0915\u0930\u0940 \u092a\u094b\u0938\u094d\u091f \u0915\u0930\u0947\u0902",
    "Add Post": "\u092a\u094b\u0938\u094d\u091f \u091c\u094b\u0921\u093c\u0947\u0902",
    "Post a job": "\u0928\u094c\u0915\u0930\u0940 \u092a\u094b\u0938\u094d\u091f \u0915\u0930\u0947\u0902",
    "My Posted Jobs": "\u092e\u0947\u0930\u0940 \u092a\u094b\u0938\u094d\u091f \u0915\u0940 \u0917\u0908 \u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902",
    "Search for services or your posts...": "\u0938\u0947\u0935\u093e\u090f\u0902 \u092f\u093e \u0905\u092a\u0928\u0940 \u092a\u094b\u0938\u094d\u091f \u0916\u094b\u091c\u0947\u0902...",
    "Category": "\u0936\u094d\u0930\u0947\u0923\u0940",
    "Category Jobs": "\u0936\u094d\u0930\u0947\u0923\u0940 \u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902",
    "Category Title": "\u0936\u094d\u0930\u0947\u0923\u0940 \u0936\u0940\u0930\u094d\u0937\u0915",
    "General Labour": "\u0938\u093e\u092e\u093e\u0928\u094d\u092f \u092e\u091c\u0926\u0942\u0930\u0940",
    "General Labour / Helpers": "\u0938\u093e\u092e\u093e\u0928\u094d\u092f \u092e\u091c\u0926\u0942\u0930 / \u0938\u0939\u093e\u092f\u0915",
    "Loading": "\u0932\u094b\u0921\u093f\u0902\u0917",
    "Cleaning": "\u0938\u092b\u093e\u0908",
    "Helper": "\u0938\u0939\u093e\u092f\u0915",
    "Delivery": "\u0921\u093f\u0932\u0940\u0935\u0930\u0940",
    "Delivery & Transport": "\u0921\u093f\u0932\u0940\u0935\u0930\u0940 \u0914\u0930 \u092a\u0930\u093f\u0935\u0939\u0928",
    "Food & Restaurant": "\u092b\u0942\u0921 \u0914\u0930 \u0930\u0947\u0938\u094d\u091f\u094b\u0930\u0947\u0902\u091f",
    "Grocery Delivery": "\u0915\u093f\u0930\u093e\u0928\u093e \u0921\u093f\u0932\u0940\u0935\u0930\u0940",
    "Medical & Pharmaceutical": "\u092e\u0947\u0921\u093f\u0915\u0932 \u0914\u0930 \u092b\u093e\u0930\u094d\u092e\u093e",
    "Long-Distance Trucking": "\u0932\u0902\u092c\u0940 \u0926\u0942\u0930\u0940 \u091f\u094d\u0930\u0915\u093f\u0902\u0917",
    "Skilled Workers": "\u0915\u0941\u0936\u0932 \u0935\u0930\u094d\u0915\u0930\u094d\u0938",
    "skill": "\u0915\u094c\u0936\u0932",
    "Electrician": "\u0907\u0932\u0947\u0915\u094d\u091f\u094d\u0930\u0940\u0936\u093f\u092f\u0928",
    "Plumber": "\u092a\u094d\u0932\u0902\u092c\u0930",
    "Carpenter": "\u092c\u0922\u093c\u0908",
    "Welder": "\u0935\u0947\u0932\u094d\u0921\u0930",
    "Location": "\u0938\u094d\u0925\u093e\u0928",
    "Select Your City": "\u0905\u092a\u0928\u093e \u0936\u0939\u0930 \u091a\u0941\u0928\u0947\u0902",
    "Search city...": "\u0936\u0939\u0930 \u0916\u094b\u091c\u0947\u0902...",
    "Search for your city...": "\u0905\u092a\u0928\u093e \u0936\u0939\u0930 \u0916\u094b\u091c\u0947\u0902...",
    "Detect My Location": "\u092e\u0947\u0930\u093e \u0938\u094d\u0925\u093e\u0928 \u092a\u0939\u091a\u093e\u0928\u0947\u0902",
    "Detecting...": "\u092a\u0939\u091a\u093e\u0928\u093e \u091c\u093e \u0930\u0939\u093e \u0939\u0948...",
    "Select City": "\u0936\u0939\u0930 \u091a\u0941\u0928\u0947\u0902",
    "Apply": "\u0906\u0935\u0947\u0926\u0928 \u0915\u0930\u0947\u0902",
    "Applied": "\u0906\u0935\u0947\u0926\u0928 \u0915\u093f\u092f\u093e",
    "Accept": "\u0938\u094d\u0935\u0940\u0915\u093e\u0930",
    "Reject": "\u0905\u0938\u094d\u0935\u0940\u0915\u093e\u0930",
    "Accepted": "\u0938\u094d\u0935\u0940\u0915\u093e\u0930 \u0915\u093f\u092f\u093e",
    "Rejected": "\u0905\u0938\u094d\u0935\u0940\u0915\u093e\u0930 \u0915\u093f\u092f\u093e",
    "Cancel": "\u0930\u0926\u094d\u0926",
    "Undo": "\u0935\u093e\u092a\u0938",
    "View details": "\u0935\u093f\u0935\u0930\u0923 \u0926\u0947\u0916\u0947\u0902",
    "Close": "\u092c\u0902\u0926",
    "Status": "\u0938\u094d\u0925\u093f\u0924\u093f",
    "Budget": "\u092c\u091c\u091f",
    "Details": "\u0935\u093f\u0935\u0930\u0923",
    "Tasks": "\u0915\u093e\u0930\u094d\u092f",
    "Posted on": "\u092a\u094b\u0938\u094d\u091f \u0915\u093f\u092f\u093e",
    "No description provided.": "\u0915\u094b\u0908 \u0935\u093f\u0935\u0930\u0923 \u0928\u0939\u0940\u0902 \u0926\u093f\u092f\u093e\u0964",
    "Not provided": "\u0928\u0939\u0940\u0902 \u0926\u093f\u092f\u093e",
    "Not specified": "\u0928\u093f\u0930\u094d\u0926\u093f\u0937\u094d\u091f \u0928\u0939\u0940\u0902",
    "Not available": "\u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902",
    "Location not set": "\u0938\u094d\u0925\u093e\u0928 \u0938\u0947\u091f \u0928\u0939\u0940\u0902",
    "Budget not set": "\u092c\u091c\u091f \u0938\u0947\u091f \u0928\u0939\u0940\u0902",
    "Loading...": "\u0932\u094b\u0921 \u0939\u094b \u0930\u0939\u093e \u0939\u0948...",
    "Loading jobs...": "\u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902 \u0932\u094b\u0921 \u0939\u094b \u0930\u0939\u0940 \u0939\u0948\u0902...",
    "Failed to load jobs": "\u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902 \u0932\u094b\u0921 \u0928\u0939\u0940\u0902 \u0939\u0941\u0908\u0902",
    "Failed to load your jobs.": "\u0906\u092a\u0915\u0940 \u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902 \u0932\u094b\u0921 \u0928\u0939\u0940\u0902 \u0939\u0941\u0908\u0902\u0964",
    "You havent posted any jobs yet.": "\u0906\u092a\u0928\u0947 \u0905\u092d\u0940 \u0915\u094b\u0908 \u0928\u094c\u0915\u0930\u0940 \u092a\u094b\u0938\u094d\u091f \u0928\u0939\u0940\u0902 \u0915\u0940\u0964",
    "Profile": "\u092a\u094d\u0930\u094b\u092b\u093e\u0907\u0932",
    "Edit Profile": "\u092a\u094d\u0930\u094b\u092b\u093e\u0907\u0932 \u0938\u0902\u092a\u093e\u0926\u093f\u0924 \u0915\u0930\u0947\u0902",
    "Hired Jobs": "\u0939\u093e\u092f\u0930 \u0915\u0940 \u0917\u0908 \u0928\u094c\u0915\u0930\u093f\u092f\u093e\u0902",
    "Message": "\u0938\u0902\u0926\u0947\u0936",
    "Menu": "\u092e\u0947\u0928\u0942",
    "Follow": "\u092b\u0949\u0932\u094b",
    "Following": "\u092b\u0949\u0932\u094b \u0915\u0930 \u0930\u0939\u0947",
    "Followers": "\u092b\u0949\u0932\u094b\u0905\u0930\u094d\u0938",
    "open": "\u0916\u0941\u0932\u093e",
    "closed": "\u092c\u0902\u0926",
    "draft": "\u0921\u094d\u0930\u093e\u092b\u094d\u091f"
  };

  const te = {
    "Settings": "\u0c38\u0c46\u0c1f\u0c4d\u0c1f\u0c3f\u0c02\u0c17\u0c4d\u0c38\u0c4d",
    "Username": "\u0c2f\u0c42\u0c1c\u0c30\u0c4d\u0c28\u0c47\u0c2e\u0c4d",
    "Choose Username": "\u0c2f\u0c42\u0c1c\u0c30\u0c4d\u0c28\u0c47\u0c2e\u0c4d \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f",
    "Your Username": "\u0c2e\u0c40 \u0c2f\u0c42\u0c1c\u0c30\u0c4d\u0c28\u0c47\u0c2e\u0c4d",
    "Enter your username": "\u0c2e\u0c40 \u0c2f\u0c42\u0c1c\u0c30\u0c4d\u0c28\u0c47\u0c2e\u0c4d \u0c0e\u0c02\u0c1f\u0c30\u0c4d \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f",
    "Choose a username": "\u0c12\u0c15 \u0c2f\u0c42\u0c1c\u0c30\u0c4d\u0c28\u0c47\u0c2e\u0c4d \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f",
    "Password": "\u0c2a\u0c3e\u0c38\u0c4d\u0c35\u0c30\u0c4d\u0c21\u0c4d",
    "Create Password": "\u0c2a\u0c3e\u0c38\u0c4d\u0c35\u0c30\u0c4d\u0c21\u0c4d \u0c38\u0c43\u0c37\u0c4d\u0c1f\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Create a password": "\u0c12\u0c15 \u0c2a\u0c3e\u0c38\u0c4d\u0c35\u0c30\u0c4d\u0c21\u0c4d \u0c38\u0c43\u0c37\u0c4d\u0c1f\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Email Address": "\u0c08\u0c2e\u0c46\u0c2f\u0c3f\u0c32\u0c4d \u0c1a\u0c3f\u0c30\u0c41\u0c28\u0c3e\u0c2e\u0c3e",
    "Phone Number": "\u0c2b\u0c4b\u0c28\u0c4d \u0c28\u0c02\u0c2c\u0c30\u0c4d",
    "Login": "\u0c32\u0c3e\u0c17\u0c3f\u0c28\u0c4d",
    "Signup": "\u0c38\u0c48\u0c28\u0c2a\u0c4d",
    "Dashboard": "\u0c21\u0c3e\u0c37\u0c4d\u0c2c\u0c4b\u0c30\u0c4d\u0c21\u0c4d",
    "Save": "\u0c38\u0c47\u0c35\u0c4d",
    "Back": "\u0c35\u0c46\u0c28\u0c15\u0c4d\u0c15\u0c3f",
    "Language": "\u0c2d\u0c3e\u0c37",
    "App Language": "\u0c2f\u0c3e\u0c2a\u0c4d \u0c2d\u0c3e\u0c37",
    "Choose the language used across VIPs.": "VIPs \u0c05\u0c02\u0c24\u0c1f\u0c3e \u0c09\u0c2a\u0c2f\u0c4b\u0c17\u0c3f\u0c02\u0c1a\u0c47 \u0c2d\u0c3e\u0c37\u0c28\u0c41 \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f.",
    "Select Language": "\u0c2d\u0c3e\u0c37 \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f",
    "Language updated": "\u0c2d\u0c3e\u0c37 \u0c05\u0c2a\u0c4d\u0c21\u0c47\u0c1f\u0c4d \u0c05\u0c2f\u0c3f\u0c02\u0c26\u0c3f",
    "Settings updated": "\u0c38\u0c46\u0c1f\u0c4d\u0c1f\u0c3f\u0c02\u0c17\u0c4d\u0c38\u0c4d \u0c05\u0c2a\u0c4d\u0c21\u0c47\u0c1f\u0c4d \u0c05\u0c2f\u0c4d\u0c2f\u0c3e\u0c2f\u0c3f",
    "Settings updated successfully": "\u0c38\u0c46\u0c1f\u0c4d\u0c1f\u0c3f\u0c02\u0c17\u0c4d\u0c38\u0c4d \u0c35\u0c3f\u0c1c\u0c2f\u0c35\u0c02\u0c24\u0c02\u0c17\u0c3e \u0c05\u0c2a\u0c4d\u0c21\u0c47\u0c1f\u0c4d \u0c05\u0c2f\u0c4d\u0c2f\u0c3e\u0c2f\u0c3f",
    "Error saving settings": "\u0c38\u0c46\u0c1f\u0c4d\u0c1f\u0c3f\u0c02\u0c17\u0c4d\u0c38\u0c4d \u0c38\u0c47\u0c35\u0c4d \u0c15\u0c3e\u0c32\u0c47\u0c26\u0c41",
    "Server connection failed": "\u0c38\u0c30\u0c4d\u0c35\u0c30\u0c4d \u0c15\u0c28\u0c46\u0c15\u0c4d\u0c37\u0c28\u0c4d \u0c35\u0c3f\u0c2b\u0c32\u0c2e\u0c48\u0c02\u0c26\u0c3f",
    "Preferences": "\u0c2a\u0c4d\u0c30\u0c3f\u0c2b\u0c30\u0c46\u0c28\u0c4d\u0c38\u0c41\u0c32\u0c41",
    "Privacy & Connections": "\u0c17\u0c4b\u0c2a\u0c4d\u0c2f\u0c24 & \u0c15\u0c28\u0c46\u0c15\u0c4d\u0c37\u0c28\u0c4d\u0c38\u0c4d",
    "Follow to View Details": "\u0c35\u0c3f\u0c35\u0c30\u0c3e\u0c32\u0c41 \u0c1a\u0c42\u0c21\u0c1f\u0c3e\u0c28\u0c3f\u0c15\u0c3f \u0c2b\u0c3e\u0c32\u0c4b",
    "Workers must follow you to see Phone & Email": "\u0c2b\u0c4b\u0c28\u0c4d & \u0c08\u0c2e\u0c46\u0c2f\u0c3f\u0c32\u0c4d \u0c1a\u0c42\u0c21\u0c1f\u0c3e\u0c28\u0c3f\u0c15\u0c3f \u0c35\u0c30\u0c4d\u0c15\u0c30\u0c4d\u0c32\u0c41 \u0c2e\u0c3f\u0c2e\u0c4d\u0c2e\u0c32\u0c4d\u0c28\u0c3f \u0c2b\u0c3e\u0c32\u0c4b \u0c05\u0c35\u0c4d\u0c35\u0c3e\u0c32\u0c3f",
    "Auto-Accept Follow Requests": "\u0c2b\u0c3e\u0c32\u0c4b \u0c30\u0c3f\u0c15\u0c4d\u0c35\u0c46\u0c38\u0c4d\u0c1f\u0c41\u0c32\u0c28\u0c41 \u0c06\u0c1f\u0c4b\u0c2e\u0c47\u0c1f\u0c3f\u0c15\u0c4d\u0c17\u0c3e \u0c05\u0c02\u0c17\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Instantly accept worker follow requests": "\u0c35\u0c30\u0c4d\u0c15\u0c30\u0c4d \u0c2b\u0c3e\u0c32\u0c4b \u0c30\u0c3f\u0c15\u0c4d\u0c35\u0c46\u0c38\u0c4d\u0c1f\u0c41\u0c32\u0c28\u0c41 \u0c35\u0c46\u0c02\u0c1f\u0c28\u0c47 \u0c05\u0c02\u0c17\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Danger Zone": "\u0c1c\u0c3e\u0c17\u0c4d\u0c30\u0c24\u0c4d\u0c24 \u0c2a\u0c4d\u0c30\u0c3e\u0c02\u0c24\u0c02",
    "Account": "\u0c16\u0c3e\u0c24\u0c3e",
    "Delete Account": "\u0c16\u0c3e\u0c24\u0c3e\u0c28\u0c41 \u0c24\u0c4a\u0c32\u0c17\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Logout": "\u0c32\u0c3e\u0c17\u0c4c\u0c1f\u0c4d",
    "Are you sure you want to logout?": "\u0c2e\u0c40\u0c30\u0c41 \u0c28\u0c3f\u0c1c\u0c02\u0c17\u0c3e \u0c32\u0c3e\u0c17\u0c4c\u0c1f\u0c4d \u0c15\u0c3e\u0c35\u0c3e\u0c32\u0c28\u0c41\u0c15\u0c41\u0c02\u0c1f\u0c41\u0c28\u0c4d\u0c28\u0c3e\u0c30\u0c3e?",
    "Notifications": "\u0c28\u0c4b\u0c1f\u0c3f\u0c2b\u0c3f\u0c15\u0c47\u0c37\u0c28\u0c4d\u0c38\u0c4d",
    "Notifications (Soon)": "\u0c28\u0c4b\u0c1f\u0c3f\u0c2b\u0c3f\u0c15\u0c47\u0c37\u0c28\u0c4d\u0c38\u0c4d (\u0c24\u0c4d\u0c35\u0c30\u0c32\u0c4b)",
    "Push Notifications": "\u0c2a\u0c41\u0c37\u0c4d \u0c28\u0c4b\u0c1f\u0c3f\u0c2b\u0c3f\u0c15\u0c47\u0c37\u0c28\u0c4d\u0c38\u0c4d",
    "Notification preferences updated": "\u0c28\u0c4b\u0c1f\u0c3f\u0c2b\u0c3f\u0c15\u0c47\u0c37\u0c28\u0c4d \u0c2a\u0c4d\u0c30\u0c3f\u0c2b\u0c30\u0c46\u0c28\u0c4d\u0c38\u0c41\u0c32\u0c41 \u0c05\u0c2a\u0c4d\u0c21\u0c47\u0c1f\u0c4d \u0c05\u0c2f\u0c4d\u0c2f\u0c3e\u0c2f\u0c3f",
    "Jobs For You": "\u0c2e\u0c40 \u0c15\u0c4b\u0c38\u0c02 \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41",
    "Job": "\u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c02",
    "Jobs": "\u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41",
    "Invited": "\u0c06\u0c39\u0c4d\u0c35\u0c3e\u0c28\u0c3e\u0c32\u0c41",
    "Posted": "\u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c38\u0c3f\u0c28\u0c35\u0c3f",
    "Search invited jobs": "\u0c06\u0c39\u0c4d\u0c35\u0c3e\u0c28 \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41 \u0c35\u0c46\u0c24\u0c15\u0c02\u0c21\u0c3f",
    "Search posted jobs": "\u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c38\u0c3f\u0c28 \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41 \u0c35\u0c46\u0c24\u0c15\u0c02\u0c21\u0c3f",
    "Find Services": "\u0c38\u0c47\u0c35\u0c32\u0c41 \u0c15\u0c28\u0c41\u0c17\u0c4a\u0c28\u0c02\u0c21\u0c3f",
    "Post a Job": "\u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c02 \u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f",
    "Post Job": "\u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c02 \u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f",
    "Add Post": "\u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1c\u0c4b\u0c21\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Post a job": "\u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c02 \u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f",
    "My Posted Jobs": "\u0c28\u0c47\u0c28\u0c41 \u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c38\u0c3f\u0c28 \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41",
    "Search for services or your posts...": "\u0c38\u0c47\u0c35\u0c32\u0c41 \u0c32\u0c47\u0c26\u0c3e \u0c2e\u0c40 \u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c41\u0c32\u0c41 \u0c35\u0c46\u0c24\u0c15\u0c02\u0c21\u0c3f...",
    "Category": "\u0c35\u0c30\u0c4d\u0c17\u0c02",
    "Category Jobs": "\u0c35\u0c30\u0c4d\u0c17\u0c02 \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41",
    "Category Title": "\u0c35\u0c30\u0c4d\u0c17\u0c02 \u0c36\u0c40\u0c30\u0c4d\u0c37\u0c3f\u0c15",
    "General Labour": "\u0c38\u0c3e\u0c27\u0c3e\u0c30\u0c23 \u0c15\u0c3e\u0c30\u0c4d\u0c2e\u0c3f\u0c15\u0c41\u0c32\u0c41",
    "General Labour / Helpers": "\u0c38\u0c3e\u0c27\u0c3e\u0c30\u0c23 \u0c15\u0c3e\u0c30\u0c4d\u0c2e\u0c3f\u0c15\u0c41\u0c32\u0c41 / \u0c38\u0c39\u0c3e\u0c2f\u0c15\u0c41\u0c32\u0c41",
    "Loading": "\u0c32\u0c4b\u0c21\u0c3f\u0c02\u0c17\u0c4d",
    "Cleaning": "\u0c36\u0c41\u0c2d\u0c4d\u0c30\u0c02 \u0c1a\u0c47\u0c2f\u0c21\u0c02",
    "Helper": "\u0c38\u0c39\u0c3e\u0c2f\u0c15\u0c41\u0c21\u0c41",
    "Delivery": "\u0c21\u0c46\u0c32\u0c3f\u0c35\u0c30\u0c40",
    "Delivery & Transport": "\u0c21\u0c46\u0c32\u0c3f\u0c35\u0c30\u0c40 & \u0c30\u0c35\u0c3e\u0c23\u0c3e",
    "Food & Restaurant": "\u0c2b\u0c41\u0c21\u0c4d & \u0c30\u0c46\u0c38\u0c4d\u0c1f\u0c3e\u0c30\u0c46\u0c02\u0c1f\u0c4d",
    "Grocery Delivery": "\u0c15\u0c3f\u0c30\u0c3e\u0c23\u0c3e \u0c21\u0c46\u0c32\u0c3f\u0c35\u0c30\u0c40",
    "Medical & Pharmaceutical": "\u0c35\u0c48\u0c26\u0c4d\u0c2f & \u0c2b\u0c3e\u0c30\u0c4d\u0c2e\u0c3e",
    "Long-Distance Trucking": "\u0c26\u0c42\u0c30 \u0c1f\u0c4d\u0c30\u0c15\u0c4d\u0c15\u0c3f\u0c02\u0c17\u0c4d",
    "Skilled Workers": "\u0c28\u0c48\u0c2a\u0c41\u0c23\u0c4d\u0c2f\u0c02 \u0c09\u0c28\u0c4d\u0c28 \u0c35\u0c30\u0c4d\u0c15\u0c30\u0c4d\u0c32\u0c41",
    "skill": "\u0c28\u0c48\u0c2a\u0c41\u0c23\u0c4d\u0c2f\u0c02",
    "Electrician": "\u0c0e\u0c32\u0c46\u0c15\u0c4d\u0c1f\u0c4d\u0c30\u0c40\u0c37\u0c3f\u0c2f\u0c28\u0c4d",
    "Plumber": "\u0c2a\u0c4d\u0c32\u0c02\u0c2c\u0c30\u0c4d",
    "Carpenter": "\u0c15\u0c3e\u0c30\u0c4d\u0c2a\u0c46\u0c02\u0c1f\u0c30\u0c4d",
    "Welder": "\u0c35\u0c46\u0c32\u0c4d\u0c21\u0c30\u0c4d",
    "Location": "\u0c38\u0c4d\u0c25\u0c3e\u0c28\u0c02",
    "Select Your City": "\u0c2e\u0c40 \u0c28\u0c17\u0c30\u0c3e\u0c28\u0c4d\u0c28\u0c3f \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f",
    "Search city...": "\u0c28\u0c17\u0c30\u0c02 \u0c35\u0c46\u0c24\u0c15\u0c02\u0c21\u0c3f...",
    "Search for your city...": "\u0c2e\u0c40 \u0c28\u0c17\u0c30\u0c02 \u0c35\u0c46\u0c24\u0c15\u0c02\u0c21\u0c3f...",
    "Detect My Location": "\u0c28\u0c3e \u0c38\u0c4d\u0c25\u0c3e\u0c28\u0c02 \u0c17\u0c41\u0c30\u0c4d\u0c24\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Detecting...": "\u0c17\u0c41\u0c30\u0c4d\u0c24\u0c3f\u0c38\u0c4d\u0c24\u0c4b\u0c02\u0c26\u0c3f...",
    "Select City": "\u0c28\u0c17\u0c30\u0c02 \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f",
    "Apply": "\u0c05\u0c2a\u0c4d\u0c32\u0c48 \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f",
    "Applied": "\u0c05\u0c2a\u0c4d\u0c32\u0c48 \u0c05\u0c2f\u0c3f\u0c02\u0c26\u0c3f",
    "Accept": "\u0c05\u0c02\u0c17\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Reject": "\u0c24\u0c3f\u0c30\u0c38\u0c4d\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    "Accepted": "\u0c05\u0c02\u0c17\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c3e\u0c30\u0c41",
    "Rejected": "\u0c24\u0c3f\u0c30\u0c38\u0c4d\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c3e\u0c30\u0c41",
    "Cancel": "\u0c30\u0c26\u0c4d\u0c26\u0c41",
    "Undo": "\u0c35\u0c46\u0c28\u0c15\u0c4d\u0c15\u0c3f",
    "View details": "\u0c35\u0c3f\u0c35\u0c30\u0c3e\u0c32\u0c41 \u0c1a\u0c42\u0c21\u0c02\u0c21\u0c3f",
    "Close": "\u0c2e\u0c42\u0c38\u0c3f\u0c35\u0c47\u0c2f\u0c02\u0c21\u0c3f",
    "Status": "\u0c38\u0c4d\u0c25\u0c3f\u0c24\u0c3f",
    "Budget": "\u0c2c\u0c21\u0c4d\u0c1c\u0c46\u0c1f\u0c4d",
    "Details": "\u0c35\u0c3f\u0c35\u0c30\u0c3e\u0c32\u0c41",
    "Tasks": "\u0c2a\u0c28\u0c41\u0c32\u0c41",
    "Posted on": "\u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c38\u0c3f\u0c28 \u0c24\u0c47\u0c26\u0c40",
    "No description provided.": "\u0c35\u0c3f\u0c35\u0c30\u0c23 \u0c07\u0c35\u0c4d\u0c35\u0c32\u0c47\u0c26\u0c41.",
    "Not provided": "\u0c07\u0c35\u0c4d\u0c35\u0c32\u0c47\u0c26\u0c41",
    "Not specified": "\u0c2a\u0c47\u0c30\u0c4d\u0c15\u0c4a\u0c28\u0c32\u0c47\u0c26\u0c41",
    "Not available": "\u0c05\u0c02\u0c26\u0c41\u0c2c\u0c3e\u0c1f\u0c41\u0c32\u0c4b \u0c32\u0c47\u0c26\u0c41",
    "Location not set": "\u0c38\u0c4d\u0c25\u0c3e\u0c28\u0c02 \u0c38\u0c46\u0c1f\u0c4d \u0c15\u0c3e\u0c32\u0c47\u0c26\u0c41",
    "Budget not set": "\u0c2c\u0c21\u0c4d\u0c1c\u0c46\u0c1f\u0c4d \u0c38\u0c46\u0c1f\u0c4d \u0c15\u0c3e\u0c32\u0c47\u0c26\u0c41",
    "Loading...": "\u0c32\u0c4b\u0c21\u0c4d \u0c05\u0c35\u0c41\u0c24\u0c4b\u0c02\u0c26\u0c3f...",
    "Loading jobs...": "\u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41 \u0c32\u0c4b\u0c21\u0c4d \u0c05\u0c35\u0c41\u0c24\u0c41\u0c28\u0c4d\u0c28\u0c3e\u0c2f\u0c3f...",
    "Failed to load jobs": "\u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41 \u0c32\u0c4b\u0c21\u0c4d \u0c15\u0c3e\u0c32\u0c47\u0c26\u0c41",
    "Failed to load your jobs.": "\u0c2e\u0c40 \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41 \u0c32\u0c4b\u0c21\u0c4d \u0c15\u0c3e\u0c32\u0c47\u0c26\u0c41.",
    "You havent posted any jobs yet.": "\u0c2e\u0c40\u0c30\u0c41 \u0c07\u0c02\u0c15\u0c3e \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41 \u0c2a\u0c4b\u0c38\u0c4d\u0c1f\u0c4d \u0c1a\u0c47\u0c2f\u0c32\u0c47\u0c26\u0c41.",
    "Profile": "\u0c2a\u0c4d\u0c30\u0c4a\u0c2b\u0c48\u0c32\u0c4d",
    "Edit Profile": "\u0c2a\u0c4d\u0c30\u0c4a\u0c2b\u0c48\u0c32\u0c4d \u0c0e\u0c21\u0c3f\u0c1f\u0c4d \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f",
    "Hired Jobs": "\u0c39\u0c48\u0c30\u0c4d \u0c1a\u0c47\u0c38\u0c3f\u0c28 \u0c09\u0c26\u0c4d\u0c2f\u0c4b\u0c17\u0c3e\u0c32\u0c41",
    "Message": "\u0c2e\u0c46\u0c38\u0c47\u0c1c\u0c4d",
    "Menu": "\u0c2e\u0c46\u0c28\u0c42",
    "Follow": "\u0c2b\u0c3e\u0c32\u0c4b",
    "Following": "\u0c2b\u0c3e\u0c32\u0c4b \u0c05\u0c35\u0c41\u0c24\u0c41\u0c28\u0c4d\u0c28\u0c3e\u0c30\u0c41",
    "Followers": "\u0c2b\u0c3e\u0c32\u0c4b\u0c35\u0c30\u0c4d\u0c32\u0c41",
    "open": "\u0c13\u0c2a\u0c46\u0c28\u0c4d",
    "closed": "\u0c15\u0c4d\u0c32\u0c4b\u0c1c\u0c4d",
    "draft": "\u0c21\u0c4d\u0c30\u0c3e\u0c2b\u0c4d\u0c1f\u0c4d"
  };

  const translations = {
    hi,
    te,
    ta: { ...hi, "Language": "\u0bae\u0bca\u0bb4\u0bbf", "App Language": "\u0b86\u0baa\u0bcd \u0bae\u0bca\u0bb4\u0bbf", "Select Language": "\u0bae\u0bca\u0bb4\u0bbf\u0baf\u0bc8 \u0ba4\u0bc7\u0bb0\u0bcd\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0baf\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd" },
    kn: { ...hi, "Language": "\u0cad\u0cbe\u0cb7\u0cc6", "App Language": "\u0c86\u0caa\u0ccd \u0cad\u0cbe\u0cb7\u0cc6", "Select Language": "\u0cad\u0cbe\u0cb7\u0cc6 \u0c86\u0caf\u0ccd\u0c95\u0cc6\u0cae\u0cbe\u0ca1\u0cbf" },
    ml: { ...hi, "Language": "\u0d2d\u0d3e\u0d37", "App Language": "\u0d06\u0d2a\u0d4d\u0d2a\u0d4d \u0d2d\u0d3e\u0d37", "Select Language": "\u0d2d\u0d3e\u0d37 \u0d24\u0d3f\u0d30\u0d1e\u0d4d\u0d1e\u0d46\u0d1f\u0d41\u0d15\u0d4d\u0d15\u0d41\u0d15" },
    mr: { ...hi, "Language": "\u092d\u093e\u0937\u093e", "App Language": "\u0905\u0945\u092a \u092d\u093e\u0937\u093e", "Select Language": "\u092d\u093e\u0937\u093e \u0928\u093f\u0935\u0921\u093e" },
    bn: { ...hi, "Language": "\u09ad\u09be\u09b7\u09be", "App Language": "\u0985\u09cd\u09af\u09be\u09aa \u09ad\u09be\u09b7\u09be", "Select Language": "\u09ad\u09be\u09b7\u09be \u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u099a\u09a8 \u0995\u09b0\u09c1\u09a8" },
    gu: { ...hi, "Language": "\u0aad\u0abe\u0ab7\u0abe", "App Language": "\u0a8f\u0aaa \u0aad\u0abe\u0ab7\u0abe", "Select Language": "\u0aad\u0abe\u0ab7\u0abe \u0aaa\u0ab8\u0a82\u0aa6 \u0a95\u0ab0\u0acb" },
    ur: { ...hi, "Language": "\u0632\u0628\u0627\u0646", "App Language": "\u0627\u06cc\u067e \u0632\u0628\u0627\u0646", "Select Language": "\u0632\u0628\u0627\u0646 \u0645\u0646\u062a\u062e\u0628 \u06a9\u0631\u06cc\u06ba" }
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function currentLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("language");
    return languages.some((language) => language.code === stored) ? stored : DEFAULT_LANGUAGE;
  }

  function getDictionary(languageCode) {
    return translations[languageCode] || {};
  }

  function translateText(value, languageCode = currentLanguage()) {
    if (languageCode === DEFAULT_LANGUAGE) return value;
    const dictionary = getDictionary(languageCode);
    const normalized = normalizeText(value);
    if (!normalized || neverTranslate.has(normalized)) return value;
    if (dictionary[normalized]) return localizeDigits(dictionary[normalized], languageCode);

    const dynamicRules = [
      [/^(.+) Jobs$/, (_, name) => `${translateText(name, languageCode)} ${dictionary.Jobs || "Jobs"}`],
      [/^Show (\d+) jobs in other locations$/, (_, count) => `${count} ${dictionary.Jobs || "jobs"}`],
      [/^No jobs near "(.+)"\.$/, (_, place) => `${dictionary["No jobs available"] || "No jobs"} "${place}".`],
      [/^You are currently in (.+)$/, (_, place) => `${dictionary.Location || "Location"}: ${place}`],
      [/^previous location: (.+)$/i, (_, place) => `${dictionary.Location || "Location"}: ${place}`]
    ];

    for (const [pattern, replacer] of dynamicRules) {
      if (pattern.test(normalized)) return localizeDigits(normalized.replace(pattern, replacer), languageCode);
    }

    return localizeDigits(translateKnownWords(value, dictionary) || value, languageCode);
  }

  function localizeDigits(value, languageCode) {
    const digits = digitMaps[languageCode];
    if (!digits) return value;
    return String(value).replace(/\d/g, (digit) => digits[Number(digit)]);
  }

  function translateKnownWords(value, dictionary) {
    const safeWords = Object.keys(dictionary)
      .filter((key) => /^[A-Za-z][A-Za-z &/-]*$/.test(key) && key.length > 2 && !neverTranslate.has(key))
      .sort((a, b) => b.length - a.length);
    let output = value;
    let changed = false;
    safeWords.forEach((word) => {
      output = output.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "g"), () => {
        changed = true;
        return dictionary[word];
      });
    });
    return changed ? output : "";
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isUserDataElement(element) {
    const id = element.id || "";
    const className = typeof element.className === "string" ? element.className : "";
    return /username|email|phone|location|name|photo|avatar|price|rate|pay|amount|date|time/i.test(id) ||
      /username|email|phone|location|name|photo|avatar|price|rate|pay|amount|date|time/i.test(className);
  }

  function shouldSkipElement(element) {
    if (!element) return true;
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"].includes(element.tagName)) return true;
    if (element.closest("[data-no-translate], .notranslate")) return true;
    return isUserDataElement(element);
  }

  function translateNodeText(node, languageCode) {
    if (!node.nodeValue || !normalizeText(node.nodeValue)) return;
    if (!node.__vipsOriginalText) node.__vipsOriginalText = node.nodeValue;
    const translated = translateText(node.__vipsOriginalText, languageCode);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  function translateElementAttributes(element, languageCode) {
    ["placeholder", "title", "aria-label", "value"].forEach((attr) => {
      if (!element.hasAttribute || !element.hasAttribute(attr)) return;
      if (attr === "value" && !["BUTTON", "INPUT"].includes(element.tagName)) return;
      if (isUserDataElement(element)) return;
      const originalAttr = `data-vips-original-${attr}`;
      if (!element.hasAttribute(originalAttr)) {
        element.setAttribute(originalAttr, element.getAttribute(attr) || "");
      }
      element.setAttribute(attr, translateText(element.getAttribute(originalAttr), languageCode));
    });
  }

  function applyTranslations(root = document.body) {
    if (!root) return;
    const languageCode = currentLanguage();
    document.documentElement.lang = languageCode;
    document.documentElement.dir = languageCode === "ur" ? "rtl" : "ltr";
    if (document.title) document.title = translateText(document.title, languageCode);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return shouldSkipElement(element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });

    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateNodeText(node, languageCode);
      if (node.nodeType === Node.ELEMENT_NODE) translateElementAttributes(node, languageCode);
      node = walker.nextNode();
    }

    document.querySelectorAll("[data-language-select]").forEach((select) => {
      select.value = languageCode;
    });
  }

  let applying = false;
  function scheduleApply() {
    if (applying) return;
    applying = true;
    requestAnimationFrame(() => {
      applyTranslations();
      applying = false;
    });
  }

  function setLanguage(languageCode, options = {}) {
    if (!languages.some((language) => language.code === languageCode)) languageCode = DEFAULT_LANGUAGE;
    localStorage.setItem(STORAGE_KEY, languageCode);
    localStorage.setItem("language", languageCode);
    applyTranslations();
    window.dispatchEvent(new CustomEvent("vips:languagechange", { detail: { language: languageCode } }));

    if (options.persist !== false && localStorage.getItem("token")) {
      fetch(`${window.location.origin}/api/settings/language`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ language: languageCode })
      }).catch(() => {});
    }
  }

  function createLanguageOptions(select) {
    select.innerHTML = languages.map((language) => (
      `<option value="${language.code}">${language.nativeName} - ${language.englishName}</option>`
    )).join("");
    select.value = currentLanguage();
  }

  function initLanguageSelects() {
    document.querySelectorAll("[data-language-select]").forEach((select) => {
      if (!select.dataset.ready) {
        createLanguageOptions(select);
        select.dataset.ready = "true";
        select.addEventListener("change", () => {
          if (select.hasAttribute("data-language-deferred")) {
            window.dispatchEvent(new CustomEvent("vips:languagepending", { detail: { language: select.value } }));
            return;
          }
          setLanguage(select.value);
        });
      } else {
        select.value = currentLanguage();
      }
    });
  }

  async function hydrateLanguageFromServer() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${window.location.origin}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) return;
      const user = await response.json();
      const savedLanguage = user?.settings?.language || user?.language;
      const hasLocalLanguage = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("language");
      if (!hasLocalLanguage && savedLanguage && savedLanguage !== currentLanguage()) {
        localStorage.setItem(STORAGE_KEY, savedLanguage);
        localStorage.setItem("language", savedLanguage);
        applyTranslations();
      }
    } catch (err) {}
  }

  function init() {
    initLanguageSelects();
    applyTranslations();
    hydrateLanguageFromServer().finally(() => {
      initLanguageSelects();
      applyTranslations();
    });

    new MutationObserver(() => {
      initLanguageSelects();
      scheduleApply();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.VipsI18n = {
    languages,
    getLanguage: currentLanguage,
    setLanguage,
    translate: translateText,
    apply: applyTranslations,
    initLanguageSelects
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
