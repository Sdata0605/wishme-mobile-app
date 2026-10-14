// Web-only stand-in for native modules that cannot load in a browser (used by the local visual preview only).
const noop = () => {};
const handler = { get: (_t, k) => (k === '__esModule' ? false : k === 'default' ? proxy : noop) };
const proxy = new Proxy(noop, handler);
module.exports = proxy;
