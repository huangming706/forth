import express from 'express';
import {sprintf} from 'sprintf-js';
import dbConn from '../../core/dbConn';
import {dbTblName, chart, server} from '../../core/config';
import strings from '../../core/strings';

const router = express.Router();

const oneProc = (req, res, next) => {
  const params = req.query;
  const binSize = req.params.binSize;
  const symbol = params.symbol;

  const acceptSymbols = server.acceptSymbols;
  const acceptBinSize = ['1m', '5m', '1h'];

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
  }

  let sql = sprintf("SELECT * FROM `%s_%s_%s` ORDER BY `timestamp` DESC LIMIT 1", dbTblName.id0, symbol, binSize);
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

const collectionProc = (req, res, next) => {
  const params = req.query;
  const binSize = req.params.binSize;
  const symbol = params.symbol;
  let startTime = params.startTime;
  let endTime = params.endTime;
  const timezone = params.timezone;

  const acceptSymbols = server.acceptSymbols;
  const acceptBinSize = ['1m', '5m', '1h'];

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
  } else if (typeof timezone === 'undefined' || timezone == null) {
    res.status(200).send({
      result: strings.error,
      message: strings.timezoneIsInvalid,
    });
    return;
  }

  const timeOffset = sprintf("%d:00:00", timezone);

  if (typeof endTime === 'undefined' || endTime == null || endTime === 'null') {
    endTime = new Date().toISOString();
  }
  if (typeof startTime === 'undefined' || startTime == null || startTime === 'null') {
    startTime = new Date(new Date(endTime).getTime() - 30 * 24 * 3600 * 1000).toISOString();
  }
  startTime = new Date(startTime).toISOString();
  endTime = new Date(endTime).toISOString();

  let sql = sprintf("SELECT COUNT(`timestamp`) `count` FROM `%s_%s_%s` WHERE `timestamp` BETWEEN '%s' AND '%s';", dbTblName.id0, symbol, binSize, startTime, endTime);
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
    const cnt = rows[0].count;
    const step = cnt / chart.rowCount1;
    const timestampFormat = '%Y-%m-%dT%H:%i:%s.000Z';

    sql = sprintf("SELECT `timestamp`, AVG(`open`) `open`, AVG(`high`) `high`, AVG(`low`) `low`, AVG(`close`) `close`, AVG(`num_3`) `num_3`, AVG(`num_3i`) `num_3i`, AVG(`num_6`) `num_6`, AVG(`num_6i`) `num_6i`, AVG(`num_9`) `num_9`, AVG(`num_9i`) `num_9i`, AVG(`num_100`) `num_100`, AVG(`num_100i`) `num_100i` FROM (SELECT FLOOR((@row_number:=@row_number + 1)/%f) AS num, `timestamp`, `open`, `high`, `low`, `close`, `num_3`, `num_3i`, `num_6`, `num_6i`, `num_9`, `num_9i`, `num_100`, `num_100i` FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(`timestamp`, '%s'), '%s'), '%s') `timestamp`, `open`, `high`, `low`, `close`, `num_3`, `num_3i`, `num_6`, `num_6i`, `num_9`, `num_9i`, `num_100`, `num_100i` FROM `%s_%s_%s` WHERE `timestamp` BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `bd`, (SELECT @row_number:=0) `row_num`  ORDER BY `timestamp` ASC) `tmp` GROUP BY `num`;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.id0, symbol, binSize, startTime, endTime);
    console.log('/market-sentiment/collection', sql);
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
  });

};

router.get('/one/:binSize', oneProc);
router.get('/collection/:binSize', collectionProc);

module.exports = router;
