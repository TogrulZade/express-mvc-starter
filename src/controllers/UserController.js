import prisma from '../config/db.js';
import cache from '../services/cache.js';

const USERS_CACHE_KEY = 'users:all';

export class UserController {
  // GET /api/users
  static async index(req, res, next) {
    try {
      // Like Laravel's Cache::remember(): query once, then serve from cache for 60 seconds.
      const users = await cache.remember(USERS_CACHE_KEY, 60, () => prisma.user.findMany());
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/users
  static async store(req, res, next) {
    try {
      const { name, email } = req.body;
      const user = await prisma.user.create({
        data: { name, email },
      });
      // The list changed, so the next index request reads fresh data.
      // The user is already saved: a cache error must not turn this into a 500.
      await cache.forget(USERS_CACHE_KEY).catch((error) => console.warn('Cache forget failed:', error.message));
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}
