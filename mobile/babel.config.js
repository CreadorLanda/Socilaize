/**
 * Babel.
 *
 * This file exists only to make the preset explicit. `babel-preset-expo`
 * already does the work that matters here: when `react-native-worklets` is
 * present it adds `react-native-worklets/plugin` itself, which is what
 * compiles the `'worklet'` directive in VisionCamera's frame processors.
 *
 * An earlier version of this file registered `react-native-worklets-core/plugin`
 * instead. That was a different library with a similar name — the one
 * VisionCamera used at v3/v4 — and registering its plugin fixed nothing while
 * adding a second worklets transform over the same directives. The actual
 * missing piece was the `react-native-vision-camera-worklets` package.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
