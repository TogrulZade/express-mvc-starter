import User from '../models/User.js';

export class UserController {
  static async index(req, res, next) {
    try {
      const users = await User.findAll();
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  static async store(req, res, next) {
    try {
      const user = await User.create(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}
