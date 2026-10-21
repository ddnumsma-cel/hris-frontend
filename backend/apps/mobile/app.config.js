// Build variants (set by eas.json): the development build and internal test build get their own app id and
// name, so they can be installed next to the real app on the same phone.
//   development → "MSMA HRIS (Dev)"     com.msma.hris.dev
//   preview     → "MSMA HRIS (Preview)" com.msma.hris.preview
//   (none)      → "MSMA HRIS"           com.msma.hris
const VARIANTS = {
  development: { suffix: '.dev', name: ' (Dev)' },
  preview: { suffix: '.preview', name: ' (Preview)' },
};

module.exports = ({ config }) => {
  const variant = VARIANTS[process.env.APP_VARIANT];
  if (!variant) return config;
  return {
    ...config,
    name: `${config.name}${variant.name}`,
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}${variant.suffix}` },
    android: { ...config.android, package: `${config.android.package}${variant.suffix}` },
  };
};
