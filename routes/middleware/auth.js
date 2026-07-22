const jwt = require('jsonwebtoken');
const Worker = require('../../models/Worker');
const Employer = require('../../models/Employer');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || '';
        const [scheme, token] = authHeader.split(' ');
        if (scheme !== 'Bearer' || !token) return res.status(401).json({ message: "No token provided" });

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = decoded.role === 'employer'
            ? await Employer.findById(decoded.id).select('-password -resetCode -resetCodeExpires')
            : decoded.role === 'worker'
                ? await Worker.findById(decoded.id).select('-password -resetCode -resetCodeExpires')
                : null;
        
        if (!user) return res.status(401).json({ message: "User not found" });

        req.user = user;
        req.user.id = user._id.toString();
        req.user.role = user.role;
        next();
    } catch (err) {
        res.status(401).json({ message: "Session expired" });
    }
};

module.exports = authMiddleware;
