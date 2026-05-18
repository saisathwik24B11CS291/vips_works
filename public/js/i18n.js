(function () {
  const STORAGE_KEY = "vips.language";
  const DEFAULT_LANGUAGE = "en";

  const languages = [
    { code: "en", nativeName: "English", englishName: "English" },
    { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
    { code: "te", nativeName: "తెలుగు", englishName: "Telugu" },
    { code: "ta", nativeName: "தமிழ்", englishName: "Tamil" },
    { code: "kn", nativeName: "ಕನ್ನಡ", englishName: "Kannada" },
    { code: "ml", nativeName: "മലയാളം", englishName: "Malayalam" },
    { code: "mr", nativeName: "मराठी", englishName: "Marathi" },
    { code: "bn", nativeName: "বাংলা", englishName: "Bengali" },
    { code: "gu", nativeName: "ગુજરાતી", englishName: "Gujarati" },
    { code: "ur", nativeName: "اردو", englishName: "Urdu" }
  ];

  const translations = {
    hi: {
      "Settings": "सेटिंग्स",
      "Back": "वापस",
      "Language": "भाषा",
      "App Language": "ऐप भाषा",
      "Choose the language used across VIPs.": "VIPs में इस्तेमाल होने वाली भाषा चुनें।",
      "Select Language": "भाषा चुनें",
      "Language updated": "भाषा अपडेट हुई",
      "Settings updated": "सेटिंग्स अपडेट हुईं",
      "Settings updated successfully": "सेटिंग्स सफलतापूर्वक अपडेट हुईं",
      "Error saving settings": "सेटिंग्स सेव करने में समस्या",
      "Server connection failed": "सर्वर कनेक्शन विफल",
      "Notifications": "सूचनाएं",
      "Notifications (Soon)": "सूचनाएं (जल्द)",
      "Push Notifications": "पुश सूचनाएं",
      "Notification preferences updated": "सूचना पसंद अपडेट हुई",
      "Logout": "लॉगआउट",
      "Are you sure you want to logout?": "क्या आप सच में लॉगआउट करना चाहते हैं?",
      "Privacy & Connections": "गोपनीयता और कनेक्शन",
      "Follow to View Details": "विवरण देखने के लिए फॉलो",
      "Workers must follow you to see Phone & Email": "फोन और ईमेल देखने के लिए वर्कर्स को आपको फॉलो करना होगा",
      "Auto-Accept Follow Requests": "फॉलो अनुरोध अपने-आप स्वीकार करें",
      "Instantly accept worker follow requests": "वर्कर फॉलो अनुरोध तुरंत स्वीकार करें",
      "Preferences": "पसंद",
      "Danger Zone": "सावधानी क्षेत्र",
      "Delete Account": "खाता हटाएं",
      "Jobs For You": "आपके लिए नौकरियां",
      "Invited": "आमंत्रित",
      "Posted": "पोस्ट की गई",
      "Search invited jobs": "आमंत्रित नौकरियां खोजें",
      "Search posted jobs": "पोस्ट की गई नौकरियां खोजें",
      "Loading...": "लोड हो रहा है...",
      "Loading jobs...": "नौकरियां लोड हो रही हैं...",
      "Loading invites...": "आमंत्रण लोड हो रहे हैं...",
      "Loading posted jobs...": "पोस्ट की गई नौकरियां लोड हो रही हैं...",
      "No job invites": "कोई नौकरी आमंत्रण नहीं",
      "No jobs available": "कोई नौकरी उपलब्ध नहीं",
      "Failed to load invites": "आमंत्रण लोड नहीं हुए",
      "Failed to load jobs": "नौकरियां लोड नहीं हुईं",
      "Accept": "स्वीकार करें",
      "Reject": "अस्वीकार करें",
      "Accepted": "स्वीकार किया गया",
      "Rejected": "अस्वीकार किया गया",
      "Cancel": "रद्द करें",
      "Undo": "पूर्ववत करें",
      "Apply": "आवेदन करें",
      "Applied": "आवेदन किया गया",
      "View details": "विवरण देखें",
      "Close": "बंद करें",
      "Employer": "नियोक्ता",
      "Location": "स्थान",
      "Pay": "भुगतान",
      "Budget": "बजट",
      "Details": "विवरण",
      "Tasks": "कार्य",
      "Status": "स्थिति",
      "Posted on": "पोस्ट किया गया",
      "No description provided.": "कोई विवरण नहीं दिया गया।",
      "Not provided": "नहीं दिया गया",
      "Not specified": "निर्दिष्ट नहीं",
      "Not available": "उपलब्ध नहीं",
      "Select Your City": "अपना शहर चुनें",
      "Search for your city...": "अपना शहर खोजें...",
      "Search city...": "शहर खोजें...",
      "Detect My Location": "मेरा स्थान पहचानें",
      "Detecting...": "पहचाना जा रहा है...",
      "Select City": "शहर चुनें",
      "Find Services": "सेवाएं खोजें",
      "Post a Job": "नौकरी पोस्ट करें",
      "Add Post": "पोस्ट जोड़ें",
      "Post a job": "नौकरी पोस्ट करें",
      "My Posted Jobs": "मेरी पोस्ट की गई नौकरियां",
      "Post Job": "नौकरी पोस्ट करें",
      "Search for services or your posts...": "सेवाएं या अपनी पोस्ट खोजें...",
      "General Labour / Helpers": "सामान्य मजदूर / सहायक",
      "Delivery & Transport": "डिलीवरी और परिवहन",
      "Skilled Workers": "कुशल वर्कर्स",
      "Category Jobs": "श्रेणी नौकरियां",
      "Profile": "प्रोफाइल",
      "Worker Profile": "वर्कर प्रोफाइल",
      "Employer Profile": "नियोक्ता प्रोफाइल",
      "Edit Profile": "प्रोफाइल संपादित करें",
      "Hired Jobs": "हायर की गई नौकरियां",
      "Menu": "मेनू",
      "Follow": "फॉलो करें",
      "Following": "फॉलो कर रहे हैं",
      "Followers": "फॉलोअर्स",
      "Message": "संदेश",
      "Requested": "अनुरोध भेजा गया",
      "Follow to Contact": "संपर्क के लिए फॉलो करें",
      "Message Worker": "वर्कर को संदेश भेजें",
      "Phone": "फोन",
      "Email": "ईमेल",
      "Exp": "अनुभव",
      "Hourly Rate": "प्रति घंटा दर",
      "About Me": "मेरे बारे में",
      "About": "बारे में",
      "Portfolio": "पोर्टफोलियो",
      "Portfolio Work": "पोर्टफोलियो काम",
      "Add Project": "प्रोजेक्ट जोड़ें",
      "Manage Expertise": "विशेषज्ञता संभालें",
      "Expertise": "विशेषज्ञता",
      "Manage": "संभालें",
      "No bio available.": "बायो उपलब्ध नहीं।",
      "No categories set.": "कोई श्रेणी सेट नहीं।",
      "No work added yet.": "अभी कोई काम नहीं जोड़ा गया।",
      "No projects showcased.": "कोई प्रोजेक्ट नहीं दिखाया गया।",
      "Project": "प्रोजेक्ट",
      "New Project": "नया प्रोजेक्ट",
      "Delete": "हटाएं",
      "Deleting...": "हटाया जा रहा है...",
      "Delete Project?": "प्रोजेक्ट हटाएं?",
      "Delete Project": "प्रोजेक्ट हटाएं",
      "Add Media": "मीडिया जोड़ें",
      "Replace Media": "मीडिया बदलें",
      "Delete Media": "मीडिया हटाएं",
      "Search people...": "लोग खोजें...",
      "Workers": "वर्कर्स",
      "Employers": "नियोक्ता",
      "View Profile": "प्रोफाइल देखें",
      "Unfollow": "अनफॉलो",
      "Remove": "हटाएं",
      "Follow Back": "वापस फॉलो करें",
      "Nothing here yet.": "यहां अभी कुछ नहीं है।",
      "Working...": "काम हो रहा है...",
      "Load failed": "लोड विफल",
      "VIP Verified Worker": "VIP सत्यापित वर्कर",
      "Professional Specialist": "प्रोफेशनल विशेषज्ञ",
      "Hidden": "छिपा हुआ",
      "Location not set": "स्थान सेट नहीं",
      "Budget not set": "बजट सेट नहीं",
      "You haven’t posted any jobs yet.": "आपने अभी कोई नौकरी पोस्ट नहीं की है।",
      "Failed to load your jobs.": "आपकी नौकरियां लोड नहीं हुईं।"
    },
    te: {
      "Settings": "సెట్టింగ్స్",
      "Back": "వెనక్కి",
      "Language": "భాష",
      "App Language": "యాప్ భాష",
      "Choose the language used across VIPs.": "VIPs అంతటా ఉపయోగించే భాషను ఎంచుకోండి.",
      "Select Language": "భాష ఎంచుకోండి",
      "Language updated": "భాష అప్డేట్ అయింది",
      "Settings updated": "సెట్టింగ్స్ అప్డేట్ అయ్యాయి",
      "Settings updated successfully": "సెట్టింగ్స్ విజయవంతంగా అప్డేట్ అయ్యాయి",
      "Error saving settings": "సెట్టింగ్స్ సేవ్ చేయడంలో సమస్య",
      "Server connection failed": "సర్వర్ కనెక్షన్ విఫలమైంది",
      "Notifications": "నోటిఫికేషన్స్",
      "Notifications (Soon)": "నోటిఫికేషన్స్ (త్వరలో)",
      "Push Notifications": "పుష్ నోటిఫికేషన్స్",
      "Notification preferences updated": "నోటిఫికేషన్ ప్రిఫరెన్సులు అప్డేట్ అయ్యాయి",
      "Logout": "లాగౌట్",
      "Are you sure you want to logout?": "మీరు నిజంగా లాగౌట్ కావాలనుకుంటున్నారా?",
      "Privacy & Connections": "గోప్యత & కనెక్షన్స్",
      "Follow to View Details": "వివరాలు చూడటానికి ఫాలో",
      "Workers must follow you to see Phone & Email": "ఫోన్ & ఈమెయిల్ చూడటానికి వర్కర్లు మిమ్మల్ని ఫాలో అవ్వాలి",
      "Auto-Accept Follow Requests": "ఫాలో రిక్వెస్టులను ఆటోమేటిక్‌గా అంగీకరించండి",
      "Instantly accept worker follow requests": "వర్కర్ ఫాలో రిక్వెస్టులను వెంటనే అంగీకరించండి",
      "Preferences": "ప్రిఫరెన్సులు",
      "Danger Zone": "జాగ్రత్త ప్రాంతం",
      "Delete Account": "ఖాతాను తొలగించండి",
      "Jobs For You": "మీ కోసం ఉద్యోగాలు",
      "Invited": "ఆహ్వానాలు",
      "Posted": "పోస్ట్ చేసినవి",
      "Search invited jobs": "ఆహ్వాన ఉద్యోగాలు వెతకండి",
      "Search posted jobs": "పోస్ట్ చేసిన ఉద్యోగాలు వెతకండి",
      "Loading...": "లోడ్ అవుతోంది...",
      "Loading jobs...": "ఉద్యోగాలు లోడ్ అవుతున్నాయి...",
      "Loading invites...": "ఆహ్వానాలు లోడ్ అవుతున్నాయి...",
      "Loading posted jobs...": "పోస్ట్ చేసిన ఉద్యోగాలు లోడ్ అవుతున్నాయి...",
      "No job invites": "ఉద్యోగ ఆహ్వానాలు లేవు",
      "No jobs available": "ఉద్యోగాలు అందుబాటులో లేవు",
      "Failed to load invites": "ఆహ్వానాలు లోడ్ కాలేదు",
      "Failed to load jobs": "ఉద్యోగాలు లోడ్ కాలేదు",
      "Accept": "అంగీకరించండి",
      "Reject": "తిరస్కరించండి",
      "Accepted": "అంగీకరించారు",
      "Rejected": "తిరస్కరించారు",
      "Cancel": "రద్దు",
      "Undo": "రద్దును వెనక్కి తీసుకోండి",
      "Apply": "అప్లై చేయండి",
      "Applied": "అప్లై అయ్యింది",
      "View details": "వివరాలు చూడండి",
      "Close": "మూసివేయండి",
      "Employer": "నియామకుడు",
      "Location": "స్థానం",
      "Pay": "చెల్లింపు",
      "Budget": "బడ్జెట్",
      "Details": "వివరాలు",
      "Tasks": "పనులు",
      "Status": "స్థితి",
      "Posted on": "పోస్ట్ చేసిన తేదీ",
      "No description provided.": "వివరణ ఇవ్వలేదు.",
      "Not provided": "ఇవ్వలేదు",
      "Not specified": "పేర్కొనలేదు",
      "Not available": "అందుబాటులో లేదు",
      "Select Your City": "మీ నగరాన్ని ఎంచుకోండి",
      "Search for your city...": "మీ నగరాన్ని వెతకండి...",
      "Search city...": "నగరం వెతకండి...",
      "Detect My Location": "నా స్థానం గుర్తించండి",
      "Detecting...": "గుర్తిస్తోంది...",
      "Select City": "నగరం ఎంచుకోండి",
      "Find Services": "సేవలు కనుగొనండి",
      "Post a Job": "ఉద్యోగం పోస్ట్ చేయండి",
      "Add Post": "పోస్ట్ జోడించండి",
      "Post a job": "ఉద్యోగం పోస్ట్ చేయండి",
      "My Posted Jobs": "నేను పోస్ట్ చేసిన ఉద్యోగాలు",
      "Post Job": "ఉద్యోగం పోస్ట్ చేయండి",
      "Search for services or your posts...": "సేవలు లేదా మీ పోస్టులు వెతకండి...",
      "General Labour / Helpers": "సాధారణ కార్మికులు / సహాయకులు",
      "Delivery & Transport": "డెలివరీ & రవాణా",
      "Skilled Workers": "నైపుణ్యం ఉన్న వర్కర్లు",
      "Category Jobs": "వర్గం ఉద్యోగాలు",
      "Profile": "ప్రొఫైల్",
      "Worker Profile": "వర్కర్ ప్రొఫైల్",
      "Employer Profile": "నియామకుడి ప్రొఫైల్",
      "Edit Profile": "ప్రొఫైల్ ఎడిట్ చేయండి",
      "Hired Jobs": "హైర్ చేసిన ఉద్యోగాలు",
      "Menu": "మెనూ",
      "Follow": "ఫాలో",
      "Following": "ఫాలో అవుతున్నారు",
      "Followers": "ఫాలోవర్లు",
      "Message": "మెసేజ్",
      "Requested": "రిక్వెస్ట్ పంపారు",
      "Follow to Contact": "సంప్రదించడానికి ఫాలో చేయండి",
      "Message Worker": "వర్కర్‌కు మెసేజ్ పంపండి",
      "Phone": "ఫోన్",
      "Email": "ఈమెయిల్",
      "Exp": "అనుభవం",
      "Hourly Rate": "గంటకు రేటు",
      "About Me": "నా గురించి",
      "About": "గురించి",
      "Portfolio": "పోర్ట్‌ఫోలియో",
      "Portfolio Work": "పోర్ట్‌ఫోలియో పని",
      "Add Project": "ప్రాజెక్ట్ జోడించండి",
      "Manage Expertise": "నైపుణ్యాలను నిర్వహించండి",
      "Expertise": "నైపుణ్యం",
      "Manage": "నిర్వహించండి",
      "No bio available.": "బయో అందుబాటులో లేదు.",
      "No categories set.": "వర్గాలు సెట్ చేయలేదు.",
      "No work added yet.": "ఇంకా పని జోడించలేదు.",
      "No projects showcased.": "ప్రాజెక్టులు చూపించలేదు.",
      "Project": "ప్రాజెక్ట్",
      "New Project": "కొత్త ప్రాజెక్ట్",
      "Delete": "తొలగించండి",
      "Deleting...": "తొలగిస్తోంది...",
      "Delete Project?": "ప్రాజెక్ట్ తొలగించాలా?",
      "Delete Project": "ప్రాజెక్ట్ తొలగించండి",
      "Add Media": "మీడియా జోడించండి",
      "Replace Media": "మీడియా మార్చండి",
      "Delete Media": "మీడియా తొలగించండి",
      "Search people...": "వ్యక్తులను వెతకండి...",
      "Workers": "వర్కర్లు",
      "Employers": "నియామకులు",
      "View Profile": "ప్రొఫైల్ చూడండి",
      "Unfollow": "అన్‌ఫాలో",
      "Remove": "తొలగించండి",
      "Follow Back": "తిరిగి ఫాలో చేయండి",
      "Nothing here yet.": "ఇక్కడ ఇంకా ఏమీ లేదు.",
      "Working...": "పని జరుగుతోంది...",
      "Load failed": "లోడ్ విఫలమైంది",
      "VIP Verified Worker": "VIP ధృవీకరించిన వర్కర్",
      "Professional Specialist": "ప్రొఫెషనల్ నిపుణుడు",
      "Hidden": "దాచబడింది",
      "Location not set": "స్థానం సెట్ కాలేదు",
      "Budget not set": "బడ్జెట్ సెట్ కాలేదు",
      "You haven’t posted any jobs yet.": "మీరు ఇంకా ఉద్యోగాలు పోస్ట్ చేయలేదు.",
      "Failed to load your jobs.": "మీ ఉద్యోగాలు లోడ్ కాలేదు."
    }
  };

  const fallbackCopies = {
    ta: {
      "Language": "மொழி",
      "App Language": "ஆப் மொழி",
      "Select Language": "மொழியை தேர்ந்தெடுக்கவும்",
      "Settings": "அமைப்புகள்",
      "Back": "பின்",
      "Logout": "வெளியேறு",
      "Jobs For You": "உங்களுக்கான வேலைகள்",
      "Find Services": "சேவைகளை தேடுங்கள்",
      "Post a Job": "வேலை பதிவிடுங்கள்",
      "Profile": "சுயவிவரம்",
      "Location": "இடம்",
      "Phone": "தொலைபேசி",
      "Email": "மின்னஞ்சல்",
      "Close": "மூடு",
      "Cancel": "ரத்து",
      "Apply": "விண்ணப்பிக்கவும்"
    },
    kn: {
      "Language": "ಭಾಷೆ",
      "App Language": "ಆಪ್ ಭಾಷೆ",
      "Select Language": "ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ",
      "Settings": "ಸೆಟ್ಟಿಂಗ್ಸ್",
      "Back": "ಹಿಂದೆ",
      "Logout": "ಲಾಗೌಟ್",
      "Jobs For You": "ನಿಮಗಾಗಿ ಉದ್ಯೋಗಗಳು",
      "Find Services": "ಸೇವೆಗಳು ಹುಡುಕಿ",
      "Post a Job": "ಉದ್ಯೋಗ ಪೋಸ್ಟ್ ಮಾಡಿ",
      "Profile": "ಪ್ರೊಫೈಲ್",
      "Location": "ಸ್ಥಳ",
      "Phone": "ಫೋನ್",
      "Email": "ಇಮೇಲ್",
      "Close": "ಮುಚ್ಚಿ",
      "Cancel": "ರದ್ದು",
      "Apply": "ಅರ್ಜಿ ಹಾಕಿ"
    },
    ml: {
      "Language": "ഭാഷ",
      "App Language": "ആപ്പ് ഭാഷ",
      "Select Language": "ഭാഷ തിരഞ്ഞെടുക്കുക",
      "Settings": "ക്രമീകരണങ്ങൾ",
      "Back": "തിരികെ",
      "Logout": "ലോഗൗട്ട്",
      "Jobs For You": "നിങ്ങൾക്കുള്ള ജോലികൾ",
      "Find Services": "സേവനങ്ങൾ കണ്ടെത്തുക",
      "Post a Job": "ജോലി പോസ്റ്റ് ചെയ്യുക",
      "Profile": "പ്രൊഫൈൽ",
      "Location": "സ്ഥലം",
      "Phone": "ഫോൺ",
      "Email": "ഇമെയിൽ",
      "Close": "അടയ്‌ക്കുക",
      "Cancel": "റദ്ദാക്കുക",
      "Apply": "അപേക്ഷിക്കുക"
    },
    mr: {
      "Language": "भाषा",
      "App Language": "अॅप भाषा",
      "Select Language": "भाषा निवडा",
      "Settings": "सेटिंग्स",
      "Back": "मागे",
      "Logout": "लॉगआउट",
      "Jobs For You": "तुमच्यासाठी नोकऱ्या",
      "Find Services": "सेवा शोधा",
      "Post a Job": "नोकरी पोस्ट करा",
      "Profile": "प्रोफाइल",
      "Location": "ठिकाण",
      "Phone": "फोन",
      "Email": "ईमेल",
      "Close": "बंद",
      "Cancel": "रद्द",
      "Apply": "अर्ज करा"
    },
    bn: {
      "Language": "ভাষা",
      "App Language": "অ্যাপ ভাষা",
      "Select Language": "ভাষা নির্বাচন করুন",
      "Settings": "সেটিংস",
      "Back": "ফিরে যান",
      "Logout": "লগআউট",
      "Jobs For You": "আপনার জন্য কাজ",
      "Find Services": "সেবা খুঁজুন",
      "Post a Job": "কাজ পোস্ট করুন",
      "Profile": "প্রোফাইল",
      "Location": "অবস্থান",
      "Phone": "ফোন",
      "Email": "ইমেল",
      "Close": "বন্ধ",
      "Cancel": "বাতিল",
      "Apply": "আবেদন করুন"
    },
    gu: {
      "Language": "ભાષા",
      "App Language": "એપ ભાષા",
      "Select Language": "ભાષા પસંદ કરો",
      "Settings": "સેટિંગ્સ",
      "Back": "પાછળ",
      "Logout": "લોગઆઉટ",
      "Jobs For You": "તમારા માટે નોકરીઓ",
      "Find Services": "સેવાઓ શોધો",
      "Post a Job": "નોકરી પોસ્ટ કરો",
      "Profile": "પ્રોફાઇલ",
      "Location": "સ્થાન",
      "Phone": "ફોન",
      "Email": "ઈમેલ",
      "Close": "બંધ",
      "Cancel": "રદ",
      "Apply": "અરજી કરો"
    },
    ur: {
      "Language": "زبان",
      "App Language": "ایپ زبان",
      "Select Language": "زبان منتخب کریں",
      "Settings": "سیٹنگز",
      "Back": "واپس",
      "Logout": "لاگ آؤٹ",
      "Jobs For You": "آپ کے لیے نوکریاں",
      "Find Services": "سروسز تلاش کریں",
      "Post a Job": "نوکری پوسٹ کریں",
      "Profile": "پروفائل",
      "Location": "مقام",
      "Phone": "فون",
      "Email": "ای میل",
      "Close": "بند کریں",
      "Cancel": "منسوخ",
      "Apply": "درخواست دیں"
    }
  };

  Object.keys(fallbackCopies).forEach((code) => {
    translations[code] = { ...translations.hi, ...fallbackCopies[code] };
  });

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
    if (!normalized) return value;
    if (dictionary[normalized]) return dictionary[normalized];

    const dynamicRules = [
      [/^(.+) Jobs$/, (_, name) => `${name} ${dictionary.Jobs || "Jobs"}`],
      [/^Show (\d+) jobs in other locations$/, (_, count) => `${count} ${dictionary["jobs in other locations"] || "अन्य स्थानों की नौकरियां दिखाएं"}`],
      [/^No jobs near "(.+)"\.$/, (_, place) => `${dictionary["No jobs near"] || "आस-पास कोई नौकरी नहीं"} "${place}".`],
      [/^You are currently in (.+)$/, (_, place) => `${dictionary["You are currently in"] || "आप अभी यहां हैं"} ${place}`],
      [/^previous location: (.+)$/i, (_, place) => `${dictionary["previous location"] || "पिछला स्थान"}: ${place}`],
      [/^Delete (.+)\?$/, (_, item) => `${item} ${dictionary["Delete?"] || "हटाएं?"}`]
    ];

    for (const [pattern, replacer] of dynamicRules) {
      if (pattern.test(normalized)) return normalized.replace(pattern, replacer);
    }

    return value;
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
      const originalAttr = `data-vips-original-${attr}`;
      if (!element.hasAttribute(originalAttr)) {
        element.setAttribute(originalAttr, element.getAttribute(attr) || "");
      }
      element.setAttribute(attr, translateText(element.getAttribute(originalAttr), languageCode));
    });
  }

  function shouldSkipElement(element) {
    return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"].includes(element.tagName);
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
        if (!element || shouldSkipElement(element.closest("script,style,noscript,textarea,code,pre") || element)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
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

  let observer;
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
        select.addEventListener("change", () => setLanguage(select.value));
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

    observer = new MutationObserver(() => {
      initLanguageSelects();
      scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
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
