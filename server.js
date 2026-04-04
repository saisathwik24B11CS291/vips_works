require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const express = require('express'); 
const mongoose = require('mongoose');
const cors = require('cors'); 
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken'); 
const multer = require('multer');
const path = require('path'); 
const fs = require('fs'); 
const JobInvite = require("./models/JobInvite");
const JobApplication = require("./models/JobApplication");
const helmet = require('helmet');
const morgan = require('morgan');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_me_in_env') {
    console.warn('⚠️  Set a strong JWT_SECRET in .env before production.');
}
// Change this in your server.js route:
// DELETE the old authMiddleware block and replace with this:
 // Import the shared logic
// 1. In your Login Route


// 2. In your authMiddleware


// --- MODELS ---
const Worker = require('./models/Worker'); 
const Message = require('./models/Message');
const Post = require('./models/Post'); 
const Employer = require('./models/Employer'); 

const app = express();
const port = process.env.PORT || 5000; 
const saltRounds = 10; 

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/vips_db"; 

// Mail + Google clients
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const mailTransporter = (() => {
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT,10) : 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            } : undefined
        });
    }
    return null;
})();


// ... (Imports like express, mongoose, etc.)

// 1. DEFINE IT ONLY ONCE
// 1. Define it near the top of server.js
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token provided" });

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Search both collections
        const user = await Employer.findById(decoded.id) || await Worker.findById(decoded.id);
        
        if (!user) return res.status(401).json({ message: "User not found" });

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ message: "Session expired" });
    }
};

// 2. Export it so workerRoutes.js and employerRoutes.js can use it
module.exports = authMiddleware;

// 2. DO NOT redeclare it later in the file!
// If you have: const authMiddleware = require('./middleware/auth'); 
// DELETE that line because you defined it above.

// ... (Rest of your routes and app.listen)

