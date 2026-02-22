const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { JWT_SECRET: SECRET_KEY } = require('../config/auth');

module.exports = async (req, res, next) => {
    // Get token from header
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        // Find user to ensure they still exist/have roles
        const user = await prisma.user.findUnique({ where: { id: String(decoded.id) } });

        if (!user) {
            return res.status(401).json({ error: 'User invalid' });
        }

        req.user = user;
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};
