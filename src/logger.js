/* eslint-disable no-console */
// @ts-ignore
// eslint-disable-next-line import/prefer-default-export
export const log = {
  // @ts-ignore
  log: (...args) => {
    // eslint-disable-next-line no-param-reassign
    args[0] = `Perframe: ${args[0]}`;
    // It is a ServiceWorker.
    // eslint-disable-next-line no-restricted-globals
    if (self.performance) {
      console.log(...args);
    }
  },
  // @ts-ignore
  error: (...args) => {
    // eslint-disable-next-line no-param-reassign
    args[0] = `Perframe: ${args[0]}`;
    // It is a ServiceWorker.
    // eslint-disable-next-line no-restricted-globals
    if (self.performance) {
      console.error(...args);
    }
  }
};
