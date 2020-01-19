module.exports = {
    producers: {
        neteaseCloudMusicApi: {
            instances: [
                {
                    host: "kaiplanet.net",
                    port: 3001,
                    protocol: "http",
                },
            ],
        },
        musicInterface: {
            instances: [
                {
                    host: "kaiplanet.net",
                    port: 3002,
                    protocol: "http",
                },
                {
                    host: "music.niubishanshan.top",
                    protocol: "https",
                },
            ],
        },
        nodeSoundCloud: {
            clientId: "4bfb6af6b3fc1982ae613dbcb6f0d1d5",
        },
        hearthis: {
            instances: [
                {
                    host: "api-v2.hearthis.at",
                    protocol: "https",
                },
            ],
        },
        kugouMusicApi: {
            instances: [
                {
                    host: "kaiplanet.net",
                    port: 3003,
                    protocol: "http",
                },
            ],
        },
        kuGouMobile: {
            instances: [
                {
                    host: "m.kugou.com",
                    protocol: "http",
                },
            ],
        },
        kuGouMobileCDN: {
            instances: [
                {
                    host: "mobilecdn.kugou.com",
                    protocol: "http",
                },
            ],
        },
        miguMusicApi: {
            instances: [
                {
                    host: "kaiplanet.net",
                    port: 3004,
                    protocol: "http",
                }
            ]
        },
    },
    assetBaseUrl: "http://kaiplanet.net",
    caching: {
        queueMaxSize: 128,
        transmissionRate: 32 * 1024,
        coolDownTime: 10000,
        timeout: 1000 * 60 * 2,
        expiresAfter: 1000 * 60 * 60 * 24 * 30,
    },
};
