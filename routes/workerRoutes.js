const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

// --- AUTH MIDDLEWARE IMPORT ---
// We use the shared logic to ensure the 'SyntaxError' doesn't return
const authMiddleware = require('./middleware/auth'); 

// --- MODELS ---
const Worker = require('../models/Worker');
const Employer = require('../models/Employer');
const Message = require('../models/Message');

// Ensure this matches your server.js secret
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 1. PROFILE ROUTE
// ==========================================
router.get('/profile/:id', authMiddleware, async (req, res) => {
    try {
        let user = await Worker.findById(req.params.id).select('-password').lean();
        let role = 'worker';

        if (!user) {
            user = await Employer.findById(req.params.id).select('-password').lean();
            role = 'employer';
        }

        if (!user) return res.status(404).json({ message: "User not found" });

        // Ensure all arrays and settings exist so frontend doesn't crash
        user.followers = user.followers || [];
        user.following = user.following || [];
        user.followRequests = user.followRequests || [];
        user.pendingRequests = user.pendingRequests || [];
        user.role = role;
        user.settings = user.settings || { followToView: false }; 

        res.json(user);
    } catch (err) {
        console.error("Profile Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// For your specific worker-list "View Profile" button
router.get('/worker/:id', authMiddleware, async (req, res) => {
    try {
        // Fix: Use Worker/Employer models instead of undefined 'User'
        let worker = await Worker.findById(req.params.id).select('-password');
        if (!worker) {
            worker = await Employer.findById(req.params.id).select('-password');
        }
        
        if (!worker) return res.status(404).json({ message: "Worker not found" });
        res.json(worker);
    } catch (err) {
        res.status(500).json({ error: "Failed to load worker profile" });
    }
});

// ==========================================
// 2. SOCIAL ROUTES (REQUESTS, FOLLOW, CONFIRM)
// ==========================================

// --- GET PENDING FOLLOW REQUESTS ---
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    // Check both collections for the current user
    const currentUser = await Worker.findById(req.user.id).populate('followRequests', 'username profilePicture profession') ||
                        await Employer.findById(req.user.id).populate('followRequests', 'username profilePicture profession');
    
    if (!currentUser) return res.status(404).json({ message: "User not found" });
    res.json(currentUser.followRequests || []);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- SEND REQUEST (or Unfollow) ---
router.post('/follow/:targetId', authMiddleware, async (req, res) => {
    try {
        const myId = req.user.id;
        const targetId = req.params.targetId;

        if (myId === targetId) return res.status(400).json({ message: "Cannot follow yourself" });

        // 1. Find Target (Worker or Employer)
        let targetUser = await Worker.findById(targetId);
        let targetModel = Worker;
        if (!targetUser) {
            targetUser = await Employer.findById(targetId);
            targetModel = Employer;
        }
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // 2. Find Me
        let me = await Worker.findById(myId) || await Employer.findById(myId);
        let myModel = me.role === 'employer' ? Employer : Worker;

        // 3. Check Status
        const followersList = (targetUser.followers || []).map(String);
        const requestsList = (targetUser.followRequests || []).map(String);
        
        const isFollowing = followersList.includes(myId);
        const hasRequested = requestsList.includes(myId);

        if (isFollowing) {
            await targetModel.findByIdAndUpdate(targetId, { $pull: { followers: myId } });
            await myModel.findByIdAndUpdate(myId, { $pull: { following: targetId } });
            return res.json({ status: "unfollowed", message: "Unfollowed" });
        } else if (hasRequested) {
            await targetModel.findByIdAndUpdate(targetId, { $pull: { followRequests: myId } });
            return res.json({ status: "cancelled", message: "Request Cancelled" });
        } else {
            await targetModel.findByIdAndUpdate(targetId, { 
                $addToSet: { followRequests: myId },
                $push: { notifications: { type: 'request', user: myId, date: new Date(), read: false } } 
            });
            return res.json({ status: "requested", message: "Request Sent" });
        }
    } catch (err) {
        console.error("Follow Error:", err);
        res.status(500).json({ message: "Server error" }); 
    }
});

// --- CONFIRM REQUEST (Accept) ---
router.post('/confirm/:requesterId', authMiddleware, async (req, res) => {
    try {
        const myId = req.user.id;
        const requesterId = req.params.requesterId;

        const myModel = req.user.role === 'employer' ? Employer : Worker;

        // 1. Move them from 'requests' to 'followers' in MY profile
        await myModel.findByIdAndUpdate(myId, {
            $pull: { followRequests: requesterId },
            $addToSet: { followers: requesterId },
            $push: { notifications: { type: 'started_following', user: requesterId, date: new Date() } }
        });

        // 2. Add ME to THEIR 'following' list
        let requester = await Worker.findById(requesterId) || await Employer.findById(requesterId);
        let requesterModel = requester.role === 'employer' ? Employer : Worker;

        await requesterModel.findByIdAndUpdate(requesterId, {
            $addToSet: { following: myId }
        });

        res.json({ message: "Confirmed" });
    } catch (err) {
        res.status(500).json({ message: "Error confirming" });
    }
});

// --- REJECT REQUEST (Delete) ---
router.delete('/requests/:requesterId', authMiddleware, async (req, res) => {
    try {
        const myModel = req.user.role === 'employer' ? Employer : Worker;
        await myModel.findByIdAndUpdate(req.user.id, {
            $pull: { followRequests: req.params.requesterId }
        });
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting" });
    }
});

// ==========================================
// 3. MESSAGE ROUTES
// ==========================================

router.post('/messages/send', authMiddleware, async (req, res) => {
    try {
        const { receiverId, text } = req.body;
        const newMessage = new Message({ sender: req.user.id, receiver: receiverId, text });
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) { res.status(500).json({ message: "Error sending message" }); }
});

router.post('/messages/send-image', authMiddleware, upload.single('chatImage'), async (req, res) => {
    try {
        const { receiverId } = req.body;
        if (!req.file) return res.status(400).json({ message: "No image uploaded" });
        const newMessage = new Message({
            sender: req.user.id,
            receiver: receiverId,
            image: `/uploads/${req.file.filename}`
        });
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) { res.status(500).json({ message: "Error sending image" }); }
});

router.get('/messages/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const history = await Message.find({
            $or: [
                { sender: req.user.id, receiver: req.params.otherUserId },
                { sender: req.params.otherUserId, receiver: req.user.id }
            ]
        }).sort({ createdAt: 1 });
        res.json(history);
    } catch (err) { res.status(500).json({ message: "History error" }); }
});
// ==========================================
// NEW: GET CONVERSATIONS LIST
// ==========================================
router.get('/messages/conversations', authMiddleware, async (req, res) => {
    try {
        const myId = req.user.id;
        const messages = await Message.find({
            $or: [{ sender: myId }, { receiver: myId }]
        }).sort({ createdAt: -1 });

        const conversationsMap = new Map();

        for (const msg of messages) {
            const isISent = msg.sender.toString() === myId;
            const otherUserId = isISent ? msg.receiver.toString() : msg.sender.toString();
            // Safeguard: ensure the model string exists
            const otherModel = isISent ? msg.receiverModel : msg.senderModel;

            if (!conversationsMap.has(otherUserId) && otherModel) {
                try {
                    // Use specific models to avoid "Model not found" errors
                    const Model = otherModel === 'Worker' ? Worker : Employer;
                    const partner = await Model.findById(otherUserId)
                        .select('username profilePicture')
                        .lean();

                    if (partner) {
                        conversationsMap.set(otherUserId, {
                            partner: { ...partner, _id: otherUserId },
                            lastMessage: msg.text || (msg.image ? " Photo" : ""),
                            time: msg.createdAt,
                            isRead: msg.isRead
                        });
                    }
                } catch (userErr) {
                    console.error("Error fetching partner details:", userErr);
                }
            }
        }
        res.json(Array.from(conversationsMap.values()));
    } catch (err) {
        console.error("Conversations Route Crash:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
// Send Text Message
router.post('/messages/send', authMiddleware, async (req, res) => {
    try {
        const { receiverId, text, receiverModel } = req.body;
        
        const newMessage = new Message({
            sender: req.user.id,
            senderModel: req.user.role === 'employer' ? 'Employer' : 'Worker', // Set dynamically
            receiver: receiverId,
            receiverModel: receiverModel, // From frontend
            text: text
        });

        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) {
        res.status(500).json({ message: "Error sending message" });
    }
});

// Send Image Message
// Note: Changed upload.single to match 'messageImage' from your frontend
router.post('/messages/send-image', authMiddleware, upload.single('messageImage'), async (req, res) => {
    try {
        // Your frontend sends receiverId inside a JSON string in 'data' field 
        // OR as a direct field. Let's handle both.
        const receiverId = req.body.receiverId; 
        
        if (!req.file) return res.status(400).json({ message: "No image uploaded" });
        
        const newMessage = new Message({
            sender: req.user.id,
            receiver: receiverId,
            image: `/uploads/${req.file.filename}`
        });
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) { res.status(500).json({ message: "Error sending image" }); }
});
const JobInvite = require("../models/JobInvite");

router.get("/filter", authMiddleware, async (req, res) => {

try{

const job = req.query.job;
const employerId = req.user.id;

let workers = await Worker.find({
"categories.tags": job
}).lean();

const invites = await JobInvite.find({
employerId,
jobTitle: job,
status: "pending"
});

const invitedIds = invites.map(i => i.workerId.toString());

workers = workers.map(w => ({
...w,
inviteSent: invitedIds.includes(w._id.toString())
}));

res.json(workers);

}catch(err){

console.error(err);
res.status(500).json({error:"Server error"});

}

});


module.exports = router;
