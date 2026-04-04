// C:\mongoDB\vips\routes\auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Use bcryptjs for better compatibility
const jwt = require('jsonwebtoken');

// FIX: Ensure pathing for middleware is correct
const auth = require('../middleware/auth'); 

// Ensure these match your filenames exactly (Case Sensitivity matters)
const Worker = require('../models/Worker'); // Usually capitalized if the file is Worker.js
const Employer = require('../models/Employer'); // Lowercase as per your previous message


const JWT_SECRET = 'mysecretkey';
const saltRounds = 10;
module.exports = function (req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

// Shared Signup Logic
router.post('/signup', async (req, res) => {
    // Added 'category' to the destructuring to capture it from the form
    const { role, username, email, password, phone, category } = req.body;
    
    try {
        // 1. Determine which model to use
        const TargetModel = (role === 'employer') ? Employer : Worker;

        // 2. Check if user already exists
        const existingUser = await TargetModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this email." });
        }

        // 3. Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // 4. Create the data object (preserving your logic)
        const userData = { 
            username, 
            email, 
            password: hashedPassword, 
            phone,
            role 
        };

        // Only add category if the user is an employer
        if (role === 'employer') {
            userData.category = category;
        }

        const newUser = new TargetModel(userData);
        
        await newUser.save();
        res.status(201).json({ message: `Successfully registered as ${role}` });

    } catch (err) {
        // This will now catch errors and send a 400 instead of crashing with a 500
        console.error("Signup Error:", err);
        res.status(400).json({ error: "Registration failed: " + err.message });
    }
});

// Shared Login Logic
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await Worker.findOne({ username }) || await Employer.findOne({ username });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
        
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        res.json({ token, username: user.username, role: user.role });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- PENDING FOLLOW REQUESTS ---
router.get('/requests/pending', auth, async (req, res) => {
    try {
        const user = await Worker.findById(req.user.id).populate('pendingRequests', 'username profilePicture profession') || 
                     await Employer.findById(req.user.id).populate('pendingRequests', 'username profilePicture profession');
        
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user.pendingRequests || []); 
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// --- ACCEPT FOLLOW REQUEST ---
router.post('/requests/accept/:requesterId', auth, async (req, res) => {
    try {
        const myId = req.user.id;
        const requesterId = req.params.requesterId;

        let me = await Worker.findById(myId) || await Employer.findById(myId);
        let requester = await Worker.findById(requesterId) || await Employer.findById(requesterId);

        if (!me || !requester) return res.status(404).json({ message: "User not found" });

        if (!me.followers.includes(requesterId)) me.followers.push(requesterId);
        me.pendingRequests = me.pendingRequests.filter(id => id.toString() !== requesterId);
        if (!requester.following.includes(myId)) requester.following.push(myId);

        await me.save();
        await requester.save();
        res.json({ message: "Request accepted" });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;