// --- MIDDLEWARE ---
// --- SECURITY MIDDLEWARE ---
app.disable('x-powered-by');
const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(o=>o.trim());
app.use(cors({
    origin: (origin, cb)=>{
        if(!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)){
            return cb(null, true);
        }
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use((req,res,next)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','SAMEORIGIN');
    res.setHeader('Permissions-Policy','geolocation=(), microphone=(), camera=()');
    next();
});
// helmet with relaxed CSP (to avoid breaking inline scripts)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
}));
// request logging (skip noisy assets)
app.use(morgan('combined', {
    skip: (req)=> req.url.startsWith('/uploads') || req.url.startsWith('/static')
}));
// basic rate limiter (in-memory)
const rateStore = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '100',10);
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '60000',10);
app.use((req,res,next)=>{
    const ip = req.ip || req.connection.remoteAddress || 'global';
    const now = Date.now();
    const entry = rateStore.get(ip) || {count:0, start:now};
    if(now - entry.start > RATE_WINDOW_MS){
        entry.count = 0; entry.start = now;
    }
    entry.count += 1;
    rateStore.set(ip, entry);
    if(entry.count > RATE_LIMIT){
        return res.status(429).json({message:"Too many requests"});
    }
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// sanitize request body/query to strip $ keys / dots
function sanitize(obj){
    if(!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(k=>{
        if(k.startsWith('$') || k.includes('.')){
            delete obj[k];
            return;
        }
        sanitize(obj[k]);
    });
}
app.use((req,res,next)=>{
    sanitize(req.body);
    sanitize(req.query);
    next();
});

// health check
app.get('/health', (req,res)=> res.json({status:'ok', time:new Date().toISOString()}));
// expose Google client id to frontend (no secrets)
app.get('/api/config/google-client', (req,res)=>{
    if(!GOOGLE_CLIENT_ID){
        return res.status(503).json({ clientId: null, message: 'Google login not configured' });
    }
    res.json({ clientId: GOOGLE_CLIENT_ID });
});
// Add this to your main server file (e.g., server.js)

// --- STATIC FILES ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir)); 
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));

// --- ✅ MULTER CONFIGURATION (Fixes "upload is not defined") ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- ROUTES IMPORT ---
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workerRoutes');
const employerRoutes = require('./routes/employerRoutes');
const messageRoutes = require('./routes/message');

// --- AUTH ROUTES ---
// Unified Signup: Handles both Worker and Employer safely
app.post('/api/auth/signup', async (req, res) => {
    const { role, username, email, password, phone, businessCategory } = req.body;

    try {
        if (!username || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const existingUser = await Worker.findOne({ email }) || await Employer.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        if (role === 'employer') {
            const newEmployer = new Employer({ 
                username, 
                email, 
                password: hashedPassword, 
                phone, 
                role,
                companyName: username,
                settings: { followToView: false, autoAccept: true },
                // Maps your frontend selection (e.g., Construction) to the DB field
                mainCategory: businessCategory || "General Business"
            });
            // This call triggers the pre-save middleware in Employer.js
            await newEmployer.save(); 
        } else {
            const newWorker = new Worker({ username, email, password: hashedPassword, phone, role });
            await newWorker.save();
        } 

        res.status(201).json({ message: "Success" });
    } catch (err) { 
        console.error("Signup Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});
// Unified Login: Searches across both collections
// Unified Login Logic in server.js

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const SECRET = JWT_SECRET;

    try {
        // Search both collections
        let user = await Worker.findOne({ username }) || await Employer.findOne({ username });
        
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate the token
        const token = jwt.sign({ id: user._id, role: user.role }, SECRET, { expiresIn: '24h' });

        res.json({ token, role: user.role, userId: user._id, username: user.username });
    } catch (error) { 
    console.log("FULL LOGIN ERROR:", error); // This shows why it's failing in your terminal
    res.status(500).json({ message: 'Login Error' }); 
}
});

// Google Sign-in
app.post('/api/auth/google', async (req, res) => {
    try{
        const { idToken, role } = req.body; // role optional, default worker
        if(!GOOGLE_CLIENT_ID) return res.status(500).json({message:"Google client not configured"});
        const client = new OAuth2Client(GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name || payload.email.split('@')[0];
        const googleId = payload.sub;

        // find existing
        let user = await Worker.findOne({ email }) || await Employer.findOne({ email });
        if(!user){
            const pickedRole = role === 'employer' ? 'employer' : 'worker';
            if(pickedRole === 'employer'){
                user = new Employer({ username: name, email, password: await bcrypt.hash(googleId, 10), role:'employer', loginProvider:'google' });
            }else{
                user = new Worker({ username: name, email, password: await bcrypt.hash(googleId, 10), role:'worker', loginProvider:'google' });
            }
            await user.save();
        }else{
            user.loginProvider = 'google';
            await user.save();
        }

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, role: user.role, userId: user._id, username: user.username });
    }catch(err){
        console.error("Google auth error", err);
        res.status(401).json({message:"Google login failed"});
    }
});

// Forgot password (email code)
function generateCode(){ return Math.floor(100000 + Math.random()*900000).toString(); }

async function sendResetEmail(email, code){
    if(mailTransporter){
        await mailTransporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@vips.com',
            to: email,
            subject: 'Your VIPs reset code',
            text: `Use this code to reset your password: ${code}`
        });
    }else{
        console.warn(`No SMTP configured. Reset code for ${email}: ${code}`);
    }
}

app.post('/api/auth/forgot', async (req,res)=>{
    try{
        const { email } = req.body;
        if(!email) return res.status(400).json({message:"Email required"});
        let user = await Worker.findOne({ email }) || await Employer.findOne({ email });
        if(!user) return res.status(404).json({message:"User not found"});
        const code = generateCode();
        user.resetCode = code;
        user.resetCodeExpires = new Date(Date.now()+15*60*1000);
        await user.save();
        await sendResetEmail(email, code);
        res.json({message:"Reset code sent"});
    }catch(err){
        console.error("Forgot error", err);
        res.status(500).json({message:"Failed to send code"});
    }
});

app.post('/api/auth/reset', async (req,res)=>{
    try{
        const { email, code, newPassword } = req.body;
        if(!email || !code || !newPassword) return res.status(400).json({message:"Missing fields"});
        let user = await Worker.findOne({ email }) || await Employer.findOne({ email });
        if(!user || !user.resetCode || !user.resetCodeExpires) return res.status(400).json({message:"Invalid code"});
        if(user.resetCode !== code) return res.status(400).json({message:"Invalid code"});
        if(user.resetCodeExpires < new Date()) return res.status(400).json({message:"Code expired"});
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetCode = null;
        user.resetCodeExpires = null;
        user.loginProvider = 'local';
        await user.save();
        res.json({message:"Password reset successful"});
    }catch(err){
        console.error("Reset error", err);
        res.status(500).json({message:"Failed to reset password"});
    }
});
app.get('/api/auth/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check Worker first, if not found, check Employer
        let user = await Worker.findById(decoded.id);
        if (!user) {
            user = await Employer.findById(decoded.id);
        }

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) { 
        res.status(401).json({ message: "Invalid token" }); 
    }
});
// --- SEARCH & PROFILE ---
app.get('/api/users/search', async (req, res) => {
    const query = req.query.q || ""; 
    try {
        const workers = await Worker.find({ username: { $regex: query, $options: 'i' } })
            .select('username profilePicture role followers mainCategory settings'); // Added mainCategory & settings
        const employers = await Employer.find({ username: { $regex: query, $options: 'i' } })
            .select('username profilePicture role followers mainCategory settings companyName'); // Added companyName
        res.json([...workers, ...employers]);
    } catch (err) { res.status(500).json({ message: "Search failed" }); }
});

// --- SOCIAL / FOLLOW SYSTEM (PUBLIC) ---


