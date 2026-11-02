import User from '../models/User.js';
import cache from '@st/cache';

const USERS_CACHE_KEY = 'users:all';

export class UserController {
  static async index(req, res) {
    // Like Laravel's Cache::remember(): query once, then serve from cache for 60 seconds.
    const users = await cache.remember(USERS_CACHE_KEY, 60, () => User.find());
    res.json({ success: true, data: users });
  }

  static async store(req, res) {
    const user = await User.create(req.body);
    // The list changed, so the next index request reads fresh data.
    // The user is already saved: a cache error must not turn this into a 500.
    await cache.forget(USERS_CACHE_KEY).catch((error) => console.warn('Cache forget failed:', error.message));
    res.status(201).json({ success: true, data: user });
  }
}
