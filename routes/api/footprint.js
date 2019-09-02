import express from 'express';
import {sprintf} from 'sprintf-js';
import dbConn from '../../core/dbConn';
import {server, dbTblName, chart} from '../../core/config';
import strings from '../../core/strings';

const router = express.Router();

const indexProc = (req, res, next) => {
  const params = req.query;
  const binSize = params.binSize;
  const symbol = params.symbol;
  let startTime = params.startTime;
  let endTime = params.endTime;
  let startPrice = parseFloat(params.startPrice);
  let endPrice = parseFloat(params.endPrice);
  let step = parseFloat(params.step);

  let acceptSymbols = server.acceptSymbols;
  acceptSymbols.push('BTCUSD');
  // const acceptBinSize = ['1m', '5m', '1h'];
  const acceptBinSize = ['5m'];

  if (acceptSymbols.indexOf(symbol) === -1) {
    res.status(200).send({
      result: strings.error,
      message: strings.symbolIsInvalid,
    });
    return;
  } else if (acceptBinSize.indexOf(binSize) === -1) {
    res.status(200).send({
      result: strings.error,
      message: strings.binSizeIsInvalid,
    });
    return;
  } else if (typeof startPrice === 'NaN' || startPrice < 0) {
    res.status(200).send({
      result: strings.error,
      message: strings.startPriceIsInvalid,
    });
    return;
  } else if (typeof endPrice === 'NaN' || endPrice <= startPrice) {
    res.status(200).send({
      result: strings.error,
      message: strings.endPriceIsInvalid,
    });
    return;
  } else if (typeof step === 'NaN' || step < 1) {
    res.status(200).send({
      result: strings.error,
      message: strings.stepIsInvalid,
    });
    return;
  }


  const timezone = 0;
  const timeOffset = sprintf("%d:00:00", timezone);

  if (typeof endTime === 'undefined' || endTime == null || endTime === 'null') {
    endTime = new Date().toISOString();
  }
  if (typeof startTime === 'undefined' || startTime == null || startTime === 'null') {
    startTime = new Date(new Date(endTime).getTime() - 24 * 3600 * 1000).toISOString();
  }
  startTime = new Date(startTime).toISOString();
  endTime = new Date(endTime).toISOString();

  let sql = sprintf("SELECT `timestamp`, (%f + FLOOR((`price` - %f) / %f) * %f) `price`, IF(`side` > 0, 'Buy', 'Sell') `side`, SUM(`count`) `count` FROM `%s_%s` WHERE `timestamp` BETWEEN '%s' AND '%s' AND `price` BETWEEN '%f' AND '%f' GROUP BY `timestamp`, (FLOOR((`price` - %f) / %f)), `side`;", startPrice, startPrice, step, step, dbTblName.footprint5m, symbol, startTime, endTime, startPrice, endPrice, startPrice, step);
  console.log(__filename, sql);
  dbConn.query(sql, null, (error, rows, fields) => {
    if (error) {
      console.error(error);
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
        data: [],
      });
      return;
    }

    res.status(200).send({
      result: strings.success,
      data: rows,
    });
  });
};

router.get('/', indexProc);

module.exports = router;
