module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void promise` is how this codebase marks a promise it deliberately does not await
    // (fire-and-forget from event handlers); the rule would flag every one of those.
    'no-void': 'off',
    // React Navigation takes render functions as props (tabBar, screen children); those
    // are called, not mounted as component types, so they cannot remount a subtree.
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
  },
};
