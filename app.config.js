module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== 'react-native-maps') return plugin;

    const options = Array.isArray(plugin) ? plugin[1] ?? {} : {};
    return [
      'react-native-maps',
      {
        ...options,
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    ];
  });

  return {
    ...config,
    plugins,
  };
};
