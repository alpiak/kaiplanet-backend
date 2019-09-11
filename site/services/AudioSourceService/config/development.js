module.exports = {
    producers: {
        musicInterface: {
            instances: [
                {
                    host: "music.niubishanshan.top",
                    protocol: "https",
                }
            ]
        },
        neteaseCloudMusicApi: {
            instances: [
                {
                    host: "localhost",
                    port: 3000,
                    protocol: "http",
                }
            ]
        },
        nodeSoundCloud: {
            clientId: "4bfb6af6b3fc1982ae613dbcb6f0d1d5",
        },
        hearthis: {
            instances: [
                {
                    host: "api-v2.hearthis.at",
                    protocol: "https",
                }
            ]
        },
        kugouMusicApi: {
            instances: [
                {
                    host: "localhost",
                    port: 3001,
                    protocol: "http"
                }
            ]
        },
    }
};
