import prisma from '../config/db.js';

export class UserController {
  // GET /api/users
  static async index(req, res, next) {
    try {
      const users = await prisma.user.findMany();
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
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}