// GET Settings for the settings page to load correctly
app.get('/api/employer/settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await Employer.findById(decoded.id);
        res.json(user.settings || { followToView: false, autoAccept: true });
    } catch (err) { res.status(500).json({ error: "Failed to load" }); }
});
// --- 1. UPDATED FOLLOW LOGIC (Instagram Style) ---
app.post('/api/users/follow/:targetId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token provided" }); // Safety line

        const decoded = jwt.verify(token, JWT_SECRET);
        const myId = decoded.id;
        const targetId = req.params.targetId;

        if (myId === targetId) return res.status(400).json({ message: "Cannot follow yourself" });

        // 1. Find Target & Me
        let targetUser = await Worker.findById(targetId) || await Employer.findById(targetId);
        let me = await Worker.findById(myId) || await Employer.findById(myId);
        
        if (!targetUser || !me) return res.status(404).json({ message: "User not found" });

        const TargetModel = targetUser.role === 'employer' ? Employer : Worker;
        const MyModel = me.role === 'employer' ? Employer : Worker;

        // 2. Check Status (Ensuring string comparison for MongoDB IDs)
        const myIdStr = myId.toString();
        const isFollowing = targetUser.followers ? targetUser.followers.map(id => id.toString()).includes(myIdStr) : false;
        const isRequested = targetUser.followRequests ? targetUser.followRequests.map(id => id.toString()).includes(myIdStr) : false;

        // 3. Execution Logic
        if (isFollowing) {
            // UNFOLLOW: Remove from followers AND following
            await TargetModel.findByIdAndUpdate(targetId, { $pull: { followers: myId } });
            await MyModel.findByIdAndUpdate(myId, { $pull: { following: targetId } });
            
            // Clean up any old notifications of this follow
            await TargetModel.findByIdAndUpdate(targetId, { 
                $pull: { notifications: { user: myId, type: 'follow' } } 
            });
            
            return res.json({ status: "unfollowed" });

        } else if (isRequested) {
            // CANCEL REQUEST: This is the fix for your "Cancel" button
            await TargetModel.findByIdAndUpdate(targetId, { $pull: { followRequests: myId } });
            
            // IMPORTANT: Also remove the pending notification so the Employer doesn't see a ghost request
            await TargetModel.findByIdAndUpdate(targetId, { 
                $pull: { notifications: { user: myId, type: 'request' } } 
            });
            
            return res.json({ status: "cancelled" });

        } else {
            // --- PRIVACY & AUTO-ACCEPT LOGIC ---
            const isEmployer = targetUser.role === 'employer';
            const privacyOn = targetUser.settings?.followToView || false; 
            const autoAcceptOff = targetUser.settings?.autoAccept === false;

            if (isEmployer && (privacyOn || autoAcceptOff)) {
                // REQUESTED MODE
                await TargetModel.findByIdAndUpdate(targetId, { 
                    $addToSet: { followRequests: myId },
                    $push: { notifications: { type: 'request', user: myId, date: new Date(), read: false } }
                });
                return res.json({ status: "requested" });
            } else {
                // DIRECT FOLLOW MODE
                await TargetModel.findByIdAndUpdate(targetId, { 
                    $addToSet: { followers: myId },
                    $push: { notifications: { type: 'follow', user: myId, date: new Date(), read: false } }
                });

                await MyModel.findByIdAndUpdate(myId, { 
                    $addToSet: { following: targetId } 
                });

                return res.json({ status: "following" });
            }
        }
    } catch (err) { 
        console.error("Follow Error:", err);
        res.status(500).json({ message: "Action failed" }); 
    }
});
// --- 2. UPDATED SETTINGS UPDATE LOGIC ---
app.post('/api/employer/update-privacy', authMiddleware, async (req, res) => {
    try {
        const { followToView, autoAccept } = req.body;
        
        const updated = await Employer.findByIdAndUpdate(
            req.user._id, 
            { 
                $set: { 
                    'settings.followToView': followToView,
                    'settings.autoAccept': autoAccept 
                } 
            }, 
            { new: true }
        );
        
        res.json({ message: "Settings updated", settings: updated.settings });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});// This tells the server to look for HTML files in your main folder
app.use(express.static(path.join(__dirname, '/'))); 
// Add this to server.js
app.get('/api/notifications/count', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Find user in either collection
        const user = await Worker.findById(decoded.id) || await Employer.findById(decoded.id);
        
        if (!user) return res.status(404).json({ message: "User not found" });

        // Count unread notifications
        const count = (user.notifications || []).filter(n => !n.read).length;
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: "Error fetching notification count" });
    }
});
// If your other pages are in 'public', keep that too
app.use(express.static('public'));
// Add these lines to your server.js middle-ware section
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // This allows serving search.html from the root


