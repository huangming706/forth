import express from 'express';
import {sprintf} from 'sprintf-js';
import axios from "axios";
import {CWStreamClient, STATE, EVENT, ERROR} from 'cw-stream-client';
import {dbTblName} from '../../core/config';
import dbConn from '../../core/dbConn';
import strings from "../../core/strings";

const router = express.Router();

let ioServer;
let marketHistory = [];
let itemCount = 50;
const maxItemCount = 1000;

let currentStreamClient;

const cryptoMarketsProc = (req, res, next) => {
    let sql = sprintf("SELECT * FROM `crypto_markets`;", dbTblName.cryptoMarkets);
    dbConn.query(sql, null, (error, rows, fields) => {
        if (error) {
            console.error(error);
            res.status(200).send({
                result: strings.error,
                message: strings.unknownServerError,
            });
            return;
        }
        res.status(200).send({
            result: strings.success,
            data: rows,
        });
    });
};

const subscribeProc = (req, resonse, next) => {
    marketHistory = [];
    emitData('marketHistory', marketHistory);

    if (currentStreamClient) {
        try {
            currentStreamClient.disconnect();
        } catch (e) {
        }
        currentStreamClient = undefined;
    }

    const params = req.body;
    const symbol = params.symbol;
    const minPrice = params.minPrice;
    const itemCount = params.itemCount;
    const exchangeIds = params.exchangeIds;

    console.log('exchangeIds111111:', exchangeIds);
    let pairId = '';
    let marketPair = [];
    let marketPairLength = 0;
    let subscriptionData = [];
    let item = '';
    let marketPairs = [];

    let filters = [];
    for (let i = 0; i < exchangeIds.length; i++) {
        let filter = {
            marketName: exchangeIds[i],
            marker: true,
            totalPrice: 0
        };
        filters.push(filter);
    }
    // console.log(filters);
    let currentFilter = {
        marketName: '',
        marker: true,
        totalPrice: 0,
    };
    // currentFilter.marketName = '';
    // currentFilter.marker = true;
    // currentFilter.totalPrice = 0;
    axios.get("https://api.cryptowat.ch/pairs/" + symbol)//get markets which support symbol
        .then(res => {
            marketPair = res.data.result.markets;//exchanges which support the current symbol
            pairId = res.data.result.id;
            console.log("pairId", pairId);
            let marketPairLength = marketPair.length;
            for (let i = 0; i < marketPairLength; i++) {
                for (let j = 0; j < filters.length; j++) {
                    if (marketPair[i].exchange == filters[j].marketName) {
                        item = "markets:" + marketPair[i].id + ":trades";
                        marketPairs.push(marketPair[i]);
                        subscriptionData.push(item);
                    }

                }
            }
            // console.log("SUBSCRIPTIONDATA 111111111:",subscriptionData);
            const client = new CWStreamClient({
                apiKey: "4Y8X6OHWUXH1RYDYRF9P", // or via environment variable CW_API_KEY
                secretKey: "Yp2jK4i5x+Q4dCB1DDYn0IW2hktZjUYOmuGPhaFh", // or via environment variable CW_SECRET_KEY
                subscriptions: subscriptionData
            });
            client.onMarketUpdate(marketData => {
                let marketId = marketData.market.marketId.low;
                let marketName = '';
                // console.log(marketId);
                // console.log("MarketData:", marketData.tradesUpdate.trades);
                let data = marketData.tradesUpdate.trades;

                for (let i = 0; i < data.length; i++) {

                    for (let j = 0; j < marketPairs.length; j++) {
                        if (marketId == marketPairs[j].id) {
                            marketName = marketPairs[j].exchange;
                        }
                    }
                    //console.log('marketName:12312141455255:  ',marketName)
                    var totalPrice = parseFloat(data[i].price) * parseFloat(data[i].amount);
                    // console.log('Price11111111111111: ', data[i].price);
                    for (var k = 0; k < filters.length; k++) {
                        if (filters[k].marketName == marketName) {
                            currentFilter = filters[k];
                        }
                    }
                    if (totalPrice >= minPrice) {

                        let marker = currentFilter.marker;
                        if (currentFilter.totalPrice > data[i].price) {  //lower: sell
                            marker = true;
                            currentFilter.totalPrice = data[i].price;
                            currentFilter.marker = marker;
                        } else if (currentFilter.totalPrice < data[i].price) { //higher: buy
                            marker = false;
                            currentFilter.totalPrice = data[i].price;
                            currentFilter.marker = marker;
                        }
                        let marketHistoryItem = {
                            marketName: marketName,
                            timestamp: data[i].timestamp.low,
                            price: data[i].price,
                            amount: totalPrice,
                            marker: marker
                        };
                        marketHistory.push(marketHistoryItem);
                        const cnt = marketHistory.length;
                        if (cnt > maxItemCount) {
                            marketHistory = marketHistory.slice(cnt - maxItemCount, maxItemCount);
                        }
                    }

                }
                if (currentStreamClient === client) {
                    emitData('marketHistory', marketHistory);
                    ioServer.sockets.emit('marketHistory', marketHistory);
                }

            });

            client.onError(err => {
                // You can check what error it was against the exported ERROR object
                switch (err) {
                    case ERROR.CONNECTION_REFUSED:
                        console.log("connection refused");
                        break;

                    case ERROR.PROTOBUF:
                        console.log("protobuf error");
                        break;
                }
            });

            client.on(ERROR.MISSING_API_KEY, () => {
                console.log("missing api key");
            });

            client.onStateChange(newState => {
                console.log("connection state changed:", newState);
            });

            client.onConnect(() => {
                console.info("streaming data for the next 15 seconds...");
            });

            client.onDisconnect(() => {
                console.log("done");
            });

            currentStreamClient = client;
            client.connect();

            resonse.status(200).send({
                result: strings.success,
                data: marketHistory,
            });
        })
        .catch(err => {
            console.error(err);
            resonse.status(200).send({
                result: strings.error,
                message: strings.unknownServerError,
            });
        });
};

router.get('/crypto-markets', cryptoMarketsProc);
router.post('/subscribe', subscribeProc);

const emitData = (event, data) => {
    ioServer.sockets.emit(event, data);
};

module.exports = router;
module.exports.setIOServer = (io) => {
    ioServer = io;
    ioServer.on('connection', (socket) => {
        socket.emit('marketHistory', marketHistory);
    });
};
