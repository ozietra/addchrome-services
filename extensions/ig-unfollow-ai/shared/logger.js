/**
 * Logging disabled.
 *
 * This is a no-op stand-in kept only so existing `Logger.*` calls and the
 * <script>/importScripts includes keep working without edits. It writes
 * nothing to storage and prints nothing to the console.
 */
(function (global) {
  const noop = function () {};
  global.Logger = {
    info: noop,
    warn: noop,
    error: noop,
    flush: noop,
    getAll: async () => [],
    formatText: () => '',
    clearAll: async () => {}
  };
})(typeof self !== 'undefined' ? self : this);
