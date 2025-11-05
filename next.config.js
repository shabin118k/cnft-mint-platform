/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // @emurgo/cardano-serialization-lib-browser用の設定
    // WebAssemblyファイルを正しく処理（クライアントサイドのみ）
    if (!isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }
    
    // サーバーサイドではCardanoライブラリを無視
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@emurgo/cardano-serialization-lib-browser': false,
      };
    }
    
    // WebAssemblyのasync/await警告を抑制
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /cardano-serialization-lib-browser/,
        message: /async\/await/,
      },
      {
        file: /cardano_serialization_lib_bg\.wasm/,
        message: /async\/await/,
      },
      // より一般的なパターンで警告を抑制
      {
        message: /The generated code contains 'async\/await'/,
      },
    ];
    
    return config;
  },
  turbopack: {
    // Turbopack用の設定
    resolveAlias: {
      '@emurgo/cardano-serialization-lib-browser': '@emurgo/cardano-serialization-lib-browser',
    },
  },
}

module.exports = nextConfig

