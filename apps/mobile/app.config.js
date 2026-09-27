const fs = process.getBuiltinModule("node:fs");
const path = process.getBuiltinModule("node:path");

/* A phone cannot reach the platform on `localhost`. BETNG_MOBILE_API_URL and BETNG_MOBILE_REALTIME_URL
   point a development build at the machine running it; unset, app.json stands as written.
   Android push needs the Firebase project's google-services.json beside this file; without it the app builds without push. */
module.exports = ({ config }) => {
  const apiUrl = process.env.BETNG_MOBILE_API_URL;
  const realtimeUrl = process.env.BETNG_MOBILE_REALTIME_URL;
  const googleServices = path.join(__dirname, "google-services.json");

  return {
    ...config,
    plugins: [...(config.plugins ?? []), "expo-notifications"],
    android: {
      ...config.android,
      ...(fs.existsSync(googleServices) ? { googleServicesFile: "./google-services.json" } : {}),
    },
    extra: {
      ...config.extra,
      ...(apiUrl === undefined || apiUrl === "" ? {} : { apiUrl }),
      ...(realtimeUrl === undefined || realtimeUrl === "" ? {} : { realtimeUrl }),
    },
  };
};
