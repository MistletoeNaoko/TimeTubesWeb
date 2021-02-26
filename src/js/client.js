import React from "react";
import ReactDOM from "react-dom";
import Layout from "./Pages/Layout";
import {convertPreviousCommentsIntoNewFormat} from './lib/dataLib';

const app = document.getElementById('app');
ReactDOM.render(<Layout/>, app);
if (localStorage.getItem('privateComment') === null || localStorage.getItem('privateComment') === '[]') {
    localStorage.setItem('privateComment', JSON.stringify({}));
}
if (Array.isArray(JSON.parse(localStorage.getItem('privateComment')))) {
    convertPreviousCommentsIntoNewFormat();
}
if (localStorage.getItem('queryTable') === null || localStorage.getItem('queryTable') === '[]') {
    localStorage.setItem('queryTable', JSON.stringify({}));
}

// initialize sessionStorage whenever the app is reloaded
sessionStorage.setItem('clusteringHistory', JSON.stringify({}));

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
