module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Supabase URL and anon key from .env (see .env.example). Both are public by design;
    // never put the service role key here.
    [
      './scripts/babel-plugin-inline-env',
      { names: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'UPDATE_MANIFEST_URL'] },
    ],
    // Must stay last.
    'react-native-reanimated/plugin',
  ],
};
