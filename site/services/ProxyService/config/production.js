module.exports = {
    periodToRefreshProxyList: 30,
    producers: {
        ipHai: {
            instances: [
                {
                    host: "www.iphai.com",
                    protocol: "http",
                    path: "/free/ng"
                },
            ],
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
        xiciDaili: {
            instances: (() => new Array(32).fill(null).map((el, index) => ({
                host: "www.xicidaili.com",
                protocol: "https",
                path: `/nn/${index + 1}`
            })))(),
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
        kuaidaili: {
            instances: (() => new Array(32).fill(null).map((el, index) => ({
                host: "www.kuaidaili.com",
                protocol: "https",
                path: `/free/inha/${index + 1}`
            })))(),
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
        eightNineIp: {
            instances: (() => new Array(32).fill(null).map((el, index) => ({
                host: "www.89ip.cn",
                protocol: "http",
                path: `/index_${index + 1}.html`
            })))(),
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
    },
    testCases: [
        {
            url: "http://static-alias-1.360buyimg.com/jzt/temp/conermark/dot.png",
            areas: ["CN"],
        },
    ],
};
