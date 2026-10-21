// Guard: this is the monorepo root, not the Expo app. Running `expo start` here makes Expo look
// for a missing App.js ("Unable to resolve ../../App from node_modules/expo/AppEntry.js").
module.exports = () => {
  throw new Error(
    '\n\nThis is the MSMA HRIS monorepo root, not the mobile app.\n' +
      'Start the app with:  pnpm mobile   (or: cd apps\\mobile  then  npx expo start)\n',
  );
};
