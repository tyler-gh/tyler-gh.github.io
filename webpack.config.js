const path = require('path');
const config = {
    entry: './src/index.js',
    mode: 'production',
    output: {
        path: path.resolve(__dirname, 'assets', 'js'),
    },
    plugins: [],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/i,
                loader: 'babel-loader',
            },
            {
                test: /\.(frag|vert)$/i,
                use: 'raw-loader',
              },
        ],
    },
};

module.exports = () => {
    return config;
};
