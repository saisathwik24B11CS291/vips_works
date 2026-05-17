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
const PendingSignup = require('./models/PendingSignup');

const app = express();
const saltRounds = 10;
const isProduction = process.env.NODE_ENV === 'production';
const SIGNUP_OTP_TTL_MS = 15 * 60 * 1000;
app.set('trust proxy', 1);



// Mail + Google clients
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : '';
function cleanEnv(name) {
    return process.env[name] ? String(process.env[name]).trim() : '';
}

const RESEND_API_KEY = cleanEnv('RESEND_API_KEY');
const MAIL_FROM = cleanEnv('MAIL_FROM') || cleanEnv('SMTP_FROM') || cleanEnv('SMTP_USER');
const SMTP_HOST = cleanEnv('SMTP_HOST');
const SMTP_USER = cleanEnv('SMTP_USER');
const SMTP_PASS = process.env.SMTP_PASS ? String(process.env.SMTP_PASS).replace(/\s+/g, '') : '';
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const hasResendConfig = Boolean(RESEND_API_KEY && MAIL_FROM);
const hasSmtpConfig = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_FROM);

console.log('MAIL CONFIG:', {
    provider: hasResendConfig ? 'resend' : hasSmtpConfig ? 'smtp' : 'none',
    resendApiKey: RESEND_API_KEY ? '[SET]' : '[MISSING]',
    mailFrom: MAIL_FROM ? '[SET]' : '[MISSING]',
    smtpHost: SMTP_HOST ? '[SET]' : '[MISSING]',
    smtpUser: SMTP_USER ? '[SET]' : '[MISSING]',
    smtpPass: SMTP_PASS ? '[SET]' : '[MISSING]'
});

const mailTransporter = (() => {
    if (hasSmtpConfig) {
        return nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        });
    }
    return null;
})();

function getEmailConfigStatus() {
    return {
        provider: hasResendConfig ? 'resend' : hasSmtpConfig ? 'smtp' : null,
        resendApiKeyConfigured: Boolean(RESEND_API_KEY),
        mailFromConfigured: Boolean(MAIL_FROM),
        smtpHostConfigured: Boolean(SMTP_HOST),
        smtpUserConfigured: Boolean(SMTP_USER),
        smtpPassConfigured: Boolean(SMTP_PASS),
        smtpConfigured: hasSmtpConfig
    };
}

