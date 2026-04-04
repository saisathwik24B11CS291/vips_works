const jwt = require('jsonwebtoken');
const Worker = require('../../models/Worker');
const Employer = require('../../models/Employer');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

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

module.exports = authMiddleware;
