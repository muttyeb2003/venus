import logger from '#config/logger.js';
import { jwttoken } from '#utils/jwt.js';

export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.get('authorization') || req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token && req.cookies) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = jwttoken.verify(token);
    req.user = payload;

    return next();
  } catch (e) {
    logger.warn('Invalid token', e);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

export const requireRole = roles => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
};
