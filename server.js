require('dotenv').config({ path: require('path').join(__dirname, '.env') }); // Load .env variables before any process.env reads

// Use Render's dynamic port or fallback to 5000 for local dev
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

const express = require('express'); 
const mongoose = require('mongoose');
const cors = require('cors'); 
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken'); 
const multer = require('multer');
const path = require('path'); 
const fs = require('fs'); 
const dns = require('dns').promises;
const crypto = require('crypto');
const JobInvite = require("./models/JobInvite");
const JobApplication = require("./models/JobApplication");
const Job = require('./models/job');
const helmet = require('helmet');
const morgan = require('morgan');
const { OAuth2Client } = require('google-auth-library');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_me_in_env') {
    console.warn('  Set a strong JWT_SECRET in .env before production.');
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
const Review = require('./models/Review');

const app = express();
const saltRounds = 10;
const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const MAX_JSON_SIZE = process.env.MAX_JSON_SIZE || '1mb';
const MAX_UPLOAD_SIZE = Number.parseInt(process.env.MAX_UPLOAD_SIZE || `${5 * 1024 * 1024}`, 10);



// Mail + Google clients. Signup intentionally does not use email.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : '';
function cleanEnv(name) {
    return process.env[name] ? String(process.env[name]).trim() : '';
}

const RESEND_API_KEY = cleanEnv('RESEND_API_KEY');
const RESEND_FROM = cleanEnv('MAIL_FROM');
const hasResendConfig = Boolean(RESEND_API_KEY && RESEND_FROM);
const activeMailProvider = hasResendConfig ? 'resend' : 'none';

console.log('MAIL CONFIG:', {
    provider: activeMailProvider,
    resendApiKey: RESEND_API_KEY ? '[SET]' : '[MISSING]',
    resendFrom: RESEND_FROM ? '[SET]' : '[MISSING]'
});

function getEmailConfigStatus() {
    return {
        provider: activeMailProvider === 'none' ? null : activeMailProvider,
        resendApiKeyConfigured: Boolean(RESEND_API_KEY),
        mailFromConfigured: Boolean(RESEND_FROM),
        resendFromConfigured: Boolean(RESEND_FROM)
    };
}

function getMailErrorMessage(err){
    const code = err?.code || err?.responseCode || '';
    if (code === 'EMAIL_NOT_CONFIGURED') {
        const missing = [];
        if (!RESEND_API_KEY) missing.push('RESEND_API_KEY');
        if (!RESEND_FROM) missing.push('MAIL_FROM');
        return `Email service is not configured on the running server. Missing: ${missing.join(', ') || 'email settings'}. Check Render environment variables, save changes, then redeploy/restart the service.`;
    }
    if (err?.provider === 'resend') {
        const resendMessage = String(err.message || '');
        const lowerResendMessage = resendMessage.toLowerCase();
        if (err.status === 401) {
            return 'Email API authentication failed. Check RESEND_API_KEY in Render environment variables.';
        }
        if (err.status === 403) {
            if (
                lowerResendMessage.includes('domain') ||
                lowerResendMessage.includes('sender') ||
                lowerResendMessage.includes('testing') ||
                lowerResendMessage.includes('recipient')
            ) {
                return resendMessage || 'Resend blocked this email. Verify your sender domain in Resend, then set MAIL_FROM to an address on that verified domain.';
            }
            return 'Resend rejected this email request. Check your verified sender/domain and recipient settings in Resend.';
        }
        return err.message || 'Email API could not send OTP. Check your Resend sender/domain settings.';
    }
    return 'Email API is not configured. Set RESEND_API_KEY and MAIL_FROM to enable email notifications.';
}

async function sendEmail({ to, subject, text, html }) {
    if (hasResendConfig) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
                'User-Agent': 'vips-app'
            },
            body: JSON.stringify({
                from: RESEND_FROM,
                to: [to],
                subject,
                text,
                html
            })
        });

        if (!response.ok) {
            let detail = '';
            try {
                const data = await response.json();
                detail = data.message || data.error || JSON.stringify(data);
            } catch {
                detail = await response.text();
            }
            const err = new Error(detail || `Email API failed with status ${response.status}`);
            err.provider = 'resend';
            err.status = response.status;
            throw err;
        }
        return response.json();
    }

    const missing = [];
    if (!RESEND_API_KEY) missing.push('RESEND_API_KEY');
    if (!RESEND_FROM) missing.push('MAIL_FROM');
    const err = new Error(`No email provider configured. Missing ${missing.join(' and ') || 'email settings'}.`);
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
}


// ... (Imports like express, mongoose, etc.)

// 1. DEFINE IT ONLY ONCE
// 1. Define it near the top of server.js
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
        if (!token) return res.status(401).json({ message: "No token provided" });

        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await findUserById(decoded.id, decoded.role);
        
        if (!user) return res.status(401).json({ message: "User not found" });

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ message: "Session expired" });
    }
};

// 2. DO NOT redeclare it later in the file!
// If you have: const authMiddleware = require('./middleware/auth'); 
// DELETE that line because you defined it above.

// ... (Rest of your routes and app.listen)

// --- MIDDLEWARE ---
// --- SECURITY MIDDLEWARE ---
app.disable('x-powered-by');
const allowedOrigins = (process.env.CORS_ORIGINS || (isProduction ? '' : '*')).split(',').map(o=>o.trim()).filter(Boolean);
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
    res.setHeader('Permissions-Policy','geolocation=(self), microphone=(), camera=()');
    next();
});
// helmet with relaxed CSP (to avoid breaking inline scripts)
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://cdnjs.cloudflare.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
            "img-src": ["'self'", "data:", "blob:"],
            "connect-src": ["'self'", "https://accounts.google.com"],
            "frame-src": ["'self'", "https://accounts.google.com"],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"]
        }
    },
    crossOriginResourcePolicy: false
}));
// request logging (skip noisy assets)
app.use(morgan('combined', {
    skip: (req)=> req.url.startsWith('/uploads') || req.url.startsWith('/static')
}));
// basic rate limiter (in-memory)
const rateStore = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '300',10);
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '60000',10);
app.use('/api', (req,res,next)=>{
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
function createRateLimiter({ windowMs, max, keyPrefix }) {
    const store = new Map();
    return (req, res, next) => {
        const identity = req.ip || req.connection.remoteAddress || 'global';
        const key = `${keyPrefix}:${identity}`;
        const now = Date.now();
        const entry = store.get(key) || { count: 0, start: now };
        if (now - entry.start > windowMs) {
            entry.count = 0;
            entry.start = now;
        }
        entry.count += 1;
        store.set(key, entry);
        if (entry.count > max) {
            console.warn('Rate limit exceeded', { route: keyPrefix, ip: identity, path: req.originalUrl });
            return res.status(429).json({ message: "Too many requests. Please try again later." });
        }
        next();
    };
}
const authRateLimit = createRateLimiter({ keyPrefix: 'auth', windowMs: 15 * 60 * 1000, max: 20 });
const signupRateLimit = createRateLimiter({ keyPrefix: 'signup', windowMs: 60 * 60 * 1000, max: 10 });
const otpRateLimit = createRateLimiter({ keyPrefix: 'password-otp', windowMs: 15 * 60 * 1000, max: 10 });
const messageRateLimit = createRateLimiter({ keyPrefix: 'message', windowMs: 60 * 1000, max: 30 });
const inviteRateLimit = createRateLimiter({ keyPrefix: 'invite', windowMs: 60 * 1000, max: 20 });
app.use(express.json({ limit: MAX_JSON_SIZE }));
app.use(express.urlencoded({ extended: true, limit: MAX_JSON_SIZE }));
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
app.get('/api/config/email', (req,res)=>{
    const status = getEmailConfigStatus();
    res.status(status.provider ? 200 : 503).json(status);
});
// Add this to your main server file (e.g., server.js)

// --- STATIC FILES ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use('/uploads', express.static(uploadDir, {
    maxAge: isProduction ? '7d' : 0,
    setHeaders: (res) => {
        if (isProduction) res.setHeader('Cache-Control', 'public, max-age=604800');
    }
}));

app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '1d' : 0,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
        } else if (isProduction) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

app.get(/\/friendprofile\.html$/i, (req, res) => {
    res.sendFile(path.join(__dirname, 'friendprofile.html'));
});
app.get(/\/search\.html$/i, (req, res) => {
    res.sendFile(path.join(__dirname, 'search.html'));
});

