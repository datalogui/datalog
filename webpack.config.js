var path = require('path')

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'assign',
    library: 'magic',
    filename: 'bundle.js'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json']
  },
  module: {
    rules: [{
      // Include ts, tsx, js, and jsx files.
      test: /\.(ts|js)x?$/,
      exclude: /node_modules/,
      loader: 'babel-loader'
    }]
  },
  performance: {
    // Warn if size is bigger the 5MB
    maxEntrypointSize: 5e6,
    maxAssetSize: 5e6
  }
}
