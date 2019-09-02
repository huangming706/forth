import express from 'express';
import {sprintf} from 'sprintf-js';
import dbConn from '../../core/dbConn';
import {dbTblName, chart} from '../../core/config';
import strings from '../../core/strings';
import myCrypto from "../../core/myCrypto";
const router = express.Router();

const passwordProc = (req, res, next) => {
  const params = req.body;
  const userId = params.userId;
  const currentPassword = params.currentPassword;
  const newPassword = params.newPassword;
  const currentHash = myCrypto.hmacHex(currentPassword);
  const newHash = myCrypto.hmacHex(newPassword);

  let sql = `SELECT * FROM ${dbTblName.users} WHERE \`id\` = '${userId}' AND \`hash\` = '${currentHash}';`;
  dbConn.query(sql, null, (error, rows, fields) => {
    if (error) {
      console.error('settings/password', JSON.stringify(error));
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
      return;
    }
    if (rows.length === 0) {
      res.status(200).send({
        result: strings.error,
        message: strings.currentPasswordIncorrect,
      });
      return;
    }
    sql = `UPDATE \`${dbTblName.users}\` SET \`hash\` = '${newHash}' WHERE \`id\` = '${userId}';`;
    dbConn.query(sql, null, (error, result, fields) => {
      if (error) {
        console.error('settings/password', JSON.stringify(error));
        res.status(200).send({
          result: strings.error,
          message: strings.unknownServerError,
        });
        return;
      }
      res.status(200).send({
        result: strings.success,
        message: strings.successfullyChanged,
      });
    });
  });
};

router.post('/password', passwordProc);

module.exports = router;