// ---  MULTER CONFIGURATION (Fixes "upload is not defined") ---
const allowedUploadTypes = new Map([
    ['image/jpeg', new Set(['.jpg', '.jpeg'])],
    ['image/png', new Set(['.png'])],
    ['image/webp', new Set(['.webp'])]
]);
function safeUploadFilename(prefix, file) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    return `${prefix}-${crypto.randomBytes(16).toString('hex')}${ext}`;
}
function uploadFileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = allowedUploadTypes.get(file.mimetype);
    if (!allowedExts || !allowedExts.has(ext)) {
        return cb(new Error('Only JPG, JPEG, PNG and WEBP files are allowed'));
    }
    cb(null, true);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        cb(null, safeUploadFilename('file', file));
    }
});
const upload = multer({
    storage,
    fileFilter: uploadFileFilter,
    limits: { fileSize: MAX_UPLOAD_SIZE, files: 10 }
});

// --- ROUTES IMPORT ---
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workerRoutes');
const employerRoutes = require('./routes/employerRoutes');
const messageRoutes = require('./routes/message');

function normalizeEmail(email){
    return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username){
    return String(username || '').trim();
}

function normalizeRole(role) {
    return role === 'employer' ? 'employer' : role === 'worker' ? 'worker' : null;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function cleanText(value, max = 1000) {
    return String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, max);
}

function isValidPhone(phone) {
    return /^[0-9+\-() ]{7,24}$/.test(String(phone || '').trim());
}

function validatePassword(password) {
    const value = String(password || '');
    if (value.length < 8 || value.length > 128) return 'Password must be 8-128 characters.';
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Password must include letters and numbers.';
    return null;
}

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(String(id || ''));
}

function publicUser(user) {
    if (!user) return null;
    const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete obj.password;
    delete obj.resetCode;
    delete obj.resetCodeExpires;
    delete obj.__v;
    return obj;
}

function authRequired(req, res, next) {
    return authMiddleware(req, res, next);
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: "Authentication required" });
        if (!roles.includes(req.user.role)) {
            console.warn('Permission denied', { userId: req.user._id?.toString(), role: req.user.role, path: req.originalUrl });
            return res.status(403).json({ message: "Access denied" });
        }
        next();
    };
}

function isValidEmailSyntax(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function emailDomainCanReceiveMail(email) {
    const domain = String(email || '').split('@')[1];
    if (!domain) return false;

    try {
        const mxRecords = await dns.resolveMx(domain);
        if (Array.isArray(mxRecords) && mxRecords.length > 0) return true;
    } catch (err) {
        if (err?.code !== 'ENODATA' && err?.code !== 'ENOTFOUND') {
            console.warn('Email MX lookup failed:', err.message);
        }
    }

    try {
        await dns.lookup(domain);
        return true;
    } catch {
        return false;
    }
}

function maskEmail(email) {
    const [name = '', domain = ''] = String(email || '').split('@');
    if (!name || !domain) return '';
    const visibleName = name.length <= 2 ? `${name[0] || ''}*` : `${name[0]}***${name[name.length - 1]}`;
    return `${visibleName}@${domain}`;
}

function buildAccountIdentifierQuery(identifier) {
    const normalized = String(identifier || '').trim().toLowerCase();
    if(!normalized) return null;
    const escaped = escapeRegex(normalized);
    const exactCaseInsensitive = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };

    return {
        $or: [
            { email: exactCaseInsensitive },
            { username: exactCaseInsensitive }
        ]
    };
}

async function findUserByEmail(email, role) {
    const query = buildAccountIdentifierQuery(email);
    if(!query) return null;

    if (role === 'worker') return Worker.findOne(query);
    if (role === 'employer') return Employer.findOne(query);

    const worker = await Worker.findOne(query);
    if (worker) return worker;
    return Employer.findOne(query);
}

async function findUserByEmailOnly(email) {
    const normalized = normalizeEmail(email);
    if(!normalized) return null;
    const escaped = escapeRegex(normalized);
    const exactCaseInsensitive = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };

    const worker = await Worker.findOne({ email: exactCaseInsensitive });
    if (worker) return { user: worker, role: 'worker' };
    const employer = await Employer.findOne({ email: exactCaseInsensitive });
    if (employer) return { user: employer, role: 'employer' };
    return null;
}

function duplicateCollectionName(err) {
    return String(err?.collection?.collectionName || err?.collection || err?.message || '').toLowerCase();
}

function isDuplicateFromCollection(err, collectionName) {
    return err?.code === 11000 && duplicateCollectionName(err).includes(collectionName.toLowerCase());
}

async function findUserByUsername(username) {
    const normalized = normalizeUsername(username);
    if(!normalized) return null;
    const escaped = escapeRegex(normalized);
    const exactCaseInsensitive = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };

    const worker = await Worker.findOne({ username: exactCaseInsensitive });
    if (worker) return worker;
    return Employer.findOne({ username: exactCaseInsensitive });
}

async function createAvailableUsername(baseName) {
    const cleaned = normalizeUsername(baseName)
        .replace(/[^\w.-]+/g, '')
        .slice(0, 30) || 'user';
    let candidate = cleaned;
    let suffix = 0;

    while (await findUserByUsername(candidate)) {
        suffix += 1;
        candidate = `${cleaned.slice(0, 24)}${suffix}`;
    }

    return candidate;
}

function getExperienceLevel(completedJobs = 0) {
    if (completedJobs >= 25) return 'Expert';
    if (completedJobs >= 10) return 'Advanced';
    if (completedJobs >= 3) return 'Experienced';
    return completedJobs > 0 ? 'Rising' : 'New';
}

function getSubscriptionState(employer) {
    const subscription = employer?.subscription || {};
    const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const isActive = subscription.plan === 'premium' && subscription.status === 'active' && expiresAt && expiresAt > new Date();
    return {
        plan: isActive ? 'premium' : 'free',
        status: isActive ? 'active' : 'inactive',
        startedAt: subscription.startedAt || null,
        expiresAt: isActive ? subscription.expiresAt : null,
        premium: Boolean(isActive)
    };
}