// --- UPDATE PROFILE ROUTE ---
app.put('/api/profile/update', (req, res, next) => {
    // 1. Handle potential file upload first
    upload.single('profilePicture')(req, res, (err) => {
        if (err) return res.status(500).json({ message: "File upload error: " + err.message });
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token provided" });
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 2. Prepare the update object
        const updateData = {};
        
        // Update basic fields if they exist in req.body
        if (req.body.username) updateData.username = req.body.username;
        if (req.body.location) updateData.location = req.body.location; // Handles your Home Page update
        if (req.body.phone) updateData.phone = req.body.phone;
        if (req.body.bio) updateData.bio = req.body.bio;
        if (req.body.mainCategory) updateData.mainCategory = req.body.mainCategory;
        if (req.file) updateData.profilePicture = `/uploads/${req.file.filename}`;

        // 3. Handle Profession Tags & Multi-Category Logic for Workers
        if (req.body.profession || req.body.mainCategory) {
            let professionTags = [];
            try {
                professionTags = JSON.parse(req.body.profession || "[]");
            } catch (e) { 
                professionTags = req.body.profession ? [req.body.profession] : []; 
            }

            let user = await Worker.findById(decoded.id);
            if (user) {
                const newCatName = req.body.mainCategory || user.mainCategory;
                if (newCatName) {
                    const existingCatIndex = user.categories.findIndex(c => c.name === newCatName);
                    if (existingCatIndex > -1) {
                        user.categories[existingCatIndex].tags = professionTags;
                    } else {
                        user.categories.push({ name: newCatName, tags: professionTags });
                    }
                    updateData.categories = user.categories;
                    updateData.profession = professionTags;
                }
            }
        }

        // 4. Execute the update on whichever collection the user belongs to
        let updatedUser = await Worker.findByIdAndUpdate(decoded.id, { $set: updateData }, { new: true });
        
        if (!updatedUser) {
            updatedUser = await Employer.findByIdAndUpdate(decoded.id, { $set: updateData }, { new: true });
        }

        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        // 5. Send ONE single response back
        res.json({ 
            message: "Profile updated successfully", 
            user: updatedUser,
            location: updatedUser.location 
        });

    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// --- PORTFOLIO: create project with up to 10 media ---
app.post('/api/profile/portfolio', (req, res, next) => {
    upload.array('workMedia', 10)(req, res, (err) => {
        if (err) return res.status(500).json({ message: "Upload error: " + err.message });
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!req.files || req.files.length === 0) return res.status(400).json({ message: "No files uploaded" });

        const media = req.files.slice(0,10).map(f => ({
            url: `/uploads/${f.filename}`,
            type: f.mimetype.startsWith('video') ? 'video' : 'image'
        }));

        const title = (req.body.title || 'New Project').trim() || 'New Project';

        let user = await Worker.findById(decoded.id);
        if (!user) user = await Employer.findById(decoded.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const duplicate = (user.projects || []).some(p => (p.title || '').trim().toLowerCase() === title.toLowerCase());
        if (duplicate) return res.status(400).json({ message: "Project name must be unique" });

        user.projects.push({
            title,
            description: req.body.description || '',
            media
        });
        await user.save();

        res.json({ message: "Project added", projects: user.projects });
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
});

// Update project title
app.put('/api/profile/portfolio/:projectId/title', async (req,res)=>{
    try{
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { projectId } = req.params;
        const { title } = req.body;
        if(!title) return res.status(400).json({message:"Title required"});

        let user = await Worker.findById(decoded.id);
        if(!user) user = await Employer.findById(decoded.id);
        if(!user) return res.status(404).json({ message:"User not found"});

        const project = user.projects.id(projectId);
        if(!project) return res.status(404).json({ message:"Project not found"});

        const normalized = title.trim().toLowerCase();
        const duplicate = user.projects.some(p => p._id.toString() !== projectId && (p.title || '').trim().toLowerCase() === normalized);
        if(duplicate) return res.status(400).json({ message:"Project name must be unique" });

        project.title = title.trim();
        await user.save();

        res.json({ projects: user.projects });
    }catch(err){ res.status(500).json({ message:"Server Error" }); }
});

// Delete entire project
app.delete('/api/profile/portfolio/:projectId', async (req,res)=>{
    try{
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { projectId } = req.params;

        // Fetch user once (worker or employer)
        let user = await Worker.findById(decoded.id) || await Employer.findById(decoded.id);
        if(!user) return res.status(404).json({ message:"User not found" });

        const beforeCount = (user.projects||[]).length;
        user.projects = (user.projects||[]).filter(p => p._id.toString() !== projectId);
        await user.save();
        const afterCount = (user.projects||[]).length;

        // If nothing was removed, still return 200 with a hint instead of 404 to avoid front-end dead-end
        res.json({ projects: user.projects, removed: beforeCount - afterCount });
    }catch(err){ res.status(500).json({ message:"Server Error" }); }
});

// --- FOLLOWERS & FOLLOWING (populated) ---
app.get('/api/profile/network', async (req,res)=>{
    try{
        const token = req.headers.authorization?.split(' ')[1];
        if(!token) return res.status(401).json({ message:"No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        const me = await Worker.findById(decoded.id) || await Employer.findById(decoded.id);
        if(!me) return res.status(404).json({ message:"User not found" });

        const followersIds = me.followers || [];
        const followingIds = me.following || [];

        const workerFollowers = await Worker.find({ _id: { $in: followersIds } }).select('username profilePicture role');
        const employerFollowers = await Employer.find({ _id: { $in: followersIds } }).select('username profilePicture role companyName');

        const workerFollowing = await Worker.find({ _id: { $in: followingIds } }).select('username profilePicture role');
        const employerFollowing = await Employer.find({ _id: { $in: followingIds } }).select('username profilePicture role companyName');

        res.json({
            followers:{ workers: workerFollowers, employers: employerFollowers },
            following:{ workers: workerFollowing, employers: employerFollowing }
        });
    }catch(err){ res.status(500).json({ message:"Server Error" }); }
});

// Remove a follower (and drop self from their following)
app.delete('/api/profile/followers/:followerId', async (req,res)=>{
    try{
        const token = req.headers.authorization?.split(' ')[1];
        if(!token) return res.status(401).json({ message:"No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        const followerId = req.params.followerId;

        let me = await Worker.findById(decoded.id) || await Employer.findById(decoded.id);
        if(!me) return res.status(404).json({ message:"User not found" });

        me.followers = (me.followers||[]).filter(id => id.toString() !== followerId);
        await me.save();

        // Remove me from their following list as well
        let follower = await Worker.findById(followerId) || await Employer.findById(followerId);
        if(follower){
            follower.following = (follower.following||[]).filter(id => id.toString() !== me._id.toString());
            await follower.save();
        }

        res.json({ message:"Removed", followers: me.followers });
    }catch(err){ res.status(500).json({ message:"Server Error" }); }
});

// --- EXPLORE: PUBLIC PORTFOLIO FEED ---
app.get('/api/explore/portfolio', async (req,res)=>{
    try{
        const limit = parseInt(req.query.limit,10) || 60;
        const workers = await Worker.find({ "projects.0": { $exists:true } })
            .select('username role location profilePicture projects')
            .limit(limit);
        const employers = await Employer.find({ "projects.0": { $exists:true } })
            .select('username companyName role location profilePicture projects settings')
            .limit(limit);

        const toItems = (user)=> (user.projects||[]).map(p=>({
            ownerId: user._id,
            ownerName: user.companyName || user.username,
            role: user.role || 'worker',
            location: user.location || '',
            profilePicture: user.profilePicture || '',
            settings: user.settings || {},
            projectId: p._id,
            title: p.title || 'Project',
            media: p.media && p.media[0] ? p.media[0] : null,
            mediaList: p.media || [],
            createdAt: p.createdAt || new Date(0)
        }));

        const items = [...workers.flatMap(toItems), ...employers.flatMap(toItems)]
            .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);

        res.json(items);
    }catch(err){
        console.error(err);
        res.status(500).json({ message:"Server Error" });
    }
});

// Delete media item
app.delete('/api/profile/portfolio/:projectId/media/:mediaId', async (req,res)=>{
    try{
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { projectId, mediaId } = req.params;
        let user = await Worker.findOneAndUpdate(
            { _id: decoded.id, "projects._id": projectId },
            { $pull: { "projects.$.media": { _id: mediaId } } },
            { new: true }
        );
        if(!user){
            user = await Employer.findOneAndUpdate(
                { _id: decoded.id, "projects._id": projectId },
                { $pull: { "projects.$.media": { _id: mediaId } } },
                { new: true }
            );
        }
        if(!user) return res.status(404).json({ message:"Project not found"});
        res.json({ projects: user.projects });
    }catch(err){ res.status(500).json({ message:"Server Error" }); }
});

// Replace media item
app.put('/api/profile/portfolio/:projectId/media/:mediaId', (req,res,next)=>{
    upload.single('workMedia')(req,res,(err)=>{
        if(err) return res.status(500).json({ message:"Upload error: "+err.message });
        next();
    });
}, async (req,res)=>{
    try{
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { projectId, mediaId } = req.params;
        if(!req.file) return res.status(400).json({ message:"No file uploaded" });
        const media = { url:`/uploads/${req.file.filename}`, type:req.file.mimetype.startsWith('video')?'video':'image' };
        let user = await Worker.findOneAndUpdate(
            { _id: decoded.id, "projects._id": projectId, "projects.media._id": mediaId },
            { $set: { "projects.$[p].media.$[m].url": media.url, "projects.$[p].media.$[m].type": media.type } },
            { new:true, arrayFilters:[{ "p._id": projectId }, { "m._id": mediaId }] }
        );
        if(!user){
            user = await Employer.findOneAndUpdate(
                { _id: decoded.id, "projects._id": projectId, "projects.media._id": mediaId },
                { $set: { "projects.$[p].media.$[m].url": media.url, "projects.$[p].media.$[m].type": media.type } },
                { new:true, arrayFilters:[{ "p._id": projectId }, { "m._id": mediaId }] }
            );
        }
        if(!user) return res.status(404).json({ message:"Project not found"});
        res.json({ projects: user.projects });
    }catch(err){ res.status(500).json({ message:"Server Error" }); }
});

// Add media to existing project (respect max 10)
app.post('/api/profile/portfolio/:projectId/media', (req,res,next)=>{
    upload.array('workMedia',10)(req,res,(err)=>{
        if(err) return res.status(500).json({ message:"Upload error: "+err.message });
        next();
    });
}, async (req,res)=>{
    try{
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { projectId } = req.params;
        if(!req.files || !req.files.length) return res.status(400).json({ message:"No files uploaded" });

        const mediaToAdd = req.files.map(f=>({ url:`/uploads/${f.filename}`, type:f.mimetype.startsWith('video')?'video':'image' }));

        let user = await Worker.findOne({ _id: decoded.id, "projects._id": projectId });
        if(!user){
            user = await Employer.findOne({ _id: decoded.id, "projects._id": projectId });
        }
        if(!user) return res.status(404).json({ message:"Project not found" });

        const project = user.projects.id(projectId);
        if(!project) return res.status(404).json({ message:"Project not found" });
        if((project.media?.length || 0) + mediaToAdd.length > 10){
            return res.status(400).json({ message:"Max 10 media per project" });
        }

        project.media = project.media ? project.media.concat(mediaToAdd) : mediaToAdd;
        await user.save();

        res.json({ projects: user.projects });
    }catch(err){ res.status(500).json({ message:"Server Error" }); }
});

// --- NOTIFICATIONS ROUTE ---
app.get('/api/notifications', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await Worker.findById(decoded.id).populate('notifications.user', 'username profilePicture role') ||
                     await Employer.findById(decoded.id).populate('notifications.user', 'username profilePicture role');
            
        if (!user) return res.json([]);
        const sortedNotifs = (user.notifications || []).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(sortedNotifs);
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
});
// --- GET ALL PENDING REQUESTS ---
app.get('/api/users/requests', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Find current user in either collection and populate the requester details
        const user = await Worker.findById(decoded.id).populate('followRequests', 'username profilePicture profession role') || 
                     await Employer.findById(decoded.id).populate('followRequests', 'username profilePicture profession role');
        
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user.followRequests || []);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// --- CONFIRM/ACCEPT REQUEST ---
// --- CONFIRM/ACCEPT REQUEST ---
// --- CONFIRM/ACCEPT REQUEST (The "Hire" Logic) ---
app.post('/api/users/confirm/:requesterId', authMiddleware, async (req, res) => {
    try {
        const myId = req.user._id; // The Employer
        const requesterId = req.params.requesterId; // The Worker

        // 1. Update Employer: Remove from requests, add to followers (Total Hired)
        await Employer.findByIdAndUpdate(myId, {
            $pull: { followRequests: requesterId },
            $addToSet: { followers: requesterId } 
        });

        // 2. Update Worker: Add Employer to their 'following' list
        await Worker.findByIdAndUpdate(requesterId, {
            $addToSet: { following: myId }
        });

        // 3. Optional: Add a notification for the worker
        await Worker.findByIdAndUpdate(requesterId, {
            $push: { 
                notifications: { 
                    type: 'accept', 
                    user: myId, 
                    date: new Date(), 
                    read: false 
                } 
            }
        });

        res.json({ message: "Request accepted and Worker added to Hired list" });
    } catch (err) {
        console.error("Confirm Error:", err);
        res.status(500).json({ message: "Error confirming request" });
    }
});

// --- REJECT/DELETE REQUEST ---
app.delete('/api/users/requests/:requesterId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Simply pull from followRequests array
        await Worker.findByIdAndUpdate(decoded.id, { $pull: { followRequests: req.params.requesterId } }) ||
        await Employer.findByIdAndUpdate(decoded.id, { $pull: { followRequests: req.params.requesterId } });

        res.json({ message: "Request deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting request" });
    }
});

// --- PENDING REQUESTS (Badge) ---
app.get('/api/requests/pending', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await Worker.findById(decoded.id) || await Employer.findById(decoded.id);
        const unreadCount = (user.notifications || []).filter(n => !n.read);
        res.json(unreadCount); 
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
});

// --- HEARTBEAT & PRIVACY ---
app.put('/api/profile/privacy', async (req, res) => { res.json({ isPrivate: false }); });

app.post('/api/profile/heartbeat', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        await Worker.findByIdAndUpdate(decoded.id, { lastSeen: new Date() }) ||
        await Employer.findByIdAndUpdate(decoded.id, { lastSeen: new Date() });
        res.sendStatus(200);
    } catch (err) { res.sendStatus(500); }
});
const Job = require('./models/Job');

app.post('/api/jobs/create', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const newJob = new Job({
            employerId: decoded.id,
            ...req.body
        });

        await newJob.save();
        res.status(201).json({ message: "Job Created" });
    } catch (err) {
        res.status(500).json({ error: "Failed to create job" });
    }
});
// Get all open jobs for workers
app.get('/api/jobs/feed', async (req, res) => {
    try {
        // Fetch jobs and include employer details (like company name)
        const jobs = await Job.find({ status: 'open' })
            .populate('employerId', 'companyName username profilePicture')
            .sort({ createdAt: -1 }); // Newest first
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: "Failed to load job feed" });
    }
});

