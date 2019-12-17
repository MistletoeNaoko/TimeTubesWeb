import React from "react";
import ReactDOM from "react-dom";
import Layout from "./Pages/Layout";

const app = document.getElementById('app');
ReactDOM.render(<Layout/>, app);
if (localStorage.privateComment === undefined) {
    localStorage.setItem('privateComment', JSON.stringify([]));
}

// const mongoose = require('mongoose');
// const MongoClient = require('mongodb').MongoClient;
// const url = 'mongodb://localhost:27017';
// const dbName = 'comments';

// MongoClient.connect(url, (err, client) => {

//     /* Errorがあれば処理を中断 */
//     // assert.equal(null, err);
  
//     /* 接続に成功すればコンソールに表示 */
//     console.log('Connected successfully to server');
  
//     /** DBを取得 */
//     const db = client.db(dbName);
  
//     /* DBとの接続切断 */
//     client.close();
//   });
