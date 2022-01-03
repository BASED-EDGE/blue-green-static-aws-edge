const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs')

module.exports = {
    entry: {index:"./src/index.jsx"},
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /(node_modules|bower_components)/,
          loader: "babel-loader",
          options: { presets: ["@babel/env"] }
        },
      
      ]
    },
    resolve: { extensions: [ ".js", ".jsx"] },
    output: {
      path: path.resolve(__dirname, "dist/"),
      filename:'[name].js',
      chunkFilename:'[contenthash].js',
      asyncChunks:true,
       publicPath: process.argv.includes('production') ?
        "/assets/"+fs.readFileSync('./dist/build_id').toString()+'/'
        :undefined,
    },
    devServer: {
      port: 3000,
    },
    plugins:[
      new HtmlWebpackPlugin({
        templateContent: `
    <html>
      <head>
        <title>webpack dev server page</title>
      </head>
      <body>
        <div id="root" ></div>
      </body>
    </html>
  `
      })
    ],
  };