function getMailErrorMessage(err){
    const code = err?.code || err?.responseCode || '';
    const response = err?.response || err?.message || '';

    if (code === 'EMAIL_NOT_CONFIGURED') {
        const missing = [];
        if (!RESEND_API_KEY && !hasSmtpConfig) missing.push('RESEND_API_KEY or SMTP credentials');
        if (!MAIL_FROM) missing.push('MAIL_FROM');
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
    if(!mailTransporter){
        return 'Email service is not configured. Add RESEND_API_KEY or SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) plus MAIL_FROM in Render environment variables.';
    }
    if(code === 'EAUTH' || response.includes('Invalid login') || response.includes('Username and Password not accepted')){
        return 'Gmail SMTP authentication failed. Use a Google App Password for SMTP_PASS.';
    }
    if(code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ESOCKET'){
        return 'Could not connect to Gmail SMTP. If this is running on Render Free, SMTP ports 25, 465, and 587 are blocked; use a paid Render instance or an email HTTP API provider.';
    }
    return 'Could not send OTP email. Check Gmail SMTP settings.';
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
                from: MAIL_FROM,
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

    if (mailTransporter) {
        return mailTransporter.sendMail({
            from: MAIL_FROM,
            to,
            subject,
            text,
            html
        });
    }

    const missing = [];
    if (!RESEND_API_KEY && !hasSmtpConfig) missing.push('RESEND_API_KEY or SMTP credentials');
    if (!MAIL_FROM) missing.push('MAIL_FROM');
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

function normalizeEmail(email){
    return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username){
    return String(username || '').trim();
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

async function findUserByEmail(email) {
    const normalized = normalizeEmail(email);
    if(!normalized) return null;
    const escaped = escapeRegex(normalized);
    const exactCaseInsensitive = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };

    const query = {
        $or: [
            { email: exactCaseInsensitive },
            { username: exactCaseInsensitive }
        ]
    };

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

async function cleanupExpiredSignupOtps() {
    await PendingSignup.deleteMany({ expiresAt: { $lte: new Date() } });
}

async function removePendingSignupIndexes() {
    try {
        const indexes = await PendingSignup.collection.indexes();
        for (const index of indexes) {
            if (index.name === '_id_' || index.name === 'token_1' || index.name === 'expiresAt_1') continue;
            if (index.key?.email || index.key?.username) {
                await PendingSignup.collection.dropIndex(index.name);
            }
        }
    } catch (err) {
        console.warn('Pending signup index cleanup skipped:', err.message);
    }
}

async function savePendingSignup(signupToken, pendingSignup) {
    await PendingSignup.deleteMany({
        $or: [
            { email: pendingSignup.email },
            { username: pendingSignup.username }
        ]
    });

    try {
        return await PendingSignup.create({ token: signupToken, ...pendingSignup });
    } catch (err) {
        const isPendingDuplicate =
            err?.code === 11000 &&
            String(err?.collection || err?.message || '').toLowerCase().includes('pendingsignups');

        if (!isPendingDuplicate) throw err;

        await removePendingSignupIndexes();
        await PendingSignup.deleteMany({
            $or: [
                { email: pendingSignup.email },
                { username: pendingSignup.username }
            ]
        });
        return PendingSignup.create({ token: signupToken, ...pendingSignup });
    }
}

function createSignupToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function sendSignupOtpEmail(email, code, pendingSignup) {
    const roleLabel = pendingSignup.role === 'employer' ? 'Employer' : 'Worker';
    const safeName = escapeHtml(pendingSignup.username || 'VIPs user');
    const safeRoleLabel = escapeHtml(roleLabel);

    return sendEmail({
        to: email,
        subject: 'Your VIPs signup OTP',
        text: `Hi ${pendingSignup.username},\n\nYour VIPs ${roleLabel} signup OTP is ${code}. It expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px;">
                <h2 style="margin:0 0 8px;color:#0f172a;">Verify your VIPs ${safeRoleLabel} account</h2>
                <p style="color:#475569;">Hi ${safeName}, enter this OTP to finish creating your account.</p>
                <div style="font-size:32px;letter-spacing:8px;font-weight:800;color:#2563eb;background:#eff6ff;padding:18px;text-align:center;border-radius:12px;">${code}</div>
                <p style="color:#64748b;font-size:13px;">This code expires in 15 minutes. If you did not request it, ignore this email.</p>
            </div>
        `
    });
}

async function sendWelcomeEmail(email, user) {
    const roleLabel = user.role === 'employer' ? 'Employer' : 'Worker';
    const name = user.username || 'VIPs user';
    const safeName = escapeHtml(name);
    const safeRoleLabel = escapeHtml(roleLabel);

    return sendEmail({
        to: email,
        subject: `Welcome to VIPs, ${name}`,
        text: `Hi ${name},\n\nWelcome to VIPs ${roleLabel}.\n\nYour account is ready. Keep your profile details accurate, use a real phone number and email, and never share your password or OTP with anyone.\n\nThank you for joining VIPs.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a;">
                <h2 style="margin:0 0 12px;">Welcome to VIPs ${safeRoleLabel}</h2>
                <p>Hi ${safeName}, your account is ready.</p>
                <ul>
                    <li>Keep your profile details accurate.</li>
                    <li>Use a real phone number and email for account recovery.</li>
                    <li>Never share your password or OTP with anyone.</li>
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
            settings: { followToView: false, autoAccept: true },
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

// --- AUTH ROUTES ---
// Unified Signup: Handles both Worker and Employer safely
app.post('/api/auth/signup', async (req, res) => {
    const { role, username, email, password, phone, businessCategory } = req.body;

    try {
        const normalizedUsername = normalizeUsername(username);
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedUsername || !normalizedEmail || !password) {
            return res.status(400).json({ error: "Missing required fields" });
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

        await cleanupExpiredSignupOtps();
        await removePendingSignupIndexes();

        const signupRole = role === 'employer' ? 'employer' : 'worker';
        const code = generateCode();
        const token = createSignupToken();
        const pendingSignup = {
            role: signupRole,
            username: normalizedUsername,
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(password, 10),
            phone: String(phone || '').trim(),
            businessCategory,
            codeHash: await bcrypt.hash(code, 10),
            expiresAt: new Date(Date.now() + SIGNUP_OTP_TTL_MS),
            attempts: 0
        };

        await savePendingSignup(token, pendingSignup);

        try {
            await sendSignupOtpEmail(normalizedEmail, code, pendingSignup);
        } catch (mailErr) {
            await PendingSignup.deleteOne({ token });
            console.error("Signup OTP Email Error:", mailErr);
            return res.status(503).json({ error: getMailErrorMessage(mailErr) });
        }

        res.status(200).json({
            message: `OTP sent to ${maskEmail(normalizedEmail)}`,
            otpRequired: true,
            signupToken: token,
            email: normalizedEmail,
            maskedEmail: maskEmail(normalizedEmail),
            role: signupRole
        });
    } catch (err) { 
        console.error("Signup Error:", err);
        if (err?.code === 11000) {
            const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'account';
            if (isDuplicateFromCollection(err, 'pendingsignups')) {
                return res.status(400).json({ error: "OTP already sent for this signup. Please open the OTP page or try again." });
            }
            if (field === 'username' && (isDuplicateFromCollection(err, 'workers') || isDuplicateFromCollection(err, 'employers'))) {
                return res.status(400).json({ error: "Change username. It is already used by someone." });
            }
            if (field === 'email' && (isDuplicateFromCollection(err, 'workers') || isDuplicateFromCollection(err, 'employers'))) {
                return res.status(400).json({ error: "This email is already registered. Please login or use another email." });
            }
        }
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/auth/signup/verify', async (req, res) => {
    try {
        const { signupToken, code } = req.body;
        await cleanupExpiredSignupOtps();

        if (!signupToken || !code) {
            return res.status(400).json({ message: "Signup session and OTP are required" });
        }

        const pendingSignup = await PendingSignup.findOne({ token: signupToken });
        if (!pendingSignup) {
            return res.status(400).json({ message: "Signup OTP expired. Please register again." });
        }

        if (pendingSignup.expiresAt < new Date()) {
            await PendingSignup.deleteOne({ token: signupToken });
            return res.status(400).json({ message: "Signup OTP expired. Please register again." });
        }

        pendingSignup.attempts += 1;
        if (pendingSignup.attempts > 5) {
            await PendingSignup.deleteOne({ token: signupToken });
            return res.status(429).json({ message: "Too many wrong OTP attempts. Please register again." });
        }
        await pendingSignup.save();

        const isCodeValid = await bcrypt.compare(String(code).trim(), pendingSignup.codeHash);
        if (!isCodeValid) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        const existingUsername = await findUserByUsername(pendingSignup.username);
        if (existingUsername) {
            await PendingSignup.deleteOne({ token: signupToken });
            return res.status(400).json({ message: "Change username. It is already used by someone." });
        }

        const existingUser = await findUserByEmailOnly(pendingSignup.email);
        if (existingUser) {
            await PendingSignup.deleteOne({ token: signupToken });
            return res.status(400).json({
                message: `This email is already registered as a ${existingUser.role} account. Please login or use another email.`
            });
        }

        const createdUser = await createUserFromSignupData(pendingSignup);
        await PendingSignup.deleteOne({ token: signupToken });

        sendWelcomeEmail(pendingSignup.email, createdUser).catch((mailErr) => {
            console.error("Welcome Email Error:", getMailErrorMessage(mailErr));
        });

        const token = jwt.sign({ id: createdUser._id, role: createdUser.role }, JWT_SECRET, { expiresIn: '24h' });
        const redirect = createdUser.role === 'employer' ? '../employer/home.html' : '../worker/home.html';

        res.status(201).json({
            message: "Email verified. Account created successfully.",
            role: createdUser.role,
            userId: createdUser._id,
            token,
            redirect,
            username: createdUser.username
        });
    } catch (err) {
        console.error("Signup OTP verify error", err);
        if (err?.code === 11000) {
            const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'account';
            if (isDuplicateFromCollection(err, 'pendingsignups')) {
                return res.status(400).json({ message: "OTP already sent for this signup. Please open the OTP page or try again." });
            }
            if (field === 'username' && (isDuplicateFromCollection(err, 'workers') || isDuplicateFromCollection(err, 'employers'))) {
                return res.status(400).json({ message: "Change username. It is already used by someone." });
            }
            if (field === 'email' && (isDuplicateFromCollection(err, 'workers') || isDuplicateFromCollection(err, 'employers'))) {
                return res.status(400).json({ message: "This email is already registered. Please login or use another email." });
            }
        }
        res.status(500).json({ message: "Failed to verify signup OTP" });
    }
});

app.post('/api/auth/signup/resend', async (req, res) => {
    try {
        const { signupToken } = req.body;
        await cleanupExpiredSignupOtps();

        if (!signupToken) return res.status(400).json({ message: "Signup session is required" });
        const pendingSignup = await PendingSignup.findOne({ token: signupToken });
        if (!pendingSignup) return res.status(400).json({ message: "Signup OTP expired. Please register again." });

        const code = generateCode();
        pendingSignup.codeHash = await bcrypt.hash(code, 10);
        pendingSignup.expiresAt = new Date(Date.now() + SIGNUP_OTP_TTL_MS);
        pendingSignup.attempts = 0;
        await pendingSignup.save();

        await sendSignupOtpEmail(pendingSignup.email, code, pendingSignup);
        res.json({ message: `New OTP sent to ${maskEmail(pendingSignup.email)}` });
    } catch (err) {
        console.error("Signup OTP resend error", err);
        res.status(503).json({ message: getMailErrorMessage(err) });
    }
});
// Unified Login: Searches across both collections
// Unified Login Logic in server.js

app.post('/api/auth/login', async (req, res) => {
    const { username, password, role } = req.body;
    const SECRET = JWT_SECRET;

    try {
        // Prefer the requested role when available, then fallback to the other collection.
        let user = null;
        if (role === 'employer') {
            user = await Employer.findOne({ username }) || await Worker.findOne({ username });
        } else if (role === 'worker') {
            user = await Worker.findOne({ username }) || await Employer.findOne({ username });
        } else {
            user = await Worker.findOne({ username }) || await Employer.findOne({ username });
        }
        
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
        const email = normalizeEmail(payload.email);
        const name = payload.name || payload.email.split('@')[0];
        const googleId = payload.sub;

        // find existing
        let user = await findUserByEmail(email);
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

app.post('/api/auth/forgot', async (req,res)=>{
    try{
        const { email, identifier } = req.body;
        const accountIdentifier = String(identifier || email || '').trim();
        if(!accountIdentifier) return res.status(400).json({message:"Email or username required"});
        let user = await findUserByEmail(accountIdentifier);
        if(!user) return res.status(404).json({message:"User not found"});
        const accountEmail = normalizeEmail(user.email);
        if(!accountEmail) return res.status(400).json({message:"This account does not have an email address"});
        const code = generateCode();
        user.resetCode = code;
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

app.post('/api/auth/verify-otp', async (req,res)=>{
    try{
        const { email, identifier, code } = req.body;
        const accountIdentifier = String(identifier || email || '').trim();
        if(!accountIdentifier || !code) return res.status(400).json({message:"Email or username and OTP are required"});
        const user = await findUserByEmail(accountIdentifier);
        if(!user || !user.resetCode || !user.resetCodeExpires) return res.status(400).json({message:"Invalid OTP"});
        if(user.resetCode !== code.trim()) return res.status(400).json({message:"Invalid OTP"});
        if(user.resetCodeExpires < new Date()) return res.status(400).json({message:"OTP expired"});
        const accountEmail = normalizeEmail(user.email);

        const authToken = jwt.sign(buildAuthPayload(user), JWT_SECRET, { expiresIn: '24h' });
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

app.post('/api/auth/reset', async (req,res)=>{
    try{
        const { email, identifier, code, newPassword, resetToken } = req.body;
        const accountIdentifier = String(identifier || email || '').trim();
        if(!accountIdentifier || !newPassword) return res.status(400).json({message:"Missing fields"});
        let user = await findUserByEmail(accountIdentifier);
        if(!user) return res.status(400).json({message:"User not found"});
        const accountEmail = normalizeEmail(user.email);

        if(resetToken){
            validateResetToken(resetToken, accountEmail);
        }else{
            if(!code || !user.resetCode || !user.resetCodeExpires) return res.status(400).json({message:"Invalid OTP"});
            if(user.resetCode !== code.trim()) return res.status(400).json({message:"Invalid OTP"});
            if(user.resetCodeExpires < new Date()) return res.status(400).json({message:"OTP expired"});
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetCode = null;
        user.resetCodeExpires = null;
        user.loginProvider = 'local';
        await user.save();
        await sendPasswordChangedEmail(accountEmail, user);

        const token = jwt.sign(buildAuthPayload(user), JWT_SECRET, { expiresIn: '24h' });
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
        if (req.body.companyName) updateData.companyName = req.body.companyName;
        if (req.body.category) updateData.category = req.body.category;
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
const Job = require('./models/job');

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
workerId: { $exists: true },
status: { $in: ["pending", "accepted"] }
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
app.post("/api/jobs/cancel/:inviteId", authMiddleware, async (req,res)=>{

await JobInvite.findByIdAndUpdate(
req.params.inviteId,
{status:"pending"}
);

res.json({message:"Invite cancelled"});

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

// --- APPLY EXTERNAL ROUTES ---
app.use('/api/users', workerRoutes);
app.use('/api/employer', employerRoutes);
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
    console.error('❌ MONGODB_URI is missing in environment variables!');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Database Connected Successfully');
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1); // Stop server if DB connection fails
    });
