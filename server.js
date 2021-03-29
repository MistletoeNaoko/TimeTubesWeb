var path = require('path');
var express = require('express');
const PORT = process.env.PORT || 5000

var app = express();

app.use(express.static(path.join(__dirname, '/src')))
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

// var server = app.listen(app.get('port'), function() {
//     console.log('listening on port ', server.address().port);
// });
// const express = require('express')
// const path = require('path')
// const PORT = process.env.PORT || 5000

// express()
//   .use(express.static(path.join(__dirname, '/src')))
//   .set('views', path.join(__dirname, 'views'))
//   .set('view engine', 'ejs')
//   .get('/', (req, res) => res.render('index'))
//   .listen(PORT, () => console.log(`Listening on ${ PORT }`))