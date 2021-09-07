const path = require("path");
const { DefinePlugin } = require("webpack");

let { VERSION, VERSION_READABLE } = process.env;
VERSION = VERSION || -1;
VERSION_READABLE = VERSION_READABLE || "unversioned";
module.exports = {
  workerConfig() {
    const audit = process.env.AUDIT;
    if (!audit) {
      throw new Error(
        "Specify the AUDIT env variable to let me know which audit you want to use. Audits exist in REPO_ROOT/audits/ folder. e.g. you can use local as the audit name"
      );
    }

    return {
      target: "webworker",
      entry: "./src/worker/index.js",
      optimization: {
        minimize: false,
      },
      module: {
        rules: [
          {
            test: /\.txt|\.html$/i,
            use: "raw-loader",
          },
        ],
      },
      resolve: {
        alias: {
          Audit: path.resolve(__dirname, `audits/${audit}`),
        },
      },
      plugins: [
        new DefinePlugin({
          __VERSION__: VERSION,
          __VERSION_READABLE__: JSON.stringify(VERSION_READABLE),
        }),
      ],
    };
  },
  injectConfig() {
    return {
      entry: "./src/worker/inject.js",
      optimization: {
        minimize: false
      },
      output: {
        filename: 'inject.js'
      },
      module: {
        rules: [
          {
            test: /\.txt|\.html$/i,
            use: "raw-loader",
          },
        ],
      },
    };
  }
};