async function refreshRatingSummary(Model, userId) {
    const summary = await Review.aggregate([
        { $match: { revieweeId: new mongoose.Types.ObjectId(String(userId)) } },
        { $group: { _id: '$revieweeId', average: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const first = summary[0] || { average: 0, count: 0 };
    await Model.findByIdAndUpdate(userId, {
        $set: {
            ratingAverage: Math.round((first.average || 0) * 10) / 10,
            ratingCount: first.count || 0
        }
    });
}

async function addWorkerHistory(workerId, historyItem) {
    const worker = await Worker.findById(workerId);
    if (!worker) return null;
    const exists = (worker.jobHistory || []).some(item =>
        item.sourceType === historyItem.sourceType &&
        item.sourceId &&
        item.sourceId.toString() === historyItem.sourceId.toString()
    );
    if (!exists) worker.jobHistory.push(historyItem);
    worker.completedJobs = worker.jobHistory.length;
    worker.experienceLevel = getExperienceLevel(worker.completedJobs);
    await worker.save();
    return worker;
}

async function sendWelcomeEmail(email, user) {
    const roleLabel = user.role === 'employer' ? 'Employer' : 'Worker';
    const name = user.username || 'VIPs user';
    const safeName = escapeHtml(name);
    const safeRoleLabel = escapeHtml(roleLabel);

    return sendEmail({
        to: email,
        subject: `Welcome to VIPs, ${name}`,
        text: `Hi ${name},\n\nWelcome to VIPs ${roleLabel}.\n\nYour account is ready. Keep your profile details accurate, use a real phone number and email, and never share your password with anyone.\n\nThank you for joining VIPs.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a;">
                <h2 style="margin:0 0 12px;">Welcome to VIPs ${safeRoleLabel}</h2>
                <p>Hi ${safeName}, your account is ready.</p>
                <ul>
                    <li>Keep your profile details accurate.</li>
                    <li>Use a real phone number and email for account recovery.</li>
                    <li>Never share your password with anyone.</li>
                </ul>
                <p style="color:#64748b;font-size:13px;">Thank you for joining VIPs.</p>
            </div>
        `
    });
}

async function createUserFromSignupData(signupData) {
    if (signupData.role === 'employer') {
        const newEmployer = new Employer({
            username: signupData.username,
            email: signupData.email,
            password: signupData.passwordHash,
            phone: signupData.phone,
            role: 'employer',
            companyName: signupData.username,
            settings: { followToView: false, autoAccept: true, language: 'en' },
            mainCategory: signupData.businessCategory || "General Business"
        });
        return newEmployer.save();
    }

    const newWorker = new Worker({
        username: signupData.username,
        email: signupData.email,
        password: signupData.passwordHash,
        phone: signupData.phone,
        role: 'worker'
    });
    return newWorker.save();
}

async function findUserById(id, role) {
    if (role === 'employer') return Employer.findById(id);
    if (role === 'worker') return Worker.findById(id);
    const worker = await Worker.findById(id);
    if (worker) return worker;
    return Employer.findById(id);
}

async function getOptionalViewer(req) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return null;
        const decoded = jwt.verify(token, JWT_SECRET);
        return findUserById(decoded.id, decoded.role);
    } catch {
        return null;
    }
}

// --- AUTH ROUTES ---
// Unified Signup: Handles both Worker and Employer safely
app.post('/api/auth/signup', signupRateLimit, async (req, res) => {
    const { role, username, email, password, phone, businessCategory } = req.body;

    try {
        const signupRole = normalizeRole(role);
        const normalizedUsername = cleanText(normalizeUsername(username), 40);
        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = String(phone || '').trim();

        if (!signupRole) {
            return res.status(400).json({ error: "Invalid account type" });
        }

        if (!normalizedUsername || !normalizedEmail || !password || !normalizedPhone) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!/^[a-zA-Z0-9_. -]{3,40}$/.test(normalizedUsername)) {
            return res.status(400).json({ error: "Username must be 3-40 characters and use letters, numbers, spaces, dots, underscores or hyphens." });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        if (!isValidPhone(normalizedPhone)) {
            return res.status(400).json({ error: "Enter a valid phone number." });
        }

        if (!isValidEmailSyntax(normalizedEmail)) {
            return res.status(400).json({ error: "Invalid email address. Please use a correct email." });
        }

        const canReceiveMail = await emailDomainCanReceiveMail(normalizedEmail);
        if (!canReceiveMail) {
            return res.status(400).json({ error: "Invalid email address. This email domain cannot receive mail. Please use another email." });
        }

        const existingUsername = await findUserByUsername(normalizedUsername);
        if (existingUsername) {
            return res.status(400).json({ error: "Change username. It is already used by someone." });
        }

        const existingUser = await findUserByEmailOnly(normalizedEmail);
        if (existingUser) {
            return res.status(400).json({
                error: `This email is already registered as a ${existingUser.role} account. Please login or use another email.`
            });
        }

        const signupData = {
            role: signupRole,
            username: normalizedUsername,
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
            phone: normalizedPhone,
            businessCategory: signupRole === 'employer' ? cleanText(businessCategory || 'General Business', 80) : ''
        };

        const createdUser = await createUserFromSignupData(signupData);
        const token = jwt.sign({ id: createdUser._id, role: createdUser.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
        const redirect = createdUser.role === 'employer' ? '../employer/home.html' : '../worker/home.html';

        sendWelcomeEmail(normalizedEmail, createdUser).catch((mailErr) => {
            console.error("Welcome Email Error:", getMailErrorMessage(mailErr));
        });

        res.status(201).json({
            message: "Account created successfully.",
            role: createdUser.role,
            userId: createdUser._id,
            token,
            redirect,
            username: createdUser.username
        });
    } catch (err) { 
        console.error("Signup Error:", err);
        if (err?.code === 11000) {
            const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'account';
            if (field === 'username' && (isDuplicateFromCollection(err, 'workers') || isDuplicateFromCollection(err, 'employers'))) {
                return res.status(400).json({ error: "Change username. It is already used by someone." });
            }
            if (field === 'email' && (isDuplicateFromCollection(err, 'workers') || isDuplicateFromCollection(err, 'employers'))) {
                return res.status(400).json({ error: "This email is already registered. Please login or use another email." });
            }
        }
        res.status(500).json({ error: "Signup failed" }); 
    }
});

// Unified Login: Searches across both collections
// Unified Login Logic in server.js

app.post('/api/auth/login', authRateLimit, async (req, res) => {
    const { username, password, role } = req.body;
    const SECRET = JWT_SECRET;

    try {
        const loginRole = normalizeRole(role);
        const identifier = String(username || '').trim();

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Username/email and password are required' });
        }

        const user = await findUserByEmail(identifier, loginRole);
        
        if (!user) {
            console.warn('Failed login: account not found', { identifier, role: loginRole || 'any', ip: req.ip });
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn('Failed login: bad password', { userId: user._id?.toString(), role: user.role, ip: req.ip });
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate the token
        const token = jwt.sign({ id: user._id, role: user.role }, SECRET, { expiresIn: TOKEN_TTL });

        res.json({ token, role: user.role, userId: user._id, username: user.username });
    } catch (error) { 
    console.error("Login error:", error.message);
    res.status(500).json({ message: 'Login Error' }); 
}
});

// Google Sign-in
app.post('/api/auth/google', authRateLimit, async (req, res) => {
    try{
        const { idToken, role } = req.body; // role optional, default worker
        if(!GOOGLE_CLIENT_ID) return res.status(500).json({message:"Google client not configured"});
        const client = new OAuth2Client(GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        const email = normalizeEmail(payload.email);
        const name = payload.name || payload.email.split('@')[0];
        const googleId = payload.sub;

        const pickedRole = normalizeRole(role) || 'worker';
        const existingAccount = await findUserByEmailOnly(email);
        if (existingAccount && existingAccount.role !== pickedRole) {
            return res.status(403).json({
                message: `This Google account is registered as ${existingAccount.role}. Please use the ${existingAccount.role} login page.`
            });
        }

        // find existing
        let user = existingAccount?.user || null;
        if(!user){
            const username = await createAvailableUsername(name || email.split('@')[0]);
            if(pickedRole === 'employer'){
                user = new Employer({ username, email, password: await bcrypt.hash(googleId, BCRYPT_ROUNDS), role:'employer', loginProvider:'google', companyName: username });
            }else{
                user = new Worker({ username, email, password: await bcrypt.hash(googleId, BCRYPT_ROUNDS), role:'worker', loginProvider:'google' });
            }
            await user.save();
        }else{
            user.loginProvider = 'google';
            await user.save();
        }

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
        res.json({ token, role: user.role, userId: user._id, username: user.username });
    }catch(err){
        console.error("Google auth error", err);
        res.status(401).json({message:"Google login failed"});
    }
});

// Forgot password (email OTP)
function generateCode(){ return Math.floor(100000 + Math.random()*900000).toString(); }

function getAuthDestination(role) {
    return role === 'employer' ? '/employer/home.html' : '/worker/home.html';
}

function buildAuthPayload(user) {
    return {
        id: user._id,
        role: user.role,
        username: user.username
    };
}

async function sendResetEmail(email, code, user){
    const name = user?.username || 'VIPs user';
    await sendEmail({
        to: email,
        subject: 'Your VIPs password reset OTP',
        text: `Hi ${name},\n\nYour VIPs password reset OTP is ${code}. It expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px;">
                <h2 style="margin:0 0 8px;color:#0f172a;">VIPs password reset</h2>
                <p style="color:#475569;">Hi ${name}, use this OTP to continue your password reset.</p>
                <div style="font-size:32px;letter-spacing:8px;font-weight:800;color:#2563eb;background:#eff6ff;padding:18px;text-align:center;border-radius:12px;">${code}</div>
                <p style="color:#64748b;font-size:13px;">This code expires in 15 minutes. If you did not request it, ignore this email.</p>
            </div>
        `
    });
}

async function sendPasswordChangedEmail(email, user){
    const name = user?.username || 'VIPs user';
    await sendEmail({
        to: email,
        subject: 'Your VIPs password was changed',
        text: `Hi ${name},\n\nYour VIPs password has been changed successfully. If this was not you, reset your password immediately.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px;">
                <h2 style="margin:0 0 8px;color:#0f172a;">Password changed</h2>
                <p style="color:#475569;">Hi ${name}, your VIPs password has been changed successfully.</p>
                <p style="color:#64748b;font-size:13px;">If this was not you, please request a new OTP and reset your password immediately.</p>
            </div>
        `
    });
}

function validateResetToken(resetToken, email) {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.purpose !== 'password-reset' || decoded.email !== email) {
        throw new Error('Invalid reset session');
    }
    return decoded;
}

app.post('/api/auth/forgot', otpRateLimit, async (req,res)=>{
    try{
        const { email, identifier, role } = req.body;
        const accountIdentifier = String(identifier || email || '').trim();
        const recoveryRole = role === 'employer' ? 'employer' : 'worker';
        if(!accountIdentifier) return res.status(400).json({message:"Email or username required"});
        let user = await findUserByEmail(accountIdentifier, recoveryRole);
        if(!user) return res.status(404).json({message:"User not found"});
        const accountEmail = normalizeEmail(user.email);
        if(!accountEmail) return res.status(400).json({message:"This account does not have an email address"});
        const code = generateCode();
        user.resetCode = await bcrypt.hash(code, BCRYPT_ROUNDS);
        user.resetCodeExpires = new Date(Date.now()+15*60*1000);
        await user.save();
        try {
            await sendResetEmail(accountEmail, code, user);
        } catch (mailErr) {
            console.error("OTP email error", {
                code: mailErr?.code,
                responseCode: mailErr?.responseCode,
                response: mailErr?.response,
                message: mailErr?.message,
                to: maskEmail(accountEmail),
                emailConfig: getEmailConfigStatus()
            });
            return res.status(502).json({message:getMailErrorMessage(mailErr)});
        }
        res.json({
            message:`OTP sent to ${maskEmail(accountEmail)}`,
            email:accountEmail,
            maskedEmail:maskEmail(accountEmail),
            role:user.role
        });
    }catch(err){
        console.error("Forgot error", err);
        res.status(500).json({message:"Failed to send code"});
    }
});

app.post('/api/auth/verify-otp', otpRateLimit, async (req,res)=>{
    try{
        const { email, identifier, code, role } = req.body;
        const accountIdentifier = String(identifier || email || '').trim();
        const recoveryRole = role === 'employer' ? 'employer' : 'worker';
        if(!accountIdentifier || !code) return res.status(400).json({message:"Email or username and OTP are required"});
        const user = await findUserByEmail(accountIdentifier, recoveryRole);
        if(!user || !user.resetCode || !user.resetCodeExpires) return res.status(400).json({message:"Invalid OTP"});
        const otpMatches = await bcrypt.compare(String(code || '').trim(), user.resetCode);
        if(!otpMatches) return res.status(400).json({message:"Invalid OTP"});
        if(user.resetCodeExpires < new Date()) return res.status(400).json({message:"OTP expired"});
        const accountEmail = normalizeEmail(user.email);

        const authToken = jwt.sign(buildAuthPayload(user), JWT_SECRET, { expiresIn: TOKEN_TTL });
        const resetToken = jwt.sign(
            { id:user._id, role:user.role, email:accountEmail, purpose:'password-reset' },
            JWT_SECRET,
            { expiresIn:'15m' }
        );

        res.json({
            message:"OTP verified",
            token: authToken,
            resetToken,
            role: user.role,
            userId: user._id,
            username: user.username,
            email: accountEmail,
            maskedEmail: maskEmail(accountEmail),
            redirect: getAuthDestination(user.role)
        });
    }catch(err){
        console.error("OTP verify error", err);
        res.status(500).json({message:"Failed to verify OTP"});
    }
});

app.post('/api/auth/reset', authRateLimit, async (req,res)=>{
    try{
        const { email, identifier, code, newPassword, resetToken, role } = req.body;
        const accountIdentifier = String(identifier || email || '').trim();
        const accountEmailFromRequest = normalizeEmail(email);
        const recoveryRole = role === 'employer' ? 'employer' : 'worker';
        if(!accountIdentifier || !newPassword) return res.status(400).json({message:"Missing fields"});
        const passwordError = validatePassword(newPassword);
        if (passwordError) return res.status(400).json({message: passwordError});
        let user = null;
        let decodedReset = null;

        if(resetToken){
            if(!accountEmailFromRequest) return res.status(400).json({message:"Missing fields"});
            decodedReset = validateResetToken(resetToken, accountEmailFromRequest);
            user = await findUserById(decodedReset.id, decodedReset.role);
        }else{
            user = await findUserByEmail(accountIdentifier, recoveryRole);
        }

        if(!user) return res.status(400).json({message:"User not found"});
        const accountEmail = normalizeEmail(user.email);

        if(resetToken){
            if (
                String(user._id) !== String(decodedReset.id) ||
                user.role !== decodedReset.role ||
                accountEmail !== decodedReset.email
            ) {
                return res.status(401).json({message:"Failed to reset password"});
            }
        }else{
            if(!code || !user.resetCode || !user.resetCodeExpires) return res.status(400).json({message:"Invalid OTP"});
            const otpMatches = await bcrypt.compare(String(code || '').trim(), user.resetCode);
            if(!otpMatches) return res.status(400).json({message:"Invalid OTP"});
            if(user.resetCodeExpires < new Date()) return res.status(400).json({message:"OTP expired"});
        }

        user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        user.resetCode = null;
        user.resetCodeExpires = null;
        user.loginProvider = 'local';
        await user.save();
        await sendPasswordChangedEmail(accountEmail, user);

        const token = jwt.sign(buildAuthPayload(user), JWT_SECRET, { expiresIn: TOKEN_TTL });
        res.json({
            message:"Password changed successfully",
            token,
            role:user.role,
            userId:user._id,
            username:user.username,
            redirect:getAuthDestination(user.role)
        });
    }catch(err){
        console.error("Reset error", err);
        res.status(401).json({message:"Failed to reset password"});
    }
});
app.get('/api/auth/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token" });
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await findUserById(decoded.id, decoded.role);

        if (!user) return res.status(404).json({ message: "User not found" });
        const data = publicUser(user);
        if (data.role === 'employer') data.subscription = getSubscriptionState(data);
        res.json(data);
    } catch (err) { 
        res.status(401).json({ message: "Invalid token" }); 
    }
});

app.post('/api/settings/language', authMiddleware, async (req, res) => {
    try {
        const allowedLanguages = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'ur'];
        const language = allowedLanguages.includes(req.body.language) ? req.body.language : 'en';
        const Model = req.user.role === 'employer' ? Employer : Worker;
        const updatedUser = await Model.findByIdAndUpdate(
            req.user._id,
            { $set: { 'settings.language': language } },
            { new: true }
        );
        res.json({ message: "Language updated", language, settings: updatedUser.settings || {} });
    } catch (err) {
        console.error("Language update failed:", err);
        res.status(500).json({ message: "Language update failed" });
    }
});
// --- SEARCH & PROFILE ---
app.get('/api/users/search', async (req, res) => {
    const query = cleanText(req.query.q, 80);
    try {
        const regex = new RegExp(escapeRegex(query), 'i');
        const filter = query ? { username: regex } : {};
        const workers = await Worker.find(filter)
            .select('username profilePicture role followers followRequests mainCategory profession location settings')
            .limit(20);
        const employers = await Employer.find(filter)
            .select('username profilePicture role followers followRequests mainCategory settings companyName location')
            .limit(20);
        res.json([...workers, ...employers]);
    } catch (err) { res.status(500).json({ message: "Search failed" }); }
});

app.get('/api/search/global', async (req, res) => {
    try {
        const query = cleanText(req.query.q, 80);
        if (!query) return res.json([]);
        const regex = new RegExp(escapeRegex(query), 'i');
        let viewerRole = '';
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) viewerRole = jwt.verify(token, JWT_SECRET).role || '';
        } catch (e) {}
        const [jobs, workers, employers, portfolioWorkers, portfolioEmployers] = await Promise.all([
            Job.find({
                status: 'open',
                $or: [
                    { title: regex },
                    { details: regex },
                    { category: regex },
                    { location: regex },
                    { tasks: regex }
                ]
            }).select('title category location createdAt employerId').populate('employerId', 'username companyName').sort({ createdAt: -1 }).limit(8).lean(),
            Worker.find({
                $or: [
                    { username: regex },
                    { mainCategory: regex },
                    { profession: regex },
                    { 'categories.name': regex },
                    { 'categories.tags': regex },
                    { location: regex }
                ]
            }).select('username profilePicture role mainCategory profession location').limit(8).lean(),
            Employer.find({
                $or: [
                    { username: regex },
                    { companyName: regex },
                    { mainCategory: regex },
                    { location: regex }
                ]
            }).select('username companyName profilePicture role mainCategory location').limit(8).lean(),
            Worker.find({ 'projects.title': regex }).select('username role profilePicture projects').limit(6).lean(),
            Employer.find({ 'projects.title': regex }).select('username companyName role profilePicture projects').limit(6).lean()
        ]);

        const serviceNames = ['General Labour', 'Loading', 'Cleaning', 'Construction', 'Helper', 'Delivery', 'Food & Restaurant', 'Grocery Delivery', 'Medical & Pharmaceutical', 'Long-Distance Trucking', 'Skilled Workers', 'Electrician', 'Plumber', 'Carpenter', 'Welder'];
        const services = serviceNames
            .filter(name => regex.test(name))
            .slice(0, 8)
            .map(name => ({ type: 'service', id: name, title: name, subtitle: 'Service category', url: viewerRole === 'employer' ? `/employer/worker-list.html?job=${encodeURIComponent(name)}` : `/worker/home.html?service=${encodeURIComponent(name)}` }));

        const projectResults = [...portfolioWorkers, ...portfolioEmployers].flatMap(user =>
            (user.projects || [])
                .filter(project => regex.test(project.title || '') || regex.test(project.description || ''))
                .slice(0, 2)
                .map(project => ({
                    type: 'post',
                    id: project._id,
                    title: project.title || 'Portfolio post',
                    subtitle: user.companyName || user.username || 'Profile showcase',
                    url: user.role === 'employer' ? `/employer/public-profile.html?id=${user._id}&project=${project._id}` : `/worker/profile.html?id=${user._id}&project=${project._id}`
                }))
        ).slice(0, 8);

        const results = [
            ...jobs.map(job => ({
                type: 'job',
                id: job._id,
                title: job.title,
                subtitle: `${job.category || 'Job'}${job.location ? ` - ${job.location}` : ''}`,
                url: `/worker/home.html?job=${job._id}`
            })),
            ...services,
            ...projectResults,
            ...workers.map(worker => ({
                type: 'worker',
                id: worker._id,
                title: worker.username,
                subtitle: worker.mainCategory || (worker.profession || []).join(', ') || 'Worker',
                image: worker.profilePicture || '',
                url: viewerRole === 'employer' ? `/employer/view-worker.html?id=${worker._id}` : `/worker/profile.html?id=${worker._id}`
            })),
            ...employers.map(employer => ({
                type: 'employer',
                id: employer._id,
                title: employer.companyName || employer.username,
                subtitle: employer.mainCategory || 'Employer',
                image: employer.profilePicture || '',
                url: viewerRole === 'employer' ? `/employer/profile.html?id=${employer._id}` : `/employer/public-profile.html?id=${employer._id}`
            }))
        ];

        res.json(results.slice(0, 30));
    } catch (err) {
        console.error('Global search failed:', err);
        res.status(500).json({ message: 'Search failed' });
    }
});

