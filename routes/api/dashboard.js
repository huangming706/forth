import express from 'express';
import strings from "../../core/strings";
import dbConn from '../../core/dbConn';
import {server} from '../../core/config';
const router = express.Router();

const currentSymbolPostProc = (req, res, next) => {
  const params = req.body;
  const userId = params.userId;
  const symbol = params.symbol;

  const acceptSymbol = server.acceptSymbols;
  if (acceptSymbol.indexOf(symbol) === -1) {
    res.status(200).send({
      result: strings.error,
      message: strings.symbolIsInvalid,
    });
    return;
  }

  let sql = `INSERT INTO \`settings\`(\`userId\`, \`symbol\`) VALUES('${userId}', '${symbol}') ON DUPLICATE KEY UPDATE \`symbol\` = VALUES(\`symbol\`)`;
  console.log(sql);
  dbConn.query(sql, null, (error, result, fields) => {
    if (error) {
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
    } else {
      res.status(200).send({
        result: strings.success,
        message: strings.successfullyChanged,
      });
    }
  });
};

router.post('/current-symbol', currentSymbolPostProc);

module.exports = router;
