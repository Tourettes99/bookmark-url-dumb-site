const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const path = require('path');

module.exports = {
    plugins: [
        new Dotenv()
    ],
    entry: './static/script.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    mode: 'development',
    watch: true
}; 