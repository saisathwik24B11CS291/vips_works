const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Worker = require('../models/Worker');
const Employer = require('../models/Employer');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const MAX_UPLOAD_SIZE = Number.parseInt(process.env.MAX_UPLOAD_SIZE || `${5 * 1024 * 1024}`, 10);
const allowedUploadTypes = new Map([
    ['image/jpeg', new Set(['.jpg', '.jpeg'])],
    ['image/png', new Set(['.png'])],
    ['image/webp', new Set(['.webp'])]
]);
function cleanText(value, max = 1000) {
    return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/[<>]/g, '').trim().slice(0, max);
}
function uploadFileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = allowedUploadTypes.get(file.mimetype);
    if (!allowedExts || !allowedExts.has(ext)) return cb(new Error('Only JPG, JPEG, PNG and WEBP images are allowed'));
    cb(null, true);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `message-${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname || '').toLowerCase()}`)
});
const upload = multer({ storage, fileFilter: uploadFileFilter, limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 } });

// --- MOVED MIDDLEWARE TO TOP TO FIX INITIALIZATION ERROR ---
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "No token provided" });

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contains id and role
        next();
    } catch (err) {
        res.status(401).json({ message: "Session expired" });
    }
};

// --- 1. GET CONVERSATIONS ---
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const myId = req.user.id;
        const messages = await Message.find({
            $or: [{ sender: myId }, { receiver: myId }]
        }).sort({ createdAt: -1 });

        const conversationsMap = new Map();

        for (const msg of messages) {
            const isISent = msg.sender.toString() === myId;
            const partnerId = isISent ? msg.receiver.toString() : msg.sender.toString();
            const partnerModel = isISent ? msg.receiverModel : msg.senderModel;

            if (!conversationsMap.has(partnerId) && partnerModel) {
                const Model = partnerModel === 'Worker' ? Worker : Employer;
                const partner = await Model.findById(partnerId)
                    .select('username profilePicture')
                    .lean();

                if (partner) {
                    conversationsMap.set(partnerId, {
                        partner: { ...partner, _id: partnerId },
                        lastMessage: msg.text || (msg.image ? " Photo" : ""),
                        time: msg.createdAt,
                        isRead: msg.isRead
                    });
                }
            }
        }
        res.json(Array.from(conversationsMap.values()));
    } catch (err) {
        console.error("Conversations Error:", err);
        res.status(500).json({ message: "Failed to load inbox" });
    }
});

// --- 2. SEARCH MESSAGES ---
router.get('/search', authMiddleware, async (req, res) => {
        const q = cleanText(req.query.q, 80); // The search term from URL
    try {
        const messages = await Message.find({
            $and: [
                { $or: [{ sender: req.user.id }, { receiver: req.user.id }] },
                { text: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || "", $options: 'i' } } // 'i' makes it case-insensitive
            ]
        }).limit(20);
        res.json(messages);
    } catch (err) {
        res.status(500).send("Search failed");
    }
});

// --- 3. FETCH MESSAGES BY ID (Placed here to avoid CastError) ---
router.get('/:partnerId', authMiddleware, async (req, res) => {
    try {
        const myId = req.user.id;
        const partnerId = req.params.partnerId;

        // Safety check to prevent crashing when partnerId is "search" or "unread"
        if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            return res.status(400).json({ message: "Invalid ID format" });
        }

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: partnerId },
                { sender: partnerId, receiver: myId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error("Fetch Messages Error:", err);
        res.status(500).json({ message: "Error fetching messages" });
    }
});

// --- 4. SEND TEXT MESSAGE ---
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { receiverId, receiverModel, text } = req.body;
        const senderId = req.user.id;
        const senderRole = req.user.role;
        const cleanMessage = cleanText(text, 2000);

        if (!mongoose.Types.ObjectId.isValid(receiverId)) return res.status(400).json({ message: "Invalid receiver" });
        if (!['Worker', 'Employer'].includes(receiverModel)) return res.status(400).json({ message: "Invalid receiver type" });
        if (!cleanMessage) return res.status(400).json({ message: "Message cannot be empty" });

        const Model = receiverModel === 'Employer' ? Employer : Worker;
        const receiver = await Model.findById(receiverId);

        if (!receiver) return res.status(404).json({ message: "Receiver not found" });

        if (receiverModel === 'Employer' && receiver.settings?.followToView) {
            const isFollowing = receiver.followers.some(id => id.toString() === senderId);
            if (!isFollowing) {
                return res.status(403).json({ message: "You must follow this employer to send a message." });
            }
        }

        const newMessage = new Message({
            sender: senderId,
            senderModel: senderRole === 'employer' ? 'Employer' : 'Worker',
            receiver: receiverId,
            receiverModel: receiverModel,
            text: cleanMessage,
            isRead: false
        });

        await newMessage.save();
        res.status(201).json(newMessage);

    } catch (err) {
        console.error("Send Message Error:", err);
        res.status(500).json({ error: "Message failed" });
    }
});

// --- 5. SEND IMAGE MESSAGE ---
router.post('/send-image', authMiddleware, upload.single('messageImage'), async (req, res) => {
    try {
        const payload = JSON.parse(req.body.data);
        if (!req.file) return res.status(400).json({ message: "No image uploaded" });
        if (!mongoose.Types.ObjectId.isValid(payload.receiverId)) return res.status(400).json({ message: "Invalid receiver" });
        if (!['Worker', 'Employer'].includes(payload.receiverModel)) return res.status(400).json({ message: "Invalid receiver type" });

        const newMessage = new Message({
            sender: req.user.id,
            senderModel: req.user.role === 'employer' ? 'Employer' : 'Worker',
            receiver: payload.receiverId,
            receiverModel: payload.receiverModel,
            image: `/uploads/${req.file.filename}`
        });

        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) {
        res.status(400).json({ error: err.message || "Image upload failed" });
    }
});

// --- 6. MARK AS READ ---
router.post('/read/:partnerId', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.partnerId)) {
            return res.status(400).json({ message: "Invalid ID" });
        }
        await Message.updateMany(
            { sender: req.params.partnerId, receiver: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ message: "Marked as read" });
    } catch (err) {
        res.status(500).json({ error: "Read update failed" });
    }
});

module.exports = router;
