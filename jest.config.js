module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@solana/.*|@wallet-ui/.*|@rn-primitives/.*)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^test-renderer$': '<rootDir>/test-renderer-shim.js',
    '^@expo/vector-icons$': '<rootDir>/jest/__mocks__/@expo/vector-icons',
    '^@expo/vector-icons/(.*)$': '<rootDir>/jest/__mocks__/@expo/vector-icons',
  },
  resetMocks: false,
  clearMocks: false,
  restoreMocks: false,
}