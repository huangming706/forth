import express from 'express';
import {sprintf} from 'sprintf-js';
import ss from 'simple-statistics';
import dbConn from '../../core/dbConn';
import {dbTblName, chart} from '../../core/config';
import strings from '../../core/strings';

const router = express.Router();

const offsetPercent = 0.25;

const instrumentsProc = (req, res, next) => {

  let sql = sprintf("SELECT * FROM `%s` ORDER BY `creation_timestamp`;", dbTblName.deribitInstruments2);
  dbConn.query(sql, undefined, (error, results, fields) => {
    if (error) {
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
      return;
    }
    if (!results || results.length === 0) {
      res.status(200).send({
        result: strings.success,
        data:[],
        strikeKDECall: [],
        strikeKDEPut: [],
        bidKDECall: [],
        bidKDEPut: [],
        deltaKDECall: [],
        deltaKDEPut: [],
        gammaKDECall: [],
        gammaKDEPut: [],
        vegaKDECall: [],
        vegaKDEPut: [],
        spreadKDECall: [],
        spreadKDEPut: [],
      });
      return;
    }

    let finalResult = {
      result: strings.success,
      data: results,
    };

    let strikeKDECallBuffer = [];
    let strikeKDEPutBuffer = [];
    let bidKDECallBuffer = [];
    let bidKDEPutBuffer = [];
    let deltaKDECallBuffer = [];
    let deltaKDEPutBuffer = [];
    let gammaKDECallBuffer = [];
    let gammaKDEPutBuffer = [];
    let vegaKDECallBuffer = [];
    let vegaKDEPutBuffer = [];
    let spreadKDECallBuffer = [];
    let spreadKDEPutBuffer = [];

    let x, step;
    let tmp1;
    let tmp2;
    let strikeRange = {min: results[0].strike, max: results[0].strike};
    let bidRange = {min: results[0].best_bid_price, max: results[0].best_bid_price};
    let deltaRange = {min: results[0].delta, max: results[0].delta};
    let gammaRange = {min: results[0].gamma, max: results[0].gamma};
    let vegaRange = {min: results[0].vega, max: results[0].vega};
    let spreadRange = {min: results[0].best_ask_price - results[0].best_bid_price, max: results[0].best_ask_price - results[0].best_bid_price};
    let spread;
    for (let result of results) {
      if (result.type == 'Call') strikeKDECallBuffer.push(result.strike);
      if (result.type == 'Put') strikeKDEPutBuffer.push(result.strike);
      if (strikeRange.min > result.strike) strikeRange.min = result.strike;
      if (strikeRange.max < result.strike) strikeRange.max = result.strike;

      if (result.type == 'Call') bidKDECallBuffer.push(result.best_bid_price);
      if (result.type == 'Put') bidKDEPutBuffer.push(result.best_bid_price);
      if (bidRange.min > result.best_bid_price) bidRange.min = result.best_bid_price;
      if (bidRange.max < result.best_bid_price) bidRange.max = result.best_bid_price;

      if (result.type == 'Call') deltaKDECallBuffer.push(result.delta);
      if (result.type == 'Put') deltaKDEPutBuffer.push(result.delta);
      if (deltaRange.min > result.delta) deltaRange.min = result.delta;
      if (deltaRange.max < result.delta) deltaRange.max = result.delta;

      if (result.type == 'Call') gammaKDECallBuffer.push(result.gamma);
      if (result.type == 'Put') gammaKDEPutBuffer.push(result.gamma);
      if (gammaRange.min > result.gamma) gammaRange.min = result.gamma;
      if (gammaRange.max < result.gamma) gammaRange.max = result.gamma;

      if (result.type == 'Call') vegaKDECallBuffer.push(result.vega);
      if (result.type == 'Put') vegaKDEPutBuffer.push(result.vega);
      if (vegaRange.min > result.vega) vegaRange.min = result.vega;
      if (vegaRange.max < result.vega) vegaRange.max = result.vega;

      spread = result.best_ask_price - result.best_bid_price;
      if (result.type == 'Call') spreadKDECallBuffer.push(spread);
      if (result.type == 'Put') spreadKDEPutBuffer.push(spread);
      if (spreadRange.min > spread) spreadRange.min = spread;
      if (spreadRange.max < spread) spreadRange.max = spread;
    }
    tmp1 = strikeRange.min;
    tmp2 = strikeRange.max;
    strikeRange.min -= (tmp2 - tmp1) * offsetPercent;
    strikeRange.max += (tmp2 - tmp1) * offsetPercent;
    tmp1 = bidRange.min;
    tmp2 = bidRange.max;
    bidRange.min -= (tmp2 - tmp1) * offsetPercent;
    bidRange.max += (tmp2 - tmp1) * offsetPercent;
    tmp1 = deltaRange.min;
    tmp2 = deltaRange.max;
    deltaRange.min -= (tmp2 - tmp1) * offsetPercent;
    deltaRange.max += (tmp2 - tmp1) * offsetPercent;
    tmp1 = gammaRange.min;
    tmp2 = gammaRange.max;
    gammaRange.min -= (tmp2 - tmp1) * offsetPercent;
    gammaRange.max += (tmp2 - tmp1) * offsetPercent;
    tmp1 = vegaRange.min;
    tmp2 = vegaRange.max;
    vegaRange.min -= (tmp2 - tmp1) * offsetPercent;
    vegaRange.max += (tmp2 - tmp1) * offsetPercent;
    tmp1 = spreadRange.min;
    tmp2 = spreadRange.max;
    spreadRange.min -= (tmp2 - tmp1) * offsetPercent;
    spreadRange.max += (tmp2 - tmp1) * offsetPercent;

    const fStrikeKDECall = ss.kernelDensityEstimation(strikeKDECallBuffer);
    const fStrikeKDEPut = ss.kernelDensityEstimation(strikeKDEPutBuffer);
    let strikeKDECall = [];
    let strikeKDEPut = [];
    step = (strikeRange.max - strikeRange.min) / chart.rowCount1;
    for (x = strikeRange.min; x <= strikeRange.max; x += step) {
      strikeKDECall.push({value: x, density: fStrikeKDECall(x) * strikeKDECallBuffer.length});
      strikeKDEPut.push({value: x, density: fStrikeKDEPut(x) * strikeKDEPutBuffer.length});
    }
    finalResult['strikeKDECall'] = strikeKDECall;
    finalResult['strikeKDEPut'] = strikeKDEPut;

    const fBidKDECall = ss.kernelDensityEstimation(bidKDECallBuffer);
    const fBidKDEPut = ss.kernelDensityEstimation(bidKDEPutBuffer);
    let bidKDECall = [];
    let bidKDEPut = [];
    step = (bidRange.max - bidRange.min) / chart.rowCount1;
    for (x = bidRange.min; x <= bidRange.max; x += step) {
      bidKDECall.push({value: x, density: fBidKDECall(x) * bidKDECallBuffer.length});
      bidKDEPut.push({value: x, density: fBidKDEPut(x) * bidKDEPutBuffer.length});
    }
    finalResult['bidKDECall'] = bidKDECall;
    finalResult['bidKDEPut'] = bidKDEPut;

    const fDeltaKDECall = ss.kernelDensityEstimation(deltaKDECallBuffer);
    const fDeltaKDEPut = ss.kernelDensityEstimation(deltaKDEPutBuffer);
    let deltaKDECall = [];
    let deltaKDEPut = [];
    step = (deltaRange.max - deltaRange.min) / chart.rowCount1;
    for (x = deltaRange.min; x <= deltaRange.max; x += step) {
      deltaKDECall.push({value: x, density: fDeltaKDECall(x) * deltaKDECallBuffer.length});
      deltaKDEPut.push({value: x, density: fDeltaKDEPut(x) * deltaKDEPutBuffer.length});
    }
    finalResult['deltaKDECall'] = deltaKDECall;
    finalResult['deltaKDEPut'] = deltaKDEPut;

    const fGammaKDECall = ss.kernelDensityEstimation(gammaKDECallBuffer);
    const fGammaKDEPut = ss.kernelDensityEstimation(gammaKDEPutBuffer);
    let gammaKDECall = [];
    let gammaKDEPut = [];
    step = (gammaRange.max - gammaRange.min) / chart.rowCount1;
    for (x = gammaRange.min; x <= gammaRange.max; x += step) {
      gammaKDECall.push({value: x, density: fGammaKDECall(x) * gammaKDECallBuffer.length});
      gammaKDEPut.push({value: x, density: fGammaKDEPut(x) * gammaKDEPutBuffer.length});
    }
    finalResult['gammaKDECall'] = gammaKDECall;
    finalResult['gammaKDEPut'] = gammaKDEPut;

    const fVegaKDECall = ss.kernelDensityEstimation(vegaKDECallBuffer);
    const fVegaKDEPut = ss.kernelDensityEstimation(vegaKDEPutBuffer);
    let vegaKDECall = [];
    let vegaKDEPut = [];
    step = (vegaRange.max - vegaRange.min) / chart.rowCount1;
    for (x = vegaRange.min; x <= vegaRange.max; x += step) {
      vegaKDECall.push({value: x, density: fVegaKDECall(x) * vegaKDECallBuffer.length});
      vegaKDEPut.push({value: x, density: fVegaKDEPut(x) * vegaKDEPutBuffer.length});
    }
    finalResult['vegaKDECall'] = vegaKDECall;
    finalResult['vegaKDEPut'] = vegaKDEPut;

    const fSpreadKDECall = ss.kernelDensityEstimation(spreadKDECallBuffer);
    const fSpreadKDEPut = ss.kernelDensityEstimation(spreadKDEPutBuffer);
    let spreadKDECall = [];
    let spreadKDEPut = [];
    step = (spreadRange.max - spreadRange.min) / chart.rowCount1;
    for (x = spreadRange.min; x <= spreadRange.max; x += step) {
      spreadKDECall.push({value: x, density: fSpreadKDECall(x) * spreadKDECallBuffer.length});
      spreadKDEPut.push({value: x, density: fSpreadKDEPut(x) * spreadKDEPutBuffer.length});
    }
    finalResult['spreadKDECall'] = spreadKDECall;
    finalResult['spreadKDEPut'] = spreadKDEPut;
    // console.log(strikeKDEPut);

    res.status(200).send(finalResult);
  });
};

const dataProc = (req, res, next) => {
  let sql = sprintf("SELECT I.*, I.option_symbol `aka` FROM `%s` I ORDER BY I.creation_timestamp;", dbTblName.deribitInstruments2);
  dbConn.query(sql, undefined, (error, results, fields) => {
    if (error) {
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
      return;
    }
    for (let result of results) {
      result['expiration_timestamp'] = result['expiration_timestamp'].substr(0, 10);
      result['creation_timestamp'] = result['creation_timestamp'].substr(0, 10);
    }
    res.status(200).send({
      result: strings.success,
      data: results
    });
  });
};

router.get('/instruments', instrumentsProc);

router.get('/data', dataProc);

module.exports = router;
