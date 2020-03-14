export default {
    assetBaseUrl: "http://kaiplanet.net",
    caching: {
        coolDownTime: 10000,
        expiresAfter: 1000 * 60 * 60 * 24 * 30,
        queueMaxSize: 128,
        timeout: 1000 * 60 * 2,
        transmissionRate: 32 * 1024,
    },
    producers: {
        hearthis: {
            instances: [
                {
                    host: "api-v2.hearthis.at",
                    protocol: "https",
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
        kugouMusicApi: {
            instances: [
                {
                    host: "kaiplanet.net",
                    port: 3003,
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
        neteaseCloudMusicApi: {
            instances: [
                {
                    host: "kaiplanet.net",
                    port: 3001,
                    protocol: "http",
                },
            ],
        },
        nodeSoundCloud: {
            clientId: "4bfb6af6b3fc1982ae613dbcb6f0d1d5",
        },
        ufoNetwork: {
            instances: [{
                host: "cast.uforadio.com.tw",
                port: 8000,
                protocol: "http",
            }],
        },
    },
};
