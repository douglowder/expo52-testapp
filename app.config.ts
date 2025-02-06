import { ExpoConfig, ConfigContext } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  slug: "caregiver",
  name: "CareGiver",

  plugins: [
    ...(config.plugins || []), // If config.plugins is undefined, default to an empty array

    "expo-build-properties",
    "expo-localization",
    ["expo-secure-store"],
    ["expo-font"],
    ["expo-sqlite"],

    // Plugin to setup Adobe Analytics SDK
    ["./plugins/withAdobeAnalytics"],

    // Plugin to setup Medallia SDK
    ["./plugins/withMedallia"],
  ],
});
