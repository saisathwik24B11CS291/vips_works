const express = require('express');
const router = express.Router();
const User = require('../models/user'); // Primary Unified Model
const Worker = require('../models/Worker'); 
const Employer = require('../models/Employer');
const auth = require('../middleware/auth');

// --- 1. SEARCH LOGIC ---
router.get('/search', auth, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        const regex = new RegExp(query, 'i');
        const searcherRole = req.user.role; // Verify this is 'employer' or 'worker'

        console.log(`Search triggered by: ${req.user.id} with role: ${searcherRole}`);

        let results = [];

        // ALWAYS search for Workers (Both Workers and Employers need to find them)
        const workers = await Worker.find({
            $or: [{ username: regex }, { profession: regex }]
        }).lean();
        
        results = workers.map(w => ({ ...w, role: 'worker' }));

        // CRITICAL CHECK: Only add Employers to results if the searcher is a WORKER
        if (searcherRole === 'worker') {
            console.log("Searcher is a worker - adding employers to results");
            const employers = await Employer.find({ 
                $or: [{ username: regex }, { companyName: regex }] 
            }).lean();

            const employerResults = employers.map(e => ({ ...e, role: 'employer' }));
            results = [...results, ...employerResults];
        } else {
            console.log("Searcher is NOT a worker - blocking employer results");
        }

        res.json(results);
    } catch (err) {
        console.error("Search Logic Error:", err);
        res.status(500).json({ message: "Search error" });
    }
});

// --- 2. PROFILE LOGIC ---
// Backend: Ensure these fields are selected
// --- 2. PROFILE LOGIC ---
router.get('/profile/:id', auth, async (req, res) => {
    try {

        // First check Worker collection
        let worker = await Worker.findById(req.params.id).lean();

        // If not found, check User collection
        if (!worker) {
            worker = await User.findById(req.params.id).lean();
        }

        if (!worker) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(worker);

    } catch (err) {
        console.error("Profile fetch error:", err);
        res.status(500).json({ message: "Server error" });
    }
});
// --- 3. FOLLOW / REQUEST LOGIC ---
// --- 3. FOLLOW / REQUEST LOGIC ---
// Backend: routes/users.js
router.post('/follow/:id', auth, async (req, res) => {
    try {
        const targetId = req.params.id;
        const myId = req.user.id;

        // ... existing validation ...

        const targetUser = await User.findById(targetId);
        const useAutoAccept = targetUser.settings?.autoAccept === true;

        if (useAutoAccept) {
            // Update the User document
            await User.findByIdAndUpdate(targetId, { $addToSet: { followers: myId } });
            await User.findByIdAndUpdate(myId, { $addToSet: { following: targetId } });
            
            // CRITICAL: Also update the Worker document so the profile remains in sync
            await Worker.findByIdAndUpdate(targetId, { $addToSet: { followers: myId } });
            
            return res.json({ status: 'followed' });
        } else {
            await User.findByIdAndUpdate(targetId, { $addToSet: { followRequests: myId } });
            // CRITICAL: Sync with Worker model
            await Worker.findByIdAndUpdate(targetId, { $addToSet: { followRequests: myId } });
            
            return res.json({ status: 'requested' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- 4. UNFOLLOW / CANCEL REQUEST ---
router.post('/unfollow/:id', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, {
            $pull: { followers: req.user.id, followRequests: req.user.id }
        });
        await User.findByIdAndUpdate(req.user.id, { $pull: { following: req.params.id } });
        res.json({ message: "Unfollowed/Request Cancelled successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- 5. EMPLOYER ACTIONS: ACCEPT / REJECT ---
router.post('/accept-request/:workerId', auth, async (req, res) => {
    try {
        const employerId = req.user.id;
        const workerId = req.params.workerId;

        await User.findByIdAndUpdate(employerId, {
            $pull: { followRequests: workerId },
            $addToSet: { followers: workerId }
        });
        await User.findByIdAndUpdate(workerId, { $addToSet: { following: employerId } });

        res.json({ message: "Request accepted!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/reject-request/:workerId', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { $pull: { followRequests: req.params.workerId } });
        res.json({ message: "Request rejected." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- 6. SETTINGS & PRIVACY LOGIC ---
router.put('/update-settings', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { settings } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { $set: { settings: settings } }, 
            { new: true }
        );

        // If autoAccept was just turned ON, process all current pending requests
        if (settings?.autoAccept === true && updatedUser.followRequests.length > 0) {
            for (let workerId of updatedUser.followRequests) {
                await User.findByIdAndUpdate(userId, {
                    $pull: { followRequests: workerId },
                    $addToSet: { followers: workerId }
                });
                await User.findByIdAndUpdate(workerId, { $addToSet: { following: userId } });
            }
        }
        res.json({ message: "Settings updated", user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
module.exports = router;