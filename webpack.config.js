// var debug = process.env.NODE_ENV !== "production";
// var webpack = require('webpack');
// var path = require('path');
//
// module.exports = {
//     context: path.join(__dirname, "src"),
//     devtool: debug ? "inline-sourcemap" : null,
//     entry: "./js/client.js",
//     module: {
//         loaders: [
//             {
//                 test: /\.jsx?$/,
//                 exclude: /(node_modules|bower_components)/,
//                 loader: 'babel-loader',
//                 query: {
//                     presets: ['react', 'es2015', 'stage-0'],
//                     plugins: ['react-html-attrs', 'transform-class-properties', 'transform-decorators-legacy'],
//                 }
//             }
//         ]
//     },
//     output: {
//         path: __dirname + "/src/",
//         filename: "client.min.js"
//     },
//     plugins: debug ? [] : [
//         new webpack.optimize.DedupePlugin(),
//         new webpack.optimize.OccurenceOrderPlugin(),
//         new webpack.optimize.UglifyJsPlugin({ mangle: false, sourcemap: false }),
//     ],
// };
module.exports = {
    entry: "./src/js/client.js",
    output: {
        path:__dirname+ '/src/',
        filename: "client.min.js",
        publicPath: '/'
    },
    devServer: {
        contentBase: "./src",
    },
    performance: {hints: false},
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude:/(node_modules|bower_components)/,
                loader: 'babel-loader',
                options: {
                    presets: ['@babel/preset-env', '@babel/preset-react']
                }
                // query: {
                //     presets: ['es2015', 'react']
                // }
            }
        ]
    },
    node: {
        fs: 'empty'
    }

};
