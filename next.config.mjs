/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle web workers
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: 'static/chunks/[id].worker.[contenthash].js',
          publicPath: '/_next/',
        },
      },
    });

    // Handle problematic modules in browser builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
      };
      
      // Explicitly ignore canvas modules
      config.module.rules.push({
        test: /node_modules\/canvas/,
        use: 'null-loader',
      });
      
      // Prevent importing native Node.js modules
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
        '../build/Release/canvas.node': false,
      };
    }

    return config;
  },
  
  // PDF.js requires these content security policy settings
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
