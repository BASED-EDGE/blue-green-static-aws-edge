const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs')

module.exports = {
    entry: {index:"./src/index.jsx"},
    // mode: "production",
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
      // filename: '[contenthash].js',

       publicPath: "/assets/"+fs.readFileSync('./dist/build_id').toString(),
    //   filename: "bundle.js"
    },
    devServer: {
    //   contentBase: path.join(__dirname, "public/"),
      port: 3000,
     // publicPath: "http://localhost:3000/dist/",
    //  hotOnly: true
    },
    plugins:[
      new HtmlWebpackPlugin({
        templateContent: `
    <html>
      <body>
        <h1>Hello World</h1>
        <div id="root" ></div>
      </body>
    </html>
  `

      })
    ],
    // plugins: [new webpack.HotModuleReplacementPlugin()]
  };