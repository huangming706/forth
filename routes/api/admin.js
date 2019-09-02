import express from 'express';
import usersRouter from './admin/users';

const router = express.Router();

router.use('/users', usersRouter);

module.exports = router;
