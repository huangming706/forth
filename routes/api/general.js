import express from 'express';
import {sprintf} from 'sprintf-js';
import dbConn from '../../core/dbConn';
import {server, dbTblName, chart} from '../../core/config';
import strings from '../../core/strings';

const router = express.Router();

const priceProc = (req, res, next) => {
    const params = req.query;
    const binSize = params.binSize;
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

    let sql = sprintf("SELECT COUNT(`timestamp`) `count` FROM `%s_%s_%s` WHERE `timestamp` BETWEEN '%s' AND '%s';", dbTblName.tradeBucketed, symbol, binSize, startTime, endTime);
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

        sql = sprintf("SELECT `timestamp`, AVG(`open`) `open` FROM (SELECT FLOOR((@row_number:=@row_number + 1)/%f) AS num, `timestamp`, `open` FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(`timestamp`, '%s'), '%s'), '%s') `timestamp`, `open` FROM `%s_%s_%s` WHERE `timestamp` BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `bd`, (SELECT @row_number:=0) `row_num`  ORDER BY `timestamp` ASC) `tmp` GROUP BY `num`;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.tradeBucketed, symbol, binSize, startTime, endTime);
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

const volume0Proc = (req, res, next) => {
    const params = req.query;
    const binSize = params.binSize;
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

    let sql = sprintf("SELECT COUNT(`timestamp`) `cnt` FROM (SELECT V.timestamp FROM `%s_%s_%s` V WHERE V.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`" , dbTblName.volume, binSize, symbol, startTime, endTime);
    // let sql = sprintf("SELECT COUNT(`timestamp`) `cnt` FROM (SELECT B.timestamp FROM `%s_%s_%s` B LEFT JOIN `%s_%s` W ON W.timestamp = B.timestamp LEFT JOIN `%s_%s` I ON I.timestamp = B.timestamp AND I.symbol = '%s' WHERE B.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`;" , dbTblName.tradeBucketed, symbol, binSize, dbTblName.vwap, binSize, dbTblName.id0, binSize, symbol, startTime, endTime);
    dbConn.query(sql, null, (error, rows, fields) => {
        if (error) {
            console.error(error);
            res.status(200).send({
                result: strings.error,
                message: strings.unknownServerError,
            });
            return;
        }

        const timestampFormat = "%Y-%m-%dT%H:%i:%s.000Z";

        let step = parseInt(rows[0]['cnt']) / chart.rowCount1;
        sql = sprintf("SELECT `timestamp`, SUM(`volume`) `volume`, AVG(`open`) `open` FROM (SELECT (SELECT FLOOR((@row_num:=@row_num+1) / %f)) `row_num`, tmp.* FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(V.timestamp, '%s'), '%s'), '%s') `timestamp`, IFNULL(V.volume, 0) `volume`, IFNULL(B.open, 0) `open` FROM `%s_%s_%s` V JOIN `%s_%s_%s` B ON B.timestamp = V.timestamp WHERE V.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`, (SELECT @row_num := 0) `rnum`) `final` GROUP BY `row_num` ORDER BY `timestamp`;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.volume, binSize, symbol, dbTblName.tradeBucketed, symbol, binSize, startTime, endTime);
        // console.log(sql);
        // sql = sprintf("SELECT `timestamp`, SUM(`volume`) `volume`, AVG(`open`) `open`, AVG(`vwap_seed`) `vwap_seed`, AVG(`num_3`) `num_3`, AVG(`num_6`) `num_6`, AVG(`num_9`) `num_9`, AVG(`num_100`) `num_100` FROM (SELECT (SELECT FLOOR((@row_num:=@row_num+1) / %f)) `row_num`, tmp.* FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(B.timestamp, '%s'), '%s'), '%s') `timestamp`, IFNULL(B.volume, 0) `volume`, IFNULL(B.open, 0) `open`, IFNULL(W.vwap_seed, 1) `vwap_seed`, IFNULL(I.num_3, 0) `num_3`, IFNULL(I.num_6, 0) `num_6`, IFNULL(I.num_9, 0) `num_9`, IFNULL(I.num_100, 0) `num_100` FROM `%s_%s_%s` B LEFT JOIN `%s_%s` W ON W.timestamp = B.timestamp LEFT JOIN `%s_%s` I ON I.timestamp = B.timestamp WHERE B.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`, (SELECT @row_num := 0) `rnum`) `final` GROUP BY `row_num` ORDER BY `timestamp`;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.tradeBucketed, symbol, binSize, dbTblName.vwap, binSize, dbTblName.id0, binSize, startTime, endTime);
        dbConn.query(sql, null, (error, results, fields) => {
            if (error) {
                console.error(error);
                res.send({
                    result: strings.error,
                    message: strings.unknownServerError,
                });
                return;
            }
            let final = [];
            let lastOpen = 0;
            let volumeSum = 0;
            for (let item of results) {
                if (item.open != 0) {
                    lastOpen = item.open;
                }
                volumeSum += item.volume;
                final.push({
                    timestamp: item.timestamp,
                    open: lastOpen,
                    volume: item.volume,
                    volumeSum: volumeSum,
                });
            }
            final.pop();
            final.pop();
            res.status(200).send({
                result: strings.success,
                data: final,
            });
        });
    });
};

const volume1Proc = (req, res, next) => {
    const params = req.query;
    const binSize = params.binSize;
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

    let sql = sprintf("SELECT COUNT(`timestamp`) `cnt` FROM (SELECT V.timestamp FROM `%s_%s_%s` V LEFT JOIN `%s_%s` W ON W.timestamp = V.timestamp LEFT JOIN `%s_%s_%s` I ON I.timestamp = V.timestamp WHERE V.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`" , dbTblName.volume, binSize, symbol, dbTblName.vwap, binSize, dbTblName.id0, symbol, binSize, startTime, endTime);
    // let sql = sprintf("SELECT COUNT(`timestamp`) `cnt` FROM (SELECT B.timestamp FROM `%s_%s_%s` B LEFT JOIN `%s_%s` W ON W.timestamp = B.timestamp LEFT JOIN `%s_%s` I ON I.timestamp = B.timestamp AND I.symbol = '%s' WHERE B.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`;" , dbTblName.tradeBucketed, symbol, binSize, dbTblName.vwap, binSize, dbTblName.id0, binSize, symbol, startTime, endTime);
    dbConn.query(sql, null, (error, rows, fields) => {
        if (error) {
            console.error(error);
            res.status(200).send({
                result: strings.error,
                message: strings.unknownServerError,
            });
            return;
        }

        const timestampFormat = "%Y-%m-%dT%H:%i:%s.000Z";

        let step = parseInt(rows[0]['cnt']) / chart.rowCount1;
        sql = sprintf("SELECT `timestamp`, SUM(`volume`) `volume`, AVG(`open`) `open`, AVG(`vwap_seed`) `vwap_seed`, AVG(`num_3`) `num_3`, AVG(`num_6`) `num_6`, AVG(`num_9`) `num_9`, AVG(`num_100`) `num_100` FROM (SELECT (SELECT FLOOR((@row_num:=@row_num+1) / %f)) `row_num`, tmp.* FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(V.timestamp, '%s'), '%s'), '%s') `timestamp`, IFNULL(V.volume, 0) `volume`, IFNULL(B.open, 0) `open`, IFNULL(W.vwap_seed, 1) `vwap_seed`, IFNULL(I.num_3, 0) `num_3`, IFNULL(I.num_6, 0) `num_6`, IFNULL(I.num_9, 0) `num_9`, IFNULL(I.num_100, 0) `num_100` FROM `%s_%s_%s` V JOIN `%s_%s_%s` B ON B.timestamp = V.timestamp LEFT JOIN `%s_%s` W ON W.timestamp = V.timestamp LEFT JOIN `%s_%s_%s` I ON I.timestamp = V.timestamp WHERE V.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`, (SELECT @row_num := 0) `rnum`) `final` GROUP BY `row_num` ORDER BY `timestamp`;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.volume, binSize, symbol, dbTblName.tradeBucketed, symbol, binSize, dbTblName.vwap, binSize, dbTblName.id0, symbol, binSize, startTime, endTime);
        // sql = sprintf("SELECT `timestamp`, SUM(`volume`) `volume`, AVG(`open`) `open`, AVG(`vwap_seed`) `vwap_seed`, AVG(`num_3`) `num_3`, AVG(`num_6`) `num_6`, AVG(`num_9`) `num_9`, AVG(`num_100`) `num_100` FROM (SELECT (SELECT FLOOR((@row_num:=@row_num+1) / %f)) `row_num`, tmp.* FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(B.timestamp, '%s'), '%s'), '%s') `timestamp`, IFNULL(B.volume, 0) `volume`, IFNULL(B.open, 0) `open`, IFNULL(W.vwap_seed, 1) `vwap_seed`, IFNULL(I.num_3, 0) `num_3`, IFNULL(I.num_6, 0) `num_6`, IFNULL(I.num_9, 0) `num_9`, IFNULL(I.num_100, 0) `num_100` FROM `%s_%s_%s` B LEFT JOIN `%s_%s` W ON W.timestamp = B.timestamp LEFT JOIN `%s_%s` I ON I.timestamp = B.timestamp WHERE B.timestamp BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `tmp`, (SELECT @row_num := 0) `rnum`) `final` GROUP BY `row_num` ORDER BY `timestamp`;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.tradeBucketed, symbol, binSize, dbTblName.vwap, binSize, dbTblName.id0, binSize, startTime, endTime);
        dbConn.query(sql, null, (error, results, fields) => {
            if (error) {
                console.error(error);
                res.send({
                    result: strings.error,
                    message: strings.unknownServerError,
                });
                return;
            }
            let final = [];
            let lastOpen = 0;
            let lastNum3 = 0;
            let lastNum6 = 0;
            let lastNum9 = 0;
            let lastNum100 = 0;
            let volumeSum = 0;
            for (let item of results) {
                if (item.open != 0) {
                    lastOpen = item.open;
                }
                if (item.num_3 != 0) {
                    lastNum3 = item.num_3;
                }
                if (item.num_6 != 0) {
                    lastNum6 = item.num_6;
                }
                if (item.num_9 != 0) {
                    lastNum9 = item.num_9;
                }
                if (item.num_100 != 0) {
                    lastNum100 = item.num_100;
                }
                volumeSum += item.volume;
                final.push({
                    timestamp: item.timestamp,
                    open: lastOpen,
                    volume: item.volume,
                    volumeSum: volumeSum,
                    num_3: item.vwap_seed * lastNum3,
                    num_6: item.vwap_seed * lastNum6,
                    num_9: item.vwap_seed * lastNum9,
                    num_100: item.vwap_seed * lastNum100,
                });
            }
            final.pop();
            final.pop();
            res.status(200).send({
                result: strings.success,
                data: final,
            });
        });
    });
};

const volume2Proc = (req, res, next) => {
    const params = req.query;
    const binSize = params.binSize;
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

    let sql = sprintf("SELECT COUNT(`timestamp`) `cnt` FROM (SELECT I.timestamp, I.openInterest, I.openValue, IFNULL(B.open, 0) `open` FROM `%s_%s` I LEFT JOIN `%s_%s_%s` B ON B.timestamp = I.timestamp WHERE I.timestamp BETWEEN '%s' AND '%s') `tmp`", dbTblName.interestedNValue, binSize, dbTblName.tradeBucketed, symbol, binSize, startTime, endTime);
    dbConn.query(sql, undefined, (error, results, fields) => {
        if (error) {
            console.error(error);
            res.send({
                result: strings.error,
                message: strings.unknownServerError,
            });
            return;
        }

        const timestampFormat = "%Y-%m-%dT%H:%i:%s.000Z";

        let step = parseInt(results[0]['cnt']) / chart.rowCount1;
        sql = sprintf("SELECT `timestamp`, AVG(`openInterest`) `openInterest`, AVG(`openValue`) `openValue`, AVG(`open`) `open` FROM (SELECT tmp.*, FLOOR((SELECT @row_num:=@row_num+1) / %f) `row_num` FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(I.timestamp, '%s'), '%s'), '%s') `timestamp`, I.openInterest, I.openValue, IFNULL(B.open, 0) `open` FROM `%s_%s` I JOIN `%s_%s_%s` B ON B.timestamp = I.timestamp WHERE I.timestamp BETWEEN '%s' AND '%s') `tmp`, (SELECT @row_num:=0) `rnum`) `final` GROUP BY `row_num` ORDER BY `timestamp` ASC;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.interestedNValue, binSize, dbTblName.tradeBucketed, symbol, binSize, startTime, endTime);
        dbConn.query(sql, null, (error, results, fields) => {
            if (error) {
                console.log(error);
                res.send({
                    result: strings.error,
                    message: strings.unknownServerError,
                });
                return;
            }
            if (results == null) {
                res.send({
                    result: 'error',
                    data: 'no data',
                });
                return;
            }
            let final = [];
            let lastOpen = 0;
            for (let item of results) {
                if (item.open != 0) {
                    lastOpen = item.open;
                }
                final.push({
                    timestamp: item.timestamp,
                    open: lastOpen,
                    openInterest: item.openInterest,
                    openValue: item.openValue / 10000,
                });
            }
            final.pop();
            final.pop();
            res.status(200).send({
                result: strings.success,
                data: final,
            });
        });
    });
};

const ohlcProc = (req, res, next) => {
    const params = req.query;
    const binSize = params.binSize;
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

    let sql = sprintf("SELECT COUNT(`timestamp`) `count` FROM `%s_%s_%s` WHERE `timestamp` BETWEEN '%s' AND '%s';", dbTblName.tradeBucketed, symbol, binSize, startTime, endTime);
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

        sql = sprintf("SELECT `timestamp`, AVG(`open`) `open`, AVG(`high`) `high`, AVG(`low`) `low`, AVG(`close`) `close` FROM (SELECT FLOOR((@row_number:=@row_number + 1)/%f) AS num, `timestamp`, `open`, `high`, `low`, `close` FROM (SELECT DATE_FORMAT(ADDTIME(STR_TO_DATE(`timestamp`, '%s'), '%s'), '%s') `timestamp`, `open`, `high`, `low`, `close` FROM `%s_%s_%s` WHERE `timestamp` BETWEEN '%s' AND '%s' ORDER BY `timestamp`) `bd`, (SELECT @row_number:=0) `row_num`  ORDER BY `timestamp` ASC) `tmp` GROUP BY `num`;", step, timestampFormat, timeOffset, timestampFormat, dbTblName.tradeBucketed, symbol, binSize, startTime, endTime);
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

// router.get('/price', priceProc);
router.get('/price', priceProc);
router.get('/volume0', volume0Proc);
router.get('/volume1', volume1Proc);
router.get('/volume2', volume2Proc);
router.get('/ohlc', ohlcProc);

module.exports = router;
