import type { NextConfig } from "next";

const CURRENT_VERSION = "1.0.7";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/downloads/signalbot-mac.dmg",
          destination: `/downloads/HL.Signalbot_${CURRENT_VERSION}_universal.dmg`,
        },
        {
          source: "/downloads/signalbot-windows.exe",
          destination: `/downloads/HL.Signalbot_${CURRENT_VERSION}_x64-setup.exe`,
        },
      ],
    };
  },
  async redirects() {
    return [
      {
        source: "/downloads/HL.Signalbot_:version(\\d+\\.\\d+\\.\\d+)_universal.dmg",
        destination: "/downloads/signalbot-mac.dmg",
        permanent: false,
      },
      {
        source: "/downloads/HL.Signalbot_:version(\\d+\\.\\d+\\.\\d+)_x64-setup.exe",
        destination: "/downloads/signalbot-windows.exe",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
