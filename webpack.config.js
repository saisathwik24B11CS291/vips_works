// C:\mongoDB\vips\server.js 

const express = require('express'); 
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken'); 
const multer = require('multer');
const path = require('path'); 
const fs = require('fs'); // Fixed: corrected 'requries' to 'require'

const app = express();
const port = 5000; 
const saltRounds = 10; 

// --- SECRETS & CONFIGURATION ---
const JWT_SECRET = 'mysecretkey';
const MONGODB_URI = "mongodb+srv://mss:mss@cluster0.jtryd8y.mongodb.net/vips_db?retryWrites=true&w=majority"; 

// --- MULTER CONFIGURATION ---
// Automatically create the uploads folder if it's missing
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); 
    },
    filename: function (req, file, cb) {
        const userId = req.user && req.user.id ? req.user.id : 'anon';
        cb(null, userId + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(cors({ origin: 'http://localhost:8084', credentials: true })); 
app.use(express.json());
app.use('/uploads', express.static(uploadDir)); 

// --- DATABASE MODEL ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '' },
    favorites: { type: Number, default: 0 }, 
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
});
const User = mongoose.model('User', userSchema);

// --- JWT AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) return res.status(401).json({ message: 'No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' }); 
        req.user = user; 
        next(); 
    });
};

// --- ROUTES (Aligned with profile.js /api prefix) ---

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = new User({ username, password: hashedPassword }); 
        await newUser.save();
        res.status(201).json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ message: 'Signup Error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, username: user.username });
    } catch (error) {
        res.status(500).json({ message: 'Login Error' });
    }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password'); 
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Fetch Error' });
    }
});

app.post('/api/profile/photo', authenticateToken, upload.single('profileImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    try {
        const photoPath = '/uploads/' + req.file.filename;
        await User.findByIdAndUpdate(req.user.id, { profilePicture: photoPath });
        res.json({ message: 'Updated!', path: photoPath });
    } catch (error) {
        res.status(500).json({ message: 'Upload Error' });
    }
});

// --- SERVER START ---
mongoose.connect(MONGODB_URI).then(() => {
    app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
});