// Worker applies to a job
app.post('/api/jobs/apply/:jobId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'worker') {
            return res.status(403).json({ message: "Only workers can apply to jobs" });
        }

        const job = await Job.findById(req.params.jobId);
        if (!job) return res.status(404).json({ message: "Job not found" });

        const application = await JobApplication.findOneAndUpdate(
            { workerId: req.user._id, jobId: job._id },
            { $set: { employerId: job.employerId, status: 'applied', workerSeen: false } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json({ message: "Applied", application });
    } catch (err) {
        console.error("Apply error:", err);
        res.status(500).json({ error: "Failed to apply" });
    }
});

// Worker withdraws application
app.delete('/api/jobs/apply/:jobId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'worker') {
            return res.status(403).json({ message: "Only workers can withdraw applications" });
        }

        await JobApplication.findOneAndUpdate(
            { workerId: req.user._id, jobId: req.params.jobId },
            { $set: { status: 'withdrawn', workerSeen: false } }
        );

        res.json({ message: "Application withdrawn" });
    } catch (err) {
        console.error("Withdraw error:", err);
        res.status(500).json({ error: "Failed to withdraw" });
    }
});

// Employer: list job applications for their jobs
app.get('/api/employer/job-requests', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Only employers can view job requests" });
        }

        const apps = await JobApplication.find({
            employerId: req.user._id,
            status: { $in: ['applied','accepted','rejected','withdrawn'] }
        })
        .populate('workerId', 'username profilePicture location phone email')
        .populate('jobId', 'title location totalFee hourlyFee');

        res.json(apps);
    } catch (err) {
        console.error("Job request load error:", err);
        res.status(500).json({ error: "Failed to load job requests" });
    }
});

