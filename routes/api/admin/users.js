import express from 'express';
import {sprintf} from 'sprintf-js';
import dbConn from '../../../core/dbConn';
import {server, dbTblName, chart} from '../../../core/config';
import strings from '../../../core/strings';
import myCryto from '../../../core/myCrypto';
import {loginFlagPerUser, loginTimestampPerUser, lastTimestampPerUser} from '../../../service/socket.io-service';
import {min} from "simple-statistics";

const router = express.Router();

const listProc = (req, res, next) => {
  let sql = `SELECT * FROM \`${dbTblName.users}\`;`;
  dbConn.query(sql, null, (error, rows, fields) => {
    if (error) {
      console.error(error);
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
      return;
    }
    let number = 1;
    const now = new Date();
    let offset;
    for (let row of rows) {
      row['number'] = number++;
      row['role'] = row['type'] === 'admin' ? 'Admin' : 'User';
      if (!loginFlagPerUser[row['id']] || !loginTimestampPerUser[row['id']] || !lastTimestampPerUser[row['id']]) {
        row['status'] = 'Offline';
      } else {
        offset = now.getTime() - lastTimestampPerUser[row['id']].getTime();
        if (offset > server.pingInterval * 2) {
          row['status'] = 'Offline';
        } else {
          offset = lastTimestampPerUser[row['id']].getTime() - loginTimestampPerUser[row['id']].getTime();
          offset = Math.round(offset / (60 * 1000));
          console.log(row['email'], lastTimestampPerUser[row['id']], loginTimestampPerUser[row['id']], lastTimestampPerUser[row['id']].getTime(), loginTimestampPerUser[row['id']].getTime(), offset);
          const hours = Math.floor(offset / 60);
          const minutes = offset % 60;
          if (offset === 0) {
            row['status'] = 'Just online';
          } else if (hours > 0) {
            if (minutes > 0) {
              row['status'] = `${hours}hrs ${minutes}mins`;
            } else {
              row['status'] = `${hours}hrs`;
            }
          } else {
            row['status'] = `${minutes}mins`;
          }
        }
      }
    }
    res.status(200).send({
      result: strings.success,
      data: rows,
    });
  });
};

const addProc = (req, res, next) => {
  const params = req.body;
  const firstName = params.firstName;
  const lastName = params.lastName;
  const email = params.email;
  const username = params.username;
  const password = params.password;
  const type = params.type;
  const invitationCode = server.invitationCode;
  const allow = 1;

  const hash = myCryto.hmacHex(password);
  let sql = `SELECT * FROM \`${dbTblName.users}\` WHERE \`email\` = '${email}';`;
  dbConn.query(sql, null, (error, rows, fields) => {
    if (error) {
      console.error(error);
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
      return;
    }
    if (rows.length > 0) {
      res.status(200).send({
        result: strings.error,
        message: strings.thisEmailIsAlreadyUsed,
      });
      return;
    }
    sql = `INSERT \`${dbTblName.users}\`(\`type\`, \`firstName\`, \`lastName\`, \`email\`, \`username\`, \`hash\`, \`invitationCode\`, \`allow\`) VALUES('${type}', '${firstName}', '${lastName}', '${email}', '${username}', '${hash}', '${invitationCode}', '${allow}');`;
    dbConn.query(sql, null, (error, result, fields) => {
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
        message: strings.successfullyRegistered,
      });
    });
  });
};

const editProc = (req, res, next) => {
  const params = req.body;
  const id = params.id;
  const firstName = params.firstName;
  const lastName = params.lastName;
  const email = params.email;
  const username = params.username;
  const type = params.type;

  let sql = `SELECT * FROM \`${dbTblName.users}\` WHERE \`email\` = '${email}' AND \`id\` != '${id}';`;
  dbConn.query(sql, null, (error, rows, fields) => {
    if (error) {
      console.error(error);
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
      return;
    }
    if (rows.length > 0) {
      res.status(200).send({
        result: strings.error,
        message: strings.thisEmailIsAlreadyUsed,
      });
      return;
    }
    sql = `UPDATE \`${dbTblName.users}\` SET \`firstName\` = '${firstName}', \`lastName\` = '${lastName}', \`email\` = '${email}', \`username\` = '${username}', \`type\` = '${type}' WHERE \`id\` = '${id}';`;
    dbConn.query(sql, null, (error, result, fields) => {
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
        message: strings.successfullyChanged,
      });
    });
  });
};

const deleteProc = (req, res, next) => {
  const params = req.query;
  const id = params.id;
  let sql = `DELETE FROM \`${dbTblName.users}\` WHERE \`id\` = '${id}';`;
  console.log('admin/user', 'delete', sql);
  dbConn.query(sql, null, (error, result, fields) => {
    if (error) {
      console.error(error);
      res.status(200).send({
        result: strings.error,
        message: strings.unknownServerError,
      });
      return;
    }
    sql = `SELECT * FROM \`${dbTblName.users}\`;`;
    dbConn.query(sql, null, (error, rows, fields) => {
      if (error) {
        console.error(error);
        res.status(200).send({
          result: strings.error,
          message: strings.unknownServerError,
        });
        return;
      }
      let number = 1;
      for (let row of rows) {
        row['number'] = number++;
        row['role'] = row['type'] === 'admin' ? 'Admin' : 'User';
      }
      res.status(200).send({
        result: strings.success,
        message: strings.successfullyDeleted,
        data: rows,
      });
    });
  });
};

router.get('/', listProc);
router.post('/', addProc);
router.put('/', editProc);
router.delete('/', deleteProc);

module.exports = router;