app.get('/api/employers/public/:id', async (req, res) => {
    try {
        const employerId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(employerId)) {
            return res.status(400).json({ message: "Invalid employer" });
        }

        const employer = await Employer.findById(employerId)
            .select('username companyName profilePicture coverImage bio location website services mainCategory followers following followRequests projects ratingAverage ratingCount subscription createdAt')
            .lean();

        if (!employer) return res.status(404).json({ message: "Employer not found" });

        const viewer = await getOptionalViewer(req);
        const viewerId = viewer?._id?.toString();
        const openJobs = await Job.find({ employerId, status: 'open' })
            .select('title details hourlyFee totalFee hours location tasks category createdAt')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        const followers = employer.followers || [];
        const followRequests = employer.followRequests || [];
        const isFollowing = Boolean(viewerId && followers.some(id => id.toString() === viewerId));
        const hasRequested = Boolean(viewerId && followRequests.some(id => id.toString() === viewerId));
        const subscription = getSubscriptionState(employer);

        res.json({
            _id: employer._id,
            role: 'employer',
            companyName: employer.companyName || employer.username,
            username: employer.username,
            employerName: employer.username,
            profilePicture: employer.profilePicture || '',
            coverImage: employer.coverImage || '',
            bio: employer.bio || '',
            companyDescription: employer.bio || '',
            location: employer.location || '',
            website: employer.website || '',
            services: employer.services || [],
            mainCategory: employer.mainCategory || 'General Business',
            businessCategory: employer.mainCategory || 'General Business',
            postedJobs: openJobs,
            publicPosts: employer.projects || [],
            followersCount: followers.length,
            followingCount: (employer.following || []).length,
            joinDate: employer.createdAt || null,
            verified: Boolean(subscription.premium),
            ratingAverage: employer.ratingAverage || 0,
            ratingCount: employer.ratingCount || 0,
            isFollowing,
            hasRequested,
            viewerRole: viewer?.role || null
        });
    } catch (err) {
        console.error("Employer public profile error:", err);
        res.status(500).json({ message: "Failed to load employer profile" });
    }
});

