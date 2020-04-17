export default {
    assetBaseUrl: "http://kaiplanet.net",
    caching: {
        coolDownTime: 10000,
        expiresAfter: 1000 * 60 * 60 * 24 * 30,
        queueMaxSize: 128,
        timeout: 10000,
        transmissionRate: 32 * 1024,
    },
    producers: {
        hearthis: {
            instances: [
                {
                    host: "api-v2.hearthis.at",
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
                    host: "localhost",
                    port: 3003,
                    protocol: "http",
                },
            ],
        },
        miguMusicApi: {
            instances: [
                {
                    host: "localhost",
                    port: 3004,
                    protocol: "http",
                },
            ],
        },
        musicInterface: {
            instances: [
                {
                    host: "localhost",
                    port: 3002,
                    protocol: "http",
                },
                {
                    host: "music.niubishanshan.top",
                },
            ],
        },
        naverAPIs: {
            instances: [{
                host: "apis.naver.com",
            }],
        },
        naverMusic: {
            instances: [{
                host: "music.naver.com",
            }],
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
        naverMusicMobile: {
            instances: [{
                host: "m.music.naver.com",
            }],
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1",
        },
        neteaseCloudMusicApi: {
            instances: [
                {
                    host: "localhost",
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