// Employer: reject/clear a job request
app.post('/api/employer/job-requests/:appId/reject', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Only employers can reject job requests" });
        }
        const appDoc = await JobApplication.findOneAndUpdate(
            { _id: req.params.appId, employerId: req.user._id },
            { $set: { status: 'rejected', workerSeen: false } },
            { new: true }
        );
        if (!appDoc) return res.status(404).json({ message: "Request not found" });
        res.json({ message: "Request rejected" });
    } catch (err) {
        console.error("Reject request error:", err);
        res.status(500).json({ error: "Failed to reject request" });
    }
});

// Employer: accept a job request
app.post('/api/employer/job-requests/:appId/accept', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Only employers can accept job requests" });
        }
        const appDoc = await JobApplication.findOneAndUpdate(
            { _id: req.params.appId, employerId: req.user._id },
            { $set: { status: 'accepted', workerSeen: false } },
            { new: true }
        );
        if (!appDoc) return res.status(404).json({ message: "Request not found" });
        res.json({ message: "Request accepted" });
    } catch (err) {
        console.error("Accept request error:", err);
        res.status(500).json({ error: "Failed to accept request" });
    }
});

// Employer: cancel (undo) an accepted job request back to applied
app.post('/api/employer/job-requests/:appId/cancel', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Only employers can cancel job requests" });
        }
        const appDoc = await JobApplication.findOneAndUpdate(
            { _id: req.params.appId, employerId: req.user._id },
            { $set: { status: 'applied', workerSeen: false } },
            { new: true }
        );
        if (!appDoc) return res.status(404).json({ message: "Request not found" });
        res.json({ message: "Request set back to pending" });
    } catch (err) {
        console.error("Cancel request error:", err);
        res.status(500).json({ error: "Failed to cancel request" });
    }
});

