const express = require('express');
const router = express.Router();

const Employer = require('../models/Employer');
const multer = require('multer'); 
const auth = require('./middleware/auth');

// Configure Multer
const upload = multer({ dest: 'uploads/projects/' });

// --- 1. Update Employer Profile ---

router.put('/profile/update', auth, async (req, res) => {
    const { companyName, bio, location, phone, email, category } = req.body;
    try {
        // Use findByIdAndUpdate since 'auth' middleware provides the user ID in req.user.id
        const updatedEmployer = await Employer.findByIdAndUpdate(
            req.user.id, 
            { companyName, bio, location, phone, email, category },
            { new: true, runValidators: true } 
        );
        
        if (!updatedEmployer) return res.status(404).json({ message: "Employer not found" });
        res.json(updatedEmployer);
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ message: "Update failed" });
    }
});

// --- 2. Add Project to Portfolio ---
router.post('/profile/project', auth, upload.fields([{ name: 'image' }, { name: 'video' }]), async (req, res) => {
    try {
        if (req.user.role !== 'employer') {
            return res.status(403).json({ message: "Access Denied: Employer account required" });
        }

        const newProject = {
            title: req.body.title,
            location: req.body.location,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            ownerDetails: req.body.ownerDetails,
            portfolioDesc: req.body.portfolioDesc,
            imageUrl: req.files['image'] ? `/uploads/projects/${req.files['image'][0].filename}` : null,
            videoUrl: req.files['video'] ? `/uploads/projects/${req.files['video'][0].filename}` : null
        };

        const employer = await Employer.findById(req.user.id); 
        if (!employer) return res.status(404).json({ message: "Employer profile not found" });

        employer.projects.push(newProject);
        await employer.save();

        res.status(200).json({ message: "Project added!", project: newProject });
    } catch (err) {
        console.error("Project Upload Error:", err);
        res.status(500).json({ error: "Server error during upload" });
    }
});

// Get current logged-in employer
router.get('/profile/me', auth, async (req, res) => {
    try {
        const employer = await Employer.findById(req.user.id);
        if (!employer) return res.status(404).json({ message: "Profile not found" });
        res.json(employer);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// --- 3. Smart Follow Logic ---
router.post('/follow/:targetId', auth, async (req, res) => {
    try {
        const workerId = req.user.id;
        const targetId = req.params.targetId;

        const targetEmployer = await Employer.findById(targetId);
        if (!targetEmployer) return res.status(404).json({ message: "Employer not found" });

        if (req.user.role === 'employer') {
            return res.status(403).json({ message: "Employers cannot follow other Employers." });
        }

        if (targetEmployer.autoAcceptFollows) {
            if (!targetEmployer.followers.includes(workerId)) {
                targetEmployer.followers.push(workerId);
                await targetEmployer.save();
                return res.json({ status: "success", message: "You are now following." });
            }
            return res.status(400).json({ message: "Already following." });
        } else {
            if (!targetEmployer.pendingRequests.includes(workerId)) {
                targetEmployer.pendingRequests.push(workerId);
                await targetEmployer.save();
                return res.json({ status: "pending", message: "Request sent." });
            }
            return res.status(400).json({ message: "Request already pending." });
        }
    } catch (err) {
        res.status(500).json({ message: "Follow operation failed" });
    }
});

// --- Get Pending Requests ---
router.get('/requests', auth, async (req, res) => {
    try {
        const employer = await Employer.findById(req.user.id)
            .populate('pendingRequests', 'username profilePicture profession');
        if (!employer) return res.status(404).json({ message: "Not found" });
        res.json(employer.pendingRequests);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Accept/Reject
router.post('/requests/accept/:workerId', auth, async (req, res) => {
    try {
        const employer = await Employer.findById(req.user.id);
        const workerId = req.params.workerId;
        employer.pendingRequests = employer.pendingRequests.filter(id => id.toString() !== workerId);
        if (!employer.followers.includes(workerId)) employer.followers.push(workerId);
        await employer.save();
        res.json({ message: "Worker accepted!" });
    } catch(err) { res.status(500).send(err); }
});

router.post('/requests/reject/:workerId', auth, async (req, res) => {
    try {
        const employer = await Employer.findById(req.user.id);
        employer.pendingRequests = employer.pendingRequests.filter(id => id.toString() !== req.params.workerId);
        await employer.save();
        res.json({ message: "Request deleted" });
    } catch(err) { res.status(500).send(err); }
});
router.post('/update-privacy', auth, async (req, res) => {
    try {
        const { followToView, autoAccept } = req.body;
        const userId = req.user.id; // 'auth' middleware populates req.user

        const updatedUser = await Employer.findByIdAndUpdate(
            userId,
            { 
                $set: { 
                    "settings.followToView": followToView,
                    "settings.autoAccept": autoAccept 
                } 
            },
            { new: true }
        );

        if (!updatedUser) return res.status(404).json({ error: "Employer not found" });
        res.json({ success: true, settings: updatedUser.settings });
    } catch (err) {
        console.error("Privacy Update Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
