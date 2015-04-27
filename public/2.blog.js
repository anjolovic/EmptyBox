webpackJsonp([2],{8:function(e,t,n){e.exports="# The ultimate Webpack setup\n\nI have already written [an article](http://christianalfoni.com/articles/2014_12_13_Webpack-and-react-is-awesome) on using Webpack for your React application. Now I have more experience and want to share a really awesome setup we use at my employer, **Gloppens EDB Lag**, that gives you a great workflow expanding beyond the concepts of Webpack and makes it easy to do continuous deployment. \n\nWe will be talking about the following:\n\n1. Create an express application\n2. Launch our workflow with the express application\n3. Proxy requests to Webpack-dev-server and other endpoints like firebase\n4. Create a continuous deployment flow\n\nSo let us get started with creating our setup. If you want to follow a long on your own machine, please do, or just read through to get some inspiration. I will not be going through every single detail like installing the dependencies used etc., that is just basic Node and NPM stuff. You can head straight to the [webpack-express-boilerplate](https://github.com/christianalfoni/webpack-express-boilerplate) to check all the code or export the boilerplate to a directory of your choice with:\n\n`svn export https://github.com/christianalfoni/webpack-express-boilerplate/trunk ./dir`\n\n## File structure\nBefore we get started I think it is good to get an overview of the directory we are going to work with:\n\n```javascript\n\n- /app\n- /app/main.js - Entry point for your app\n- /public\n- /public/index.html\n- /server\n- /server/bundle.js - Our workflow code\n- server.js - Express and proxies\n- webpack.config.js\n- webpack.production.config.js\n- package.json - Deployment and project configuration\n```\n\n## Project configuration file\nFirst of all lets set up a basic configuration file for our project using NPM. In the project root run `npm init` and just type in what makes sense to you or just hit ENTER. When it is ready open it up and insert the following:\n\n```javascript\n\n{\n  ...\n  \"scripts\": {\n    \"start\": \"node server\"\n  },\n  ...\n}\n```\n\nThis just tells NPM what command to run when we type `npm start` in our terminal. This will also be used by for example Nodejitsu or Heroku to run the application.\n\n## Express server\nIf you are just going to use the Node server as a development tool for prototyping or actually run it in production you will need something to handle the requests from the browser. Express is great for that so lets go ahead and set up a server:\n\n*server.js*\n```javascript\n\nvar express = require('express');\nvar path = require('path');\n\nvar app = express();\n\nvar isProduction = process.env.NODE_ENV === 'production';\nvar port = isProduction ? 8080 : 3000;\nvar publicPath = path.resolve(__dirname, 'public');\n\n// We point to our static assets\napp.use(express.static(publicPath));\n\n// And run the server\napp.listen(port, function () {\n  console.log('Server running on port ' + port);\n});\n\n```\n\n*/public/index.html*\n```javascript\n\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n</head>\n<body>\n  <script src=\"/build/bundle.js\"></script>\n</body>\n</html>\n```\n\nWhen we now run `npm start` we can go to `localhost:3000` in the browser and see a white screen and an error in our console related to not finding the *bundle.js* file. Great, that is actually what we expect!\n\n## Workflow\nLets continue setting up the actual workflow. Lets first configure Webpack for our development workflow:\n\n*webpack.config.js*\n```javascript\n\nvar Webpack = require('webpack');\nvar path = require('path');\nvar nodeModulesPath = path.resolve(__dirname, 'node_modules');\nvar buildPath = path.resolve(__dirname, 'public', 'build');\nvar mainPath = path.resolve(__dirname, 'app', 'main.js');\n\nvar config = {\n  \n  // Makes sure errors in console map to the correct file\n  // and line number\n  devtool: 'eval',\n  entry: [\n\n    // For hot style updates\n    'webpack/hot/dev-server', \n\n    // The script refreshing the browser on none hot updates\n    'webpack-dev-server/client?http://localhost:8080', \n\n    // Our application\n    mainPath],\n  output: {\n\n    // We need to give Webpack a path. It does not actually need it,\n    // because files are kept in memory in webpack-dev-server, but an \n    // error will occur if nothing is specified. We use the buildPath \n    // as that points to where the files will eventually be bundled\n    // in production\n    path: buildPath,\n    filename: 'bundle.js',\n\n    // Everything related to Webpack should go through a build path,\n    // localhost:3000/build. That makes proxying easier to handle\n    publicPath: '/build/'\n  },\n  module: {\n\n    loaders: [\n\n    // I highly recommend using the babel-loader as it gives you\n    // ES6/7 syntax and JSX transpiling out of the box\n    {\n      test: /\\.js$/,\n      loader: 'babel',\n      exclude: [nodeModulesPath]\n    },\n  \n    // Let us also add the style-loader and css-loader, which you can\n    // expand with less-loader etc.\n    {\n      test: /\\.css$/,\n      loader: 'style!css'\n    }\n\n    ]\n  },\n\n  // We have to manually add the Hot Replacement plugin when running\n  // from Node\n  plugins: [new Webpack.HotModuleReplacementPlugin()]\n};\n\nmodule.exports = config;\n```\n\nNote that we are not actually outputting any files when running the workflow, but we want these \"in-memory\" files to be fetched from the same path as in production, `localhost:3000/build/bundle.js`. That way we only need one index.html file.\n\nSo that is the configuration. Now we need to build the bundler.\n\n*server/bundle.js*\n```javascript\n\nvar Webpack = require('webpack');\nvar WebpackDevServer = require('webpack-dev-server');\nvar webpackConfig = require('./../webpack.config.js');\nvar path = require('path');\nvar fs = require('fs');\nvar mainPath = path.resolve(__dirname, '..', 'app', 'main.js');\n\nmodule.exports = function () {\n  \n  // First we fire up Webpack an pass in the configuration we\n  // created\n  var compiler = Webpack(webpackConfig, function () {\n\n    // Due to a bug with the style-loader we have to \"touch\" a file\n    // to force a rebundle after the initial one. Kudos to my colleague \n    // Stephan for this one\n    fs.writeFileSync(mainPath, fs.readFileSync(mainPath).toString());\n    console.log('Project is ready!');\n\n  });\n\n  var bundler = new WebpackDevServer(compiler, {\n\n    // We need to tell Webpack to serve our bundled application\n    // from the build path. When proxying:\n    // http://localhost:3000/build -> http://localhost:8080/build\n    publicPath: '/build/',\n\n    // Configure hot replacement\n    hot: true, \n\n    // The rest is terminal configurations\n    quiet: false,\n    noInfo: true,\n    stats: {\n      colors: true\n    }\n  });\n\n  // We fire up the development server\n  bundler.listen(8080, 'localhost', function () {\n    console.log('Bundling project, please wait...');\n  });\n\n};\n\n```\nThe style-loader bug has an issue set up at [the style-loader repo](https://github.com/webpack/style-loader/issues/47). It would be great if you gave the issue a comment, get it prioritized :-)\n\nFinally we have to set up a proxy between our express server and the webpack-dev-server:\n\n*server.js*\n```javascript\n\nvar express = require('express');\nvar path = require('path');\nvar httpProxy = require('http-proxy');\n\nvar proxy = httpProxy.createProxyServer(); \nvar app = express();\n\nvar isProduction = process.env.NODE_ENV === 'production';\nvar port = isProduction ? 8080 : 3001;\nvar publicPath = path.resolve(__dirname, 'public');\n\napp.use(express.static(publicPath));\n\n// We only want to run the workflow when not in production\nif (!isProduction) {\n\n  // We require the bundler inside the if block because\n  // it is only needed in a development environment. Later\n  // you will see why this is a good idea\n  var bundle = require('./server/bundle.js'); \n  bundle();\n\n  // Any requests to localhost:3000/build is proxied\n  // to webpack-dev-server\n  app.all('/build/*', function (req, res) {\n    proxy.web(req, res, {\n        target: 'http://localhost:8080'\n    });\n  });\n\n}\n\n// It is important to catch any errors from the proxy or the\n// server will crash. An example of this is connecting to the\n// server when webpack is bundling\nproxy.on('error', function(e) {\n  console.log('Could not connect to proxy, please try again...');\n});\n\napp.listen(port, function () {\n  console.log('Server running on port ' + port);\n});\n\n```\n\n## Part summary\nOkay, now we have the actual workflow going. Just run `npm start` and you got automatic refresh, hot loading styles, source mapping and everything else you would want to add to Webpack. You are now also free to add any other public files or API endpoints to your express server. This is really great for prototyping.\n\n## Adding other endpoints\nAs part of your prototype you might want to work with a real database, or maybe you already have an API that you want to use. I will give you an example of wiring up [Firebase](https://www.firebase.com/). We will not be setting up Firebase with websockets etc., we will use the traditional REST like endpoints as that is most likely what you will be using in the production version of the application. That said it is no problem for *http-proxy* to proxy websocket requests and messages.\n\nSuppose you have set up your firebase at *glowing-carpet-4534.firebaseio.com*, let us create an endpoint for your application and proxy that.\n\n*server.js*\n```javascript\n\nvar express = require('express');\nvar path = require('path');\nvar httpProxy = require('http-proxy');\n\n// We need to add a configuration to our proxy server,\n// as we are now proxying outside localhost\nvar proxy = httpProxy.createProxyServer({\n  changeOrigin: true\n}); \nvar app = express();\n\nvar isProduction = process.env.NODE_ENV === 'production';\nvar port = isProduction ? 8080 : 3001;\nvar publicPath = path.resolve(__dirname, 'public');\n\napp.use(express.static(publicPath));\n\n// If you only want this for development, you would of course\n// put it in the \"if\" block below\napp.all('/db/*', function (req, res) {\n  proxy.web(req, res, {\n    target: 'https://glowing-carpet-4534.firebaseio.com'\n  });\n});\n\nif (!isProduction) {\n\n  var bundle = require('./server/bundle.js'); \n  bundle();\n  app.all('/build/*', function (req, res) {\n    proxy.web(req, res, {\n        target: 'http://localhost:8080'\n    });\n  });\n\n}\n\nproxy.on('error', function(e) {\n  console.log('Could not connect to proxy, please try again...');\n});\n\napp.listen(port, function () {\n  console.log('Server running on port ' + port);\n});\n```\n\nNow your frontend can for example POST to **localhost:3000/db/items.json** and you can find those changes at **glowing-carpet-4534.firebaseio.com/db/items**. Read [Firebase REST api](https://www.firebase.com/docs/rest/api/) to learn more about the REST api.\n\n## Production bundle\nBefore we actually deploy any code we want to produce a production bundle of the application. That said, what service you choose affects how you run this bundling. At its core, this is what we want to run:\n\n`webpack -p --config webpack.production.config.js`\n\nIt is very important that the environment variable *NODE_ENV* is set to *production* or you inline it with the command like this:\n\n`NODE_ENV=production webpack -p --config webpack.production.config.js`\n\nWhat you decide to do depends on the service running the command.\n\nNow lets take a look at the configuration file.\n\n*webpack.production.config.js*\n```javascript\n\nvar Webpack = require('webpack');\nvar path = require('path');\nvar nodeModulesPath = path.resolve(__dirname, 'node_modules');\nvar buildPath = path.resolve(__dirname, 'public', 'build');\nvar mainPath = path.resolve(__dirname, 'app', 'main.js');\n\nvar config = {\n  \n  // We change to normal source mapping\n  devtool: 'source-map',\n  entry: mainPath,\n  output: {\n    path: buildPath,\n    filename: 'bundle.js'\n  },\n  module: {\n    loaders: [{\n      test: /\\.js$/,\n      loader: 'babel',\n      exclude: [nodeModulesPath]\n    },{\n      test: /\\.css$/,\n      loader: 'style!css'\n    }]\n  }\n};\n\nmodule.exports = config;\n```\n\nIf you want to test this you can run: \n\n`NODE_ENV=production webpack -p --config webpack.production.config.js` \n\nYou will see a *bundle.js* file appear in the *public/build* directory, and a *bundle.js.map* file. But we are not going to be running this locally, let us get this running in the cloud. **Make sure you delete the public/build folder, as express will serve these files instead of webpack-dev-server**.\n\n## Continuous deployment\nSo ideally you want your application or prototype to find its place in the cloud. This will let your users access your application, but also if you are just creating a prototype it will allow colleagues and maybe other people interested in the project to try things out as you iterate. This makes it a lot easier to give feedback and it will be easier for you to make changes as you go.\n\nWe are going to look at two different solutions amongst many others, [Nodejitsu](https://www.nodejitsu.com/) and [Heroku](https://www.heroku.com/). I will not go into deep details in this article, but hopefully it is enough to get you going. Now, Nodejitsu is moving to GoDaddy and is currently not available for new accounts, but the two services has different approaches and its the approaches we are interested in.\n\n### Nodejitsu\nWith Nodejitsu you have a CLI tool for deploying the application. The CLI tool actually bundles up the application and moves it to the Nodejitsu servers as a *snapshot*. This is great, because we can use a build service to run tests, prepare the application for production and run the CLI tool whenever we push to the application repo. [Codeship](https://codeship.com) is one of these services and it works very well. You hook your repo to Codeship in one end and your Nodejitsu account on the other end. In between you run your tests, run the deploy command above and Codeship automatically updates the application on Nodejitsu if everything worked out okay.\n\nAll youx really have to do is inserting this command into the *Setup Commands*:\n\n`NODE_ENV=production webpack -p --config webpack.production.config.js`\n\nHere we specifically set the environment variable. The reason is that we want Codeship to run in a development environment, installing all the dependencies required for that, but when bundling the production bundle we want that to run in a production environment.\n\n### Heroku\nHeroku works a bit differently. It does not wrap up your application using a CLI tool so using a service like Codeship does not really make sense, because you have to run everything inside Heroku anyway. You might consider running your tests on Codeship though, but the production bundle has to be created on Heroku.\n\nWhen you have your Heroku account up and running with a repo attached to an app, make sure you add a *NODE_ENV* variable and a *production* value in the Heroku App configuration. To make Heroku run our production bundle command we have to create our own script and run it as a NPM *postinstall* script. Let us configure that part first in our package.json file:\n\n*package.json*\n```javascript\n\n  \"scripts\": {\n    \"start\": \"node server\",\n    \"postinstall\": \"node deploy\"\n  }\n```\n\nAnd now we can create this deploy script:\n\n*deploy.js*\n```javascript\n\n// Since postinstall will also run when you run npm install\n// locally we make sure it only runs in production\nif (process.env.NODE_ENV === 'production') {\n\n  // We basically just create a child process that will run\n  // the production bundle command\n  var child_process = require('child_process');\n  return child_process.exec(\"webpack -p --config webpack.production.config.js\", function (error, stdout, stderr) {\n    console.log('stdout: ' + stdout);\n    console.log('stderr: ' + stderr);\n    if (error !== null) {\n      console.log('exec error: ' + error);\n    }\n  });\n}\n```\n\nAnd thats it. Whenever you push to the repo Heroku will install the dependencies and then run this deploy script before running `npm start`.\n\n## Handling dependencies\nDepending on what solution you choose the production environment might need different dependencies. So instead of listing what you need in the two examples introduced, let me explain how it works.\n\nWhen you save a dependency to your *package.json* file using for example: `npm install underscore --save` that dependency will always be installed when `npm install` runs, regardless of the environment. If you save a dependency using: `npm install webpack --save-dev` that dependency will not be installed in an environment where *NODE_ENV* is *production*. So what you want is to only `--save` dependencies that you need in production, and `--save-dev` all other dependencies.\n\nIf you remember from our *server.js* file we required the *bundle.js* module inside our \"development if block\". \n\n```javascript\n\n...\nif (!isProduction) {\n\n  var bundle = require('./server/bundle.js'); \n  bundle();\n  app.all('/build/*', function (req, res) {\n    proxy.web(req, res, {\n        target: 'http://localhost:8080'\n    });\n  });\n\n}\n...\n```\n\nThat way, when *server.js* is loaded in a production environment, it will not load *bundle.js* with its Webpack and Webpack-dev-server dependencies. That said, a Heroku deployment will require Webpack since it runs the production bundle script. \n\nI hope this was not too confusing. You will get good errors if you did something wrong and it is not a problem if your production environment installs dependencies it does not need.\n\n## Summary\nOkay, I hope this was a good read. At our company we have just started using this strategy. We have a boilerplate project, much like the [webpack-express-boilerplate](https://github.com/christianalfoni/webpack-express-boilerplate), that proxies to our existing endpoints and firebase when working on new stuff. Every push we do to the prototype automatically goes to the cloud as production code and can be tested by project owners, testers and colleagues. We have of course also implemented authentication in this boilerplate.\n\nSo please feel free to fork out the repo and create your own boilerplate for prototyping and get that continuous deployment flowing!\n\nThanks for reading!\n"}});