// Employer: delete a job request (rejected/withdrawn cleanup)
app.delete('/api/employer/job-requests/:appId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Only employers can delete job requests" });
        }
        const deleted = await JobApplication.findOneAndDelete({
            _id: req.params.appId,
            employerId: req.user._id,
            status: { $in: ['rejected','withdrawn'] }
        });
        if (!deleted) return res.status(404).json({ message: "Request not found or cannot be deleted" });
        res.json({ message: "Request deleted" });
    } catch (err) {
        console.error("Delete request error:", err);
        res.status(500).json({ error: "Failed to delete request" });
    }
});

// Employer: list invites that workers accepted
app.get('/api/employer/accepted-invites', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Only employers can view accepted invites" });
        }

        const invites = await JobInvite.find({
            employerId: req.user._id,
            status: 'accepted'
        }).populate('workerId', 'username profilePicture location phone email');

        res.json(invites);
    } catch (err) {
        console.error("Accepted invite load error:", err);
        res.status(500).json({ error: "Failed to load accepted invites" });
    }
});
// --- DELETE SPECIFIC CATEGORY ---
app.delete('/api/profile/categories/:catName', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const catToRemove = req.params.catName;

        const user = await Worker.findByIdAndUpdate(
            decoded.id,
            { $pull: { categories: { name: catToRemove } } },
            { new: true }
        );

        res.json({ message: "Category removed", categories: user.categories });
    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
    }
});
// --- DELETE SPECIFIC TAG FROM A CATEGORY ---
app.delete('/api/profile/categories/:catName/tags/:tagName', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const { catName, tagName } = req.params;

        // Use dot notation to find the correct category and pull the specific tag
        const user = await Worker.findOneAndUpdate(
            { _id: decoded.id, "categories.name": catName },
            { $pull: { "categories.$.tags": tagName } },
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "User or Category not found" });

        res.json({ message: "Tag removed", categories: user.categories });
    } catch (err) {
        console.error("Tag removal error:", err);
        res.status(500).json({ message: "Failed to remove tag" });
    }
});
// --- DELETE SPECIFIC TAG FROM A CATEGORY ---