// --- SOCIAL / FOLLOW SYSTEM (PUBLIC) ---


// GET Settings for the settings page to load correctly
app.get('/api/employer/settings', authMiddleware, requireRole('employer'), async (req, res) => {
    try {
        const user = await Employer.findById(req.user._id).select('settings');
        if (!user) return res.status(404).json({ error: "Employer not found" });
        res.json(user.settings || { followToView: false, autoAccept: true });
    } catch (err) { res.status(500).json({ error: "Failed to load" }); }
});
// --- 1. UPDATED FOLLOW LOGIC (Instagram Style) ---
app.post('/api/users/follow/:targetId', authMiddleware, async (req, res) => {
    try {
        const myId = req.user._id;
        const targetId = req.params.targetId;
        if (!isValidObjectId(targetId)) return res.status(400).json({ message: "Invalid user id" });

        if (myId.toString() === targetId.toString()) return res.status(400).json({ message: "Cannot follow yourself" });

        // 1. Find Target & Me
        let targetUser = await Worker.findById(targetId) || await Employer.findById(targetId);
        let me = req.user;
        
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
        const updates = {};
        if (typeof followToView === 'boolean') updates['settings.followToView'] = followToView;
        if (typeof autoAccept === 'boolean') updates['settings.autoAccept'] = autoAccept;
        
        const updated = await Employer.findByIdAndUpdate(
            req.user._id, 
            Object.keys(updates).length ? { $set: updates } : {},
            { new: true }
        );
        
        res.json({ message: "Settings updated", settings: updated.settings });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});// This tells the server to look for HTML files in your main folder
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
// --- UPDATE PROFILE ROUTE ---
app.put('/api/profile/update', (req, res, next) => {
    // 1. Handle potential file upload first
    upload.single('profilePicture')(req, res, (err) => {
        if (err) return res.status(400).json({ message: "File upload error: " + err.message });
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token provided" });
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = await findUserById(decoded.id, decoded.role);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        const updateData = {};
        const canUpdate = (field) => Object.prototype.hasOwnProperty.call(req.body, field);
        const clean = (field, max = 1000) => cleanText(req.body[field], max);

        if (canUpdate('username')) {
            const username = clean('username', 40);
            if (!username) return res.status(400).json({ message: "Username is required" });
            if (!/^[a-zA-Z0-9_. -]{3,40}$/.test(username)) {
                return res.status(400).json({ message: "Username must be 3-40 characters and use letters, numbers, spaces, dots, underscores or hyphens" });
            }
            const exactCaseInsensitive = new RegExp(`^${escapeRegex(username)}$`, 'i');
            const [workerMatch, employerMatch] = await Promise.all([
                Worker.findOne({ username: exactCaseInsensitive }).select('_id'),
                Employer.findOne({ username: exactCaseInsensitive }).select('_id')
            ]);
            const duplicate = [workerMatch, employerMatch].some(match => match && match._id.toString() !== decoded.id.toString());
            if (duplicate) return res.status(409).json({ message: "Change username. It is already used by someone." });
            updateData.username = username;
            if (currentUser.role === 'employer' && !canUpdate('companyName')) updateData.companyName = username;
        }
        if (canUpdate('location')) updateData.location = clean('location', 180);
        if (canUpdate('phone')) {
            const phone = clean('phone', 24);
            if (phone && !/^[0-9+\-() ]{7,24}$/.test(phone)) {
                return res.status(400).json({ message: "Enter a valid phone number" });
            }
            updateData.phone = phone;
        }
        if (canUpdate('bio')) updateData.bio = clean('bio', 1000);
        if (canUpdate('companyName')) updateData.companyName = clean('companyName', 80);
        if (canUpdate('category')) updateData.category = clean('category', 80);
        if (canUpdate('mainCategory')) updateData.mainCategory = clean('mainCategory', 80);
        if (req.file) updateData.profilePicture = `/uploads/${req.file.filename}`;

        // 3. Handle Profession Tags & Multi-Category Logic for Workers
        if (canUpdate('profession') || canUpdate('mainCategory')) {
            let professionTags = [];
            try {
                professionTags = JSON.parse(req.body.profession || "[]");
            } catch (e) { 
                professionTags = req.body.profession ? [req.body.profession] : []; 
            }
            professionTags = (Array.isArray(professionTags) ? professionTags : [professionTags])
                .map(tag => cleanText(tag, 60))
                .filter(Boolean)
                .slice(0, 20);

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

        const Model = currentUser.role === 'employer' ? Employer : Worker;
        let updatedUser = await Model.findByIdAndUpdate(decoded.id, { $set: updateData }, { new: true }).select('-password');

        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        // 5. Send ONE single response back
        res.json({ 
            message: "Profile updated successfully", 
            user: updatedUser,
            location: updatedUser.location 
        });

    } catch (err) {
        console.error("Update Error:", err);
        if (err?.code === 11000) return res.status(409).json({ message: "Username or email already exists" });
        res.status(500).json({ message: "Server error" });
    }
});

// --- PORTFOLIO: create project with up to 10 media ---
app.post('/api/profile/portfolio', (req, res, next) => {
    upload.array('workMedia', 10)(req, res, (err) => {
        if (err) return res.status(400).json({ message: "Upload error: " + err.message });
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

        const title = cleanText(req.body.title || 'New Project', 120) || 'New Project';

        let user = await Worker.findById(decoded.id);
        if (!user) user = await Employer.findById(decoded.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const duplicate = (user.projects || []).some(p => (p.title || '').trim().toLowerCase() === title.toLowerCase());
        if (duplicate) return res.status(400).json({ message: "Project name must be unique" });

        user.projects.push({
            title,
            description: cleanText(req.body.description, 1500),
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

        const cleanTitle = cleanText(title, 120);
        const normalized = cleanTitle.toLowerCase();
        const duplicate = user.projects.some(p => p._id.toString() !== projectId && (p.title || '').trim().toLowerCase() === normalized);
        if(duplicate) return res.status(400).json({ message:"Project name must be unique" });

        project.title = cleanTitle;
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
app.delete('/api/profile/portfolio/:projectId/media/:mediaId', authMiddleware, async (req,res)=>{
    try{
        const { projectId, mediaId } = req.params;
        if (!isValidObjectId(projectId) || !isValidObjectId(mediaId)) return res.status(400).json({ message:"Invalid project or media id" });
        let user = await Worker.findOneAndUpdate(
            { _id: req.user._id, "projects._id": projectId },
            { $pull: { "projects.$.media": { _id: mediaId } } },
            { new: true }
        );
        if(!user){
            user = await Employer.findOneAndUpdate(
                { _id: req.user._id, "projects._id": projectId },
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
        if(err) return res.status(400).json({ message:"Upload error: "+err.message });
        next();
    });
}, authMiddleware, async (req,res)=>{
    try{
        const { projectId, mediaId } = req.params;
        if (!isValidObjectId(projectId) || !isValidObjectId(mediaId)) return res.status(400).json({ message:"Invalid project or media id" });
        if(!req.file) return res.status(400).json({ message:"No file uploaded" });
        const media = { url:`/uploads/${req.file.filename}`, type:'image' };
        let user = await Worker.findOneAndUpdate(
            { _id: req.user._id, "projects._id": projectId, "projects.media._id": mediaId },
            { $set: { "projects.$[p].media.$[m].url": media.url, "projects.$[p].media.$[m].type": media.type } },
            { new:true, arrayFilters:[{ "p._id": projectId }, { "m._id": mediaId }] }
        );
        if(!user){
            user = await Employer.findOneAndUpdate(
                { _id: req.user._id, "projects._id": projectId, "projects.media._id": mediaId },
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
        if(err) return res.status(400).json({ message:"Upload error: "+err.message });
        next();
    });
}, authMiddleware, async (req,res)=>{
    try{
        const { projectId } = req.params;
        if (!isValidObjectId(projectId)) return res.status(400).json({ message:"Invalid project id" });
        if(!req.files || !req.files.length) return res.status(400).json({ message:"No files uploaded" });

        const mediaToAdd = req.files.map(f=>({ url:`/uploads/${f.filename}`, type:'image' }));

        let user = await Worker.findOne({ _id: req.user._id, "projects._id": projectId });
        if(!user){
            user = await Employer.findOne({ _id: req.user._id, "projects._id": projectId });
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
        
        const user = await Worker.findById(decoded.id) || await Employer.findById(decoded.id);
            
        if (!user) return res.json([]);
        const rawNotifs = user.notifications || [];
        const actorIds = rawNotifs.map(n => n.user).filter(Boolean);
        const [workers, employers] = await Promise.all([
            Worker.find({ _id: { $in: actorIds } }).select('username profilePicture role').lean(),
            Employer.find({ _id: { $in: actorIds } }).select('username companyName profilePicture role').lean()
        ]);
        const actors = new Map([...workers, ...employers].map(actor => [actor._id.toString(), actor]));
        const sortedNotifs = rawNotifs
            .map(notification => {
                const item = notification.toObject ? notification.toObject() : notification;
                const actor = item.user ? actors.get(item.user.toString()) : null;
                return { ...item, user: actor || item.user };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(sortedNotifs);
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
});

app.post('/api/notifications/mark-read', authMiddleware, async (req, res) => {
    try {
        req.user.notifications = (req.user.notifications || []).map(notification => {
            notification.read = true;
            return notification;
        });
        await req.user.save();
        res.json({ message: "Notifications marked as read" });
    } catch (err) {
        console.error("Mark notifications read failed:", err);
        res.status(500).json({ message: "Failed to mark notifications as read" });
    }
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
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Only employers can accept worker requests" });
        }
        const myId = req.user._id; // The Employer
        const requesterId = req.params.requesterId; // The Worker
        if (!mongoose.Types.ObjectId.isValid(requesterId)) {
            return res.status(400).json({ message: "Invalid worker" });
        }

        const worker = await Worker.findById(requesterId).select('username profilePicture role location phone email profession mainCategory categories ratingAverage ratingCount completedJobs experienceLevel');
        if (!worker) return res.status(404).json({ message: "Worker not found" });

        // 1. Update Employer: Remove from requests, add to followers (Total Hired)
        const employer = await Employer.findOneAndUpdate({
            _id: myId,
            followRequests: requesterId
        }, {
            $pull: { followRequests: requesterId, notifications: { user: requesterId, type: 'request' } },
            $addToSet: { followers: requesterId } 
        }, { new: true }).select('followers followRequests');

        if (!employer) return res.status(404).json({ message: "Request not found" });

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

        res.json({ message: "Request accepted and Worker added to Hired list", worker, followers: employer.followers, followRequests: employer.followRequests });
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
app.get('/api/reviews/user/:userId', async (req, res) => {
    try {
        const reviews = await Review.find({ revieweeId: req.params.userId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load reviews' });
    }
});

app.post('/api/reviews', authMiddleware, async (req, res) => {
    try {
        const rating = Number(req.body.rating);
        const text = String(req.body.text || '').trim();
        const sourceType = req.body.sourceType === 'invite' ? 'invite' : 'application';
        const sourceId = req.body.sourceId;

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }
        if (!sourceId || !mongoose.Types.ObjectId.isValid(sourceId)) {
            return res.status(400).json({ message: 'Invalid job reference' });
        }

        let source;
        let employerId;
        let workerId;
        let jobId = null;
        if (sourceType === 'application') {
            source = await JobApplication.findById(sourceId);
            if (!source || source.status !== 'completed') {
                return res.status(400).json({ message: 'Reviews are available after job completion' });
            }
            employerId = source.employerId;
            workerId = source.workerId;
            jobId = source.jobId;
        } else {
            source = await JobInvite.findById(sourceId);
            if (!source || source.status !== 'completed') {
                return res.status(400).json({ message: 'Reviews are available after job completion' });
            }
            employerId = source.employerId;
            workerId = source.workerId;
        }

        const reviewerId = req.user._id;
        const isEmployerReview = req.user.role === 'employer' && employerId.toString() === reviewerId.toString();
        const isWorkerReview = req.user.role === 'worker' && workerId.toString() === reviewerId.toString();
        if (!isEmployerReview && !isWorkerReview) {
            return res.status(403).json({ message: 'You can only review jobs connected to your account' });
        }

        const revieweeId = isEmployerReview ? workerId : employerId;
        const review = await Review.findOneAndUpdate(
            { reviewerId, revieweeId, sourceType, sourceId },
            {
                $setOnInsert: {
                    employerId,
                    workerId,
                    jobId,
                    inviteId: sourceType === 'invite' ? sourceId : null,
                    applicationId: sourceType === 'application' ? sourceId : null,
                    reviewerRole: req.user.role
                },
                $set: { rating, text }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await refreshRatingSummary(isEmployerReview ? Worker : Employer, revieweeId);
        res.json({ message: 'Review saved', review });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ message: 'You already reviewed this job' });
        }
        console.error('Review save failed:', err);
        res.status(500).json({ message: 'Failed to save review' });
    }
});

app.post('/api/employer/job-requests/:appId/complete', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: 'Only employers can complete jobs' });
        }
        const appDoc = await JobApplication.findOneAndUpdate(
            { _id: req.params.appId, employerId: req.user._id, status: 'accepted' },
            { $set: { status: 'completed', completedAt: new Date(), workerSeen: false } },
            { new: true }
        ).populate('jobId', 'title');
        if (!appDoc) return res.status(404).json({ message: 'Accepted job request not found' });
        await addWorkerHistory(appDoc.workerId, {
            title: appDoc.jobId?.title || 'Completed Job',
            employerId: req.user._id,
            sourceType: 'application',
            sourceId: appDoc._id,
            completedAt: appDoc.completedAt
        });
        res.json({ message: 'Job marked completed', application: appDoc });
    } catch (err) {
        console.error('Complete job request failed:', err);
        res.status(500).json({ message: 'Failed to complete job' });
    }
});

app.post('/api/jobs/invites/:inviteId/complete', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: 'Only employers can complete invited jobs' });
        }
        const invite = await JobInvite.findOneAndUpdate(
            { _id: req.params.inviteId, employerId: req.user._id, status: 'accepted' },
            { $set: { status: 'completed', completedAt: new Date() } },
            { new: true }
        );
        if (!invite) return res.status(404).json({ message: 'Accepted invite not found' });
        await addWorkerHistory(invite.workerId, {
            title: invite.jobTitle || 'Completed Invite',
            employerId: req.user._id,
            sourceType: 'invite',
            sourceId: invite._id,
            completedAt: invite.completedAt
        });
        res.json({ message: 'Invite marked completed', invite });
    } catch (err) {
        console.error('Complete invite failed:', err);
        res.status(500).json({ message: 'Failed to complete invite' });
    }
});

app.post('/api/jobs/create', inviteRateLimit, authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: 'Only employers can post jobs' });
        }
        const title = cleanText(req.body.title, 120);
        const details = cleanText(req.body.details, 3000);
        const totalFee = cleanText(req.body.totalFee, 60);
        const hours = cleanText(req.body.hours, 60);
        if (!title || !details || !totalFee || !hours) {
            return res.status(400).json({ message: 'Title, details, total fee and hours are required' });
        }
        if (title.length > 120 || details.length > 3000) {
            return res.status(400).json({ message: 'Job details are too long' });
        }

        const newJob = new Job({
            employerId: req.user._id,
            title,
            details,
            hourlyFee: cleanText(req.body.hourlyFee, 60),
            totalFee,
            hours,
            workDetails: cleanText(req.body.workDetails, 1500),
            tasks: cleanText(req.body.tasks, 1500),
            category: cleanText(req.body.category, 80),
            location: cleanText(req.body.location, 180)
        });

        await newJob.save();
        res.status(201).json({ message: "Job Created", job: newJob });
    } catch (err) {
        console.error('Create job failed:', err);
        res.status(500).json({ error: "Failed to create job" });
    }
});

function buildJobUpdate(req) {
    const title = cleanText(req.body.title, 120);
    const details = cleanText(req.body.details, 3000);
    const totalFee = cleanText(req.body.totalFee, 60);
    const hours = cleanText(req.body.hours, 60);
    const status = String(req.body.status || 'open').trim().toLowerCase();
    if (!title || !details || !totalFee || !hours) {
        return { error: 'Title, details, total fee and hours are required' };
    }
    if (title.length > 120 || details.length > 3000) {
        return { error: 'Job details are too long' };
    }
    if (!['open', 'closed'].includes(status)) {
        return { error: 'Status must be open or closed' };
    }
    return {
        data: {
            title,
            details,
            hourlyFee: cleanText(req.body.hourlyFee, 60),
            totalFee,
            hours,
            workDetails: cleanText(req.body.workDetails, 1500),
            tasks: cleanText(req.body.tasks, 1500),
            category: cleanText(req.body.category, 80),
            location: cleanText(req.body.location, 180),
            status
        }
    };
}

app.get('/api/jobs/detail/:jobId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) {
            return res.status(400).json({ message: 'Invalid job id' });
        }
        const job = await Job.findOne({ _id: req.params.jobId, status: 'open' })
            .populate('employerId', 'companyName username profilePicture location');
        if (!job) return res.status(404).json({ message: 'Job not found or no longer available' });
        res.json(job);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load job' });
    }
});

