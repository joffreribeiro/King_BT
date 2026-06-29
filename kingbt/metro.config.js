const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Resolve módulos Node.js do Firebase para suas versões web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Bloqueia módulos Node-only que não funcionam no browser
    if (
      moduleName === '@grpc/grpc-js' ||
      moduleName === '@grpc/proto-loader' ||
      moduleName === 'firebase-admin'
    ) {
      return { type: 'empty' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
