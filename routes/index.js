import {Router} from 'express';
import AppController from '../controllers/AppController.js';
import UserController from './controllers/UserController.js';

const router = Router();

router.get('/status', AppController.getStatus);
router.get('./stats', AppController.getStats);
router.post('/users', UserController.postNew);

export default router;