app.put('/api/jobs/:jobId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: 'Only employers can edit jobs' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) {
            return res.status(400).json({ message: 'Invalid job id' });
        }
        const built = buildJobUpdate(req);
        if (built.error) return res.status(400).json({ message: built.error });
        const job = await Job.findOneAndUpdate(
            { _id: req.params.jobId, employerId: req.user._id },
            { $set: built.data },
            { new: true }
        );
        if (!job) return res.status(404).json({ message: 'Job not found or you do not own it' });
        res.json({ message: 'Job updated successfully', job });
    } catch (err) {
        console.error('Update job failed:', err);
        res.status(500).json({ message: 'Failed to update job' });
    }
});

app.delete('/api/jobs/:jobId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: 'Only employers can delete jobs' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) {
            return res.status(400).json({ message: 'Invalid job id' });
        }
        const deleted = await Job.findOneAndDelete({ _id: req.params.jobId, employerId: req.user._id });
        if (!deleted) return res.status(404).json({ message: 'Job not found or you do not own it' });
        await JobApplication.updateMany(
            { jobId: deleted._id, status: { $nin: ['completed'] } },
            { $set: { status: 'withdrawn', workerSeen: false } }
        );
        res.json({ message: 'Job deleted successfully', jobId: deleted._id });
    } catch (err) {
        console.error('Delete job failed:', err);
        res.status(500).json({ message: 'Failed to delete job' });
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

        if (!isValidObjectId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
        const job = await Job.findOne({ _id: req.params.jobId, status: 'open' });
        if (!job) return res.status(404).json({ message: "Job not found or no longer available" });

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

        if (!isValidObjectId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
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
            status: { $in: ['applied','accepted','rejected','withdrawn','completed'] }
        })
        .populate('workerId', 'username profilePicture location phone email ratingAverage ratingCount completedJobs experienceLevel')
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
        if (!isValidObjectId(req.params.appId)) return res.status(400).json({ message: "Invalid request id" });
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
        if (!isValidObjectId(req.params.appId)) return res.status(400).json({ message: "Invalid request id" });
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
        if (!isValidObjectId(req.params.appId)) return res.status(400).json({ message: "Invalid request id" });
        const appDoc = await JobApplication.findOneAndUpdate(
            { _id: req.params.appId, employerId: req.user._id, status: 'accepted' },
            { $set: { status: 'applied', workerSeen: false } },
            { new: true }
        );
        if (!appDoc) return res.status(404).json({ message: "Accepted request not found" });
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
        if (!isValidObjectId(req.params.appId)) return res.status(400).json({ message: "Invalid request id" });
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
            status: { $in: ['accepted', 'completed'] }
        }).populate('workerId', 'username profilePicture location phone email ratingAverage ratingCount completedJobs experienceLevel');

        res.json(invites);
    } catch (err) {
        console.error("Accepted invite load error:", err);
        res.status(500).json({ error: "Failed to load accepted invites" });
    }
});
// --- DELETE SPECIFIC CATEGORY ---
app.delete('/api/profile/categories/:catName', authMiddleware, requireRole('worker'), async (req, res) => {
    try {
        const catToRemove = cleanText(req.params.catName, 80);

        const user = await Worker.findByIdAndUpdate(
            req.user._id,
            { $pull: { categories: { name: catToRemove } } },
            { new: true }
        );

        res.json({ message: "Category removed", categories: user.categories });
    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
    }
});
// --- DELETE SPECIFIC TAG FROM A CATEGORY ---
app.delete('/api/profile/categories/:catName/tags/:tagName', authMiddleware, requireRole('worker'), async (req, res) => {
    try {
        const { catName, tagName } = req.params;
        const cleanCatName = cleanText(catName, 80);
        const cleanTagName = cleanText(tagName, 80);

        // Use dot notation to find the correct category and pull the specific tag
        const user = await Worker.findOneAndUpdate(
            { _id: req.user._id, "categories.name": cleanCatName },
            { $pull: { "categories.$.tags": cleanTagName } },
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
app.get('/api/workers/filter', authMiddleware, requireRole('employer'), async (req, res) => {
try {

const { job } = req.query;

const searchTerm = cleanText(job, 80);
const searchRegex = searchTerm ? new RegExp(escapeRegex(searchTerm),'i') : /.*/;

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
workerId: { $exists: true },
status: { $in: ["pending", "accepted"] }
});

const invitedIds = invites.map(i => i.workerId.toString());

workers = workers.map(w => ({
...w,
inviteSent: invitedIds.includes(w._id.toString())
})).sort((a,b)=>{
const ratingDiff=(b.ratingAverage||0)-(a.ratingAverage||0);
if(ratingDiff!==0) return ratingDiff;
const completedDiff=(b.completedJobs||0)-(a.completedJobs||0);
if(completedDiff!==0) return completedDiff;
return (a.username||"").localeCompare(b.username||"");
});

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
        let canAcceptRequest = false;
        if (myIdStr && foundUser.role === 'worker') {
            const viewerEmployer = await Employer.findById(myIdStr).select('followRequests followers');
            canAcceptRequest = !!viewerEmployer?.followRequests?.some(id => id.toString() === targetId.toString());
        }

        // 4. Build the object
        const profileData = {
    _id: foundUser._id,
    username: foundUser.username,
    role: foundUser.role,
    bio: foundUser.bio || "",
    profilePicture: foundUser.profilePicture || "",
    location: foundUser.location || "",

    //  ADD THESE
    categories: foundUser.categories || [],
    
    skills: foundUser.skills || [],

    followRequests: foundUser.followRequests || [],
    followers: foundUser.followers || [],
    isFollowing: isFollowing,
    hasRequested: hasRequested,
    canAcceptRequest,
    followToView: privacyEnabled,
    companyName: foundUser.companyName || foundUser.username,
    ratingAverage: foundUser.ratingAverage || 0,
    ratingCount: foundUser.ratingCount || 0,
    completedJobs: foundUser.completedJobs || 0,
    experienceLevel: foundUser.experienceLevel || getExperienceLevel(foundUser.completedJobs || 0),
    jobHistory: foundUser.jobHistory || [],
    hourlyRate: foundUser.hourlyRate || 0,
    experience: foundUser.experience || "",
    projects: foundUser.projects || []
};

        if (foundUser.role === 'employer') {
            profileData.subscription = getSubscriptionState(foundUser);
        }

        // 5. Apply Privacy Masking
        // Allow view if: Not Private OR already Following OR looking at own profile OR target is a Worker
        if (!privacyEnabled || isFollowing || isOwner || foundUser.role === 'worker') {
            profileData.email = foundUser.email;
            profileData.phone = foundUser.phone || "";
        } else {
            profileData.email = " Follow to view";
            profileData.phone = " Follow to view";
            profileData.bio = "This profile is private. Follow to see details.";
        }

        res.json(profileData);
    } catch (err) {
        console.error("Profile Logic Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
});
app.get("/api/worker/invites", authMiddleware, requireRole('worker'), async (req,res)=>{

try{

const workerId = req.user._id;

let invites = await JobInvite.find({
workerId:workerId
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
app.post("/api/jobs/invite/:workerId", inviteRateLimit, authMiddleware, requireRole('employer'), async (req,res)=>{

try{

const employerId = req.user._id;
const workerId = req.params.workerId;

const {jobTitle,message, jobLocation} = req.body;
const cleanJobTitle = cleanText(jobTitle || "Job Opportunity", 120);
const cleanMessage = cleanText(message, 1000);
if (!mongoose.Types.ObjectId.isValid(workerId)) {
return res.status(400).json({message:"Invalid worker"});
}

// Normalize location; fallback to employer profile if missing/blank
const jobLocClean = cleanText(jobLocation, 180);
const finalJobLocation = jobLocClean || (req.user.location || "").trim() || "Not specified";

// fetch worker's current location snapshot
const worker = await Worker.findById(workerId).select("location");
if(!worker){
return res.status(404).json({message:"Worker not found"});
}

//  check if invite already exists
const existingInvite = await JobInvite.findOne({
employerId,
workerId,
jobTitle: cleanJobTitle,
status:"pending"
});

if(existingInvite){
return res.json({message:"Invite already sent"});
}

const invite = new JobInvite({
employerId,
workerId,
jobTitle: cleanJobTitle,
jobLocation: finalJobLocation,
workerLocationAtInvite: worker?.location || finalJobLocation,
message: cleanMessage
});

await invite.save();

const employerName = req.user.companyName || req.user.username || "An employer";
await Worker.findByIdAndUpdate(workerId, {
$push: {
notifications: {
type: "invite_sent",
user: employerId,
userModel: "Employer",
message: `${employerName} has invited you.`,
link: "/worker/home.html",
date: new Date(),
read: false
}
}
});

res.json({message:"Invite sent successfully", inviteId: invite._id, inviteSent: true});

}catch(err){

console.error(err);
res.status(500).json({message:"Invite failed"});

}

});
app.post("/api/jobs/accept/:inviteId", authMiddleware, async (req,res)=>{
try {
if (req.user.role !== 'worker') return res.status(403).json({message:"Only workers can accept invites"});
if (!isValidObjectId(req.params.inviteId)) return res.status(400).json({message:"Invalid invite"});
const invite = await JobInvite.findOneAndUpdate(
{ _id: req.params.inviteId, workerId: req.user._id, status: "pending" },
{status:"accepted"},
{new:true}
);
if (!invite) return res.status(404).json({message:"Invite not found"});
res.json({message:"Job accepted"});
} catch (err) {
console.error("Accept invite error:", err.message);
res.status(500).json({message:"Failed to accept invite"});
}

});
app.post("/api/jobs/reject/:inviteId", authMiddleware, async (req,res)=>{
try {
if (req.user.role !== 'worker') return res.status(403).json({message:"Only workers can reject invites"});
if (!isValidObjectId(req.params.inviteId)) return res.status(400).json({message:"Invalid invite"});
const invite = await JobInvite.findOneAndUpdate(
{ _id: req.params.inviteId, workerId: req.user._id, status: "pending" },
{status:"rejected"},
{new:true}
);
if (!invite) return res.status(404).json({message:"Invite not found"});
res.json({message:"Job rejected"});
} catch (err) {
console.error("Reject invite error:", err.message);
res.status(500).json({message:"Failed to reject invite"});
}

});
app.post("/api/jobs/cancel/:inviteId", authMiddleware, async (req,res)=>{
try {
if (!isValidObjectId(req.params.inviteId)) return res.status(400).json({message:"Invalid invite"});
const isEmployer = req.user.role === 'employer';
const isWorker = req.user.role === 'worker';
if (!isEmployer && !isWorker) return res.status(403).json({message:"Invalid account type"});

const query = isEmployer
? { _id: req.params.inviteId, employerId: req.user._id, status: "accepted" }
: { _id: req.params.inviteId, workerId: req.user._id, status: { $in: ["accepted", "rejected"] } };

const invite = await JobInvite.findOneAndUpdate(query, {status:"pending"}, {new:true});
if (!invite) return res.status(404).json({message:"Invite not found"});

if (isEmployer) {
const employerName = req.user.companyName || req.user.username || "An employer";
await Worker.findByIdAndUpdate(invite.workerId, {
$push: {
notifications: {
type: "invite_cancelled",
user: req.user._id,
userModel: "Employer",
message: `${employerName} moved the invitation back to pending.`,
link: "/worker/home.html",
date: new Date(),
read: false
}
}
});
}

res.json({message:"Invite cancelled"});
} catch (err) {
console.error("Cancel invite error:", err.message);
res.status(500).json({message:"Failed to cancel invite"});
}

});
app.delete("/api/jobs/invite/:workerId", authMiddleware, async (req, res) => {

try {

const employerId = req.user._id;
const workerId = req.params.workerId;
const cleanJobTitle = cleanText(req.body?.jobTitle || '', 120);
if (req.user.role !== 'employer') {
return res.status(403).json({message:"Only employers can cancel invites"});
}
if (!mongoose.Types.ObjectId.isValid(workerId)) {
return res.status(400).json({message:"Invalid worker"});
}

const query = {
employerId,
workerId,
status: { $in: ["pending", "accepted"] }
};
if (cleanJobTitle) query.jobTitle = cleanJobTitle;

const invite = await JobInvite.findOneAndDelete(query);
if (!invite) {
return res.status(404).json({message:"Active invite not found"});
}

const employerName = req.user.companyName || req.user.username || "An employer";
await Worker.findByIdAndUpdate(workerId, {
$push: {
notifications: {
type: "invite_cancelled",
user: employerId,
userModel: "Employer",
message: `${employerName} cancelled the invitation.`,
link: "/worker/home.html",
date: new Date(),
read: false
}
}
});

res.json({message:"Invite cancelled", inviteSent: false, inviteId: invite._id});

} catch(err){
console.error(err);
res.status(500).json({message:"Cancel failed"});
}

});
app.get("/api/jobs/public", async (req, res) => {

try{

const jobs = await Job.find({ status: 'open' })
.populate("employerId","username companyName location profilePicture");

// Try to get user from token if provided
let user = null;
try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = await Employer.findById(decoded.id) || await Worker.findById(decoded.id);
    }
} catch (err) {
    // Ignore auth errors, treat as anonymous
}

let jobsWithStatus = jobs;
if (user && user.role === 'worker') {
    const applications = await JobApplication.find({
        workerId: user._id,
        status: { $in: ['applied', 'withdrawn'] }
    });
    
    const appMap = new Map();
    applications.forEach(function(app) {
        appMap.set(app.jobId.toString(), app);
    });
    
    jobsWithStatus = [];
    jobs.forEach(function(job) {
        const app = appMap.get(job._id.toString());
        const jobObj = job.toObject();
        jobObj._applied = !!app;
        jobObj._applicationStatus = app ? app.status : undefined;
        jobsWithStatus.push(jobObj);
    });
}

res.json(jobsWithStatus);

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
            status: { $in: ['accepted','rejected','withdrawn','completed'] }
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
            { workerId: req.user._id, status: { $in: ['accepted','rejected','withdrawn','completed'] } },
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

// --- APPLY EXTERNAL ROUTES ---
app.use('/api/users', workerRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/messages/send', messageRateLimit);
app.use('/api/messages/send-image', messageRateLimit);
app.use('/api/messages', messageRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// --- SERVE INDEX.HTML FOR ROOT PATH ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- START SERVER ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error(' MONGODB_URI is missing in environment variables!');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log(' Database Connected Successfully');
        app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error(' MongoDB Connection Error:', err);
        process.exit(1); // Stop server if DB connection fails
    });
