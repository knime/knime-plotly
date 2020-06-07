const path = require('path');

module.exports = {
    entry: './src/knimePlotlyInterface.js',
    module: {
        rules: [
            {
                test: /\.(js)$/,
                exclude: /node_modules/,
                use: ['babel-loader']
            }
        ]
    },
    resolve: {
        extensions: ['*', '.js']
    },
    output: {
        filename: 'knimePlotlyInterface.js',
        path: path.resolve(__dirname)
    },
    mode: 'production'
};
