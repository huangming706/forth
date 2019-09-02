import express from 'express';
import indexRouter from './api/index';
import authRouter from './api/auth';
import dashboardRouter from './api/dashboard';
import generalRouter from './api/general';
import volatilityRouter from './api/volatility';
import marketSentimentRouter from './api/marketSentiment';
import exchangeInfoRouter from './api/exchangeInfo';
import deribitRouter from './api/deribit';
import footprintRouter from './api/footprint';
import settingsRouter from './api/settings';

import adminRouter from './api/admin';

const router = express.Router();

router.use('/', indexRouter);
router.use('/auth', authRouter);
router.use('/dashboard', dashboardRouter);
router.use('/general', generalRouter);
router.use('/volatility', volatilityRouter);
router.use('/market-sentiment', marketSentimentRouter);
router.use('/exchange-info', exchangeInfoRouter);
router.use('/deribit', deribitRouter);
router.use('/footprint', footprintRouter);
router.use('/settings', settingsRouter);

router.use('/admin', adminRouter);

module.exports = router;
