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

  const hasPlugin = (name) =>
    plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === name);

  if (!hasPlugin('@react-native-firebase/app')) {
    plugins.push('@react-native-firebase/app');
  }
  if (!hasPlugin('@react-native-firebase/auth')) {
    plugins.push('@react-native-firebase/auth');
  }
  if (!hasPlugin('expo-build-properties')) {
    plugins.push([
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
        },
      },
    ]);
  }

  return {
    ...config,
    plugins,
  };
};