// --- WORKER FILTER ROUTE ---
// Add 'protect' or 'authMiddleware' here so req.user is populated
// --- WORKER FILTER ROUTE ---
// The 'req' and 'res' variables are defined right here in the function parameters
app.get('/api/workers/filter', authMiddleware, async (req, res) => {
try {

const { job } = req.query;

const searchRegex = job ? new RegExp(job,'i') : /.*/;

let workers = await Worker.find({
role:'worker',
$or:[
{ mainCategory:searchRegex },
{ "categories.name":searchRegex },
{ "categories.tags":searchRegex }
]
}).select('-password').lean();

const invites = await JobInvite.find({
employerId:req.user._id,
jobTitle: job,
status:"pending"
});

const invitedIds = invites.map(i => i.workerId.toString());

workers = workers.map(w => ({
...w,
inviteSent: invitedIds.includes(w._id.toString())
}));

res.json(workers);

}catch(err){
console.error(err);
res.status(500).json({message:"Server error"});
}
});
// server.js
app.get('/api/workers/profile/:id', authMiddleware, async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id).select('-password');
        if (!worker) return res.status(404).json({ message: "Worker not found" });
        res.json(worker);
    } catch (err) {
        res.status(500).json({ message: "Error fetching profile" });
    }
});
app.get('/api/users/profile/:id', async (req, res) => {
    try {
        const targetId = req.params.id;
        const foundUser = await Employer.findById(targetId).select('-password') || 
                          await Worker.findById(targetId).select('-password');

        if (!foundUser) return res.status(404).json({ message: "User not found" });

        // 1. Get the ID of the person currently looking at the profile
        const token = req.headers.authorization?.split(' ')[1];
        let viewerId = null;
        
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET); // Use your global JWT_SECRET
                viewerId = decoded.id;
            } catch (e) { console.log("Token verification failed"); }
        }

        // 2. DEFINE MISSING VARIABLES (Crucial Fix)
        const myIdStr = viewerId ? viewerId.toString() : null;
        const isOwner = myIdStr === targetId.toString(); 
        const privacyEnabled = foundUser.settings?.followToView || false;

        // 3. Calculate status for UI
        const isFollowing = foundUser.followers?.some(id => id.toString() === myIdStr) || false;
        const hasRequested = foundUser.followRequests?.some(id => id.toString() === myIdStr) || false;

        // 4. Build the object
        const profileData = {
    _id: foundUser._id,
    username: foundUser.username,
    role: foundUser.role,
    bio: foundUser.bio || "",
    profilePicture: foundUser.profilePicture || "",
    location: foundUser.location || "",

    // ✅ ADD THESE
    categories: foundUser.categories || [],
    
    skills: foundUser.skills || [],

    followRequests: foundUser.followRequests || [],
    followers: foundUser.followers || [],
    isFollowing: isFollowing,
    hasRequested: hasRequested,
    followToView: privacyEnabled,
    companyName: foundUser.companyName || foundUser.username
};

        // 5. Apply Privacy Masking
        // Allow view if: Not Private OR already Following OR looking at own profile OR target is a Worker
        if (!privacyEnabled || isFollowing || isOwner || foundUser.role === 'worker') {
            profileData.email = foundUser.email;
            profileData.phone = foundUser.phone || "";
        } else {
            profileData.email = "🔒 Follow to view";
            profileData.phone = "🔒 Follow to view";
            profileData.bio = "This profile is private. Follow to see details.";
        }

        res.json(profileData);
    } catch (err) {
        console.error("Profile Logic Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
});
app.get("/api/worker/invites", authMiddleware, async (req,res)=>{

try{

const workerId = req.user._id;

let invites = await JobInvite.find({
workerId:workerId,
status:"pending"
})
.populate("employerId","username location")
.sort({createdAt:-1});

invites = invites.map(inv => {
    const sanitize = (v="")=>{
        const t = (v||"").trim();
        if(!t) return "";
        if(t.toLowerCase()==="not specified") return "";
        return t;
    };
    const jobLocRaw = sanitize(inv.jobLocation);
    const employerLocRaw = sanitize(inv.employerId?.location);
    const workerSnapRaw = sanitize(inv.workerLocationAtInvite);

    // Resolve a consistent location for display
    const resolvedJobLoc = jobLocRaw || workerSnapRaw || employerLocRaw || "Not specified";
    const resolvedSnap = workerSnapRaw || jobLocRaw || employerLocRaw || "Not specified";

    inv.jobLocation = resolvedJobLoc;
    inv.workerLocationAtInvite = resolvedSnap;
    return inv;
});

res.json(invites);

}catch(err){

console.error(err);
res.status(500).json({message:"Failed to load invites"});

}

});
app.post("/api/jobs/invite/:workerId", authMiddleware, async (req,res)=>{

try{

const employerId = req.user._id;
const workerId = req.params.workerId;

const {jobTitle,message, jobLocation} = req.body;

// Normalize location; fallback to employer profile if missing/blank
const jobLocClean = (jobLocation || "").trim();
const finalJobLocation = jobLocClean || (req.user.location || "").trim() || "Not specified";

// fetch worker's current location snapshot
const worker = await Worker.findById(workerId).select("location");

// ✅ check if invite already exists
const existingInvite = await JobInvite.findOne({
employerId,
workerId,
jobTitle,
status:"pending"
});

if(existingInvite){
return res.json({message:"Invite already sent"});
}

const invite = new JobInvite({
employerId,
workerId,
jobTitle,
jobLocation: finalJobLocation,
workerLocationAtInvite: worker?.location || finalJobLocation,
message
});

await invite.save();

res.json({message:"Invite sent successfully"});

}catch(err){

console.error(err);
res.status(500).json({message:"Invite failed"});

}

});
app.post("/api/jobs/accept/:inviteId", authMiddleware, async (req,res)=>{

const invite = await JobInvite.findByIdAndUpdate(
req.params.inviteId,
{status:"accepted"},
{new:true}
);

res.json({message:"Job accepted"});

});
app.post("/api/jobs/reject/:inviteId", authMiddleware, async (req,res)=>{

await JobInvite.findByIdAndUpdate(
req.params.inviteId,
{status:"rejected"}
);

res.json({message:"Job rejected"});

});
app.delete("/api/jobs/invite/:workerId", authMiddleware, async (req, res) => {

try {

const employerId = req.user._id;
const workerId = req.params.workerId;
const { jobTitle } = req.body;

await JobInvite.deleteOne({
employerId:req.user._id,
workerId:req.params.workerId,
jobTitle,
status:"pending"
});

res.json({message:"Invite cancelled"});

} catch(err){
console.error(err);
res.status(500).json({message:"Cancel failed"});
}

});
app.get("/api/jobs/public", async (req, res) => {

try{

const jobs = await Job.find()
.populate("employerId","username companyName location profilePicture");

res.json(jobs);

}catch(err){

res.status(500).json({error:"Server error"});

}

});

// Worker: job status updates (accepted/rejected)
app.get('/api/worker/job-updates', authMiddleware, async (req, res) => {
    try{
        if(req.user.role !== 'worker'){
            return res.status(403).json({message:"Only workers can view updates"});
        }
        const updates = await JobApplication.find({
            workerId: req.user._id,
            status: { $in: ['accepted','rejected','withdrawn'] }
        })
        .populate('jobId','title location details workDetails tasks totalFee hourlyFee status createdAt')
        .populate('employerId','username companyName location profilePicture');
        res.json(updates);
    }catch(err){
        console.error(err);
        res.status(500).json({message:"Failed to load updates"});
    }
});

// Worker: mark job updates as seen
app.post('/api/worker/job-updates/mark-read', authMiddleware, async (req, res) => {
    try{
        if(req.user.role !== 'worker'){
            return res.status(403).json({message:"Only workers can mark updates"});
        }
        await JobApplication.updateMany(
            { workerId: req.user._id, status: { $in: ['accepted','rejected','withdrawn'] } },
            { $set: { workerSeen: true } }
        );
        res.json({message:"Marked as read"});
    }catch(err){
        console.error(err);
        res.status(500).json({message:"Failed to mark read"});
    }
});

// Employer: list own posted jobs
app.get("/api/jobs/mine", authMiddleware, async (req,res)=>{
try{
if(req.user.role !== 'employer'){
return res.status(403).json({message:"Only employers can view their jobs"});
}
const jobs = await Job.find({ employerId: req.user._id })
.sort({ createdAt: -1 });
res.json(jobs);
}catch(err){
console.error(err);
res.status(500).json({error:"Server error"});
}
});
app.get("/", (req, res) => {
  res.send("VIPs Backend is Running 🚀");
});

// --- APPLY EXTERNAL ROUTES ---
app.use('/api/users', workerRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/messages', messageRoutes);

// --- START SERVER ---
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log("✅ Database Connected Successfully");
        app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));
