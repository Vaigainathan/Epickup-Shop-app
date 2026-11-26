import Constants from 'expo-constants';

export function getAppVersionLabel(): string {
  const version = Constants.expoConfig?.version;
  if (!version) {
    return '';
  }
  return `v${version}`;
}