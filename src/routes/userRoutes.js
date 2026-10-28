import { Router } from 'express';
import { UserController } from '../controllers/UserController.js';
import { validate } from '../middlewares/validate.js';
import { z } from 'zod';

const router = Router();

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254),
});

router.get('/', UserController.index);
router.post('/', validate(createUserSchema), UserController.store);

export default router;
