/**
 * Babel, which this project did not have.
 *
 * Expo falls back to `babel-preset-expo` when there is no config, and that
 * carries the Reanimated plugin — so everything worked and nothing looked
 * missing. But `react-native-worklets-core` ships its own plugin and nothing
 * auto-registers it.
 *
 * Without it the `'worklet'` directive in a frame processor is an ordinary
 * string in an ordinary function. VisionCamera then hands that function to the
 * frame thread, which cannot run it, and the app dies opening the camera.
 *
 * Order matters: the worklets plugin has to come before Reanimated's, and
 * Reanimated's has to be last of all. babel-preset-expo appends Reanimated
 * itself, so listing worklets here puts it in the right place.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['react-native-worklets-core/plugin']],
  };
};
