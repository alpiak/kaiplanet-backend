export default {
    periodToRefreshProxyList: 30,
    producers: {
        eightNineIp: {
            instances: (() => new Array(32).fill(null).map((el, index) => ({
                host: "www.89ip.cn",
                path: `/index_${index + 1}.html`,
                protocol: "http",
            })))(),
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
        ipHai: {
            instances: [
                {
                    host: "www.iphai.com",
                    path: "/free/ng",
                    protocol: "http",
                },
            ],
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
        kuaidaili: {
            instances: (() => new Array(32).fill(null).map((el, index) => ({
                host: "www.kuaidaili.com",
                path: `/free/inha/${index + 1}`,
                protocol: "https",
            })))(),
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
        xiciDaili: {
            instances: (() => new Array(32).fill(null).map((el, index) => ({
                host: "www.xicidaili.com",
                path: `/nn/${index + 1}`,
                protocol: "https",
            })))(),
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36",
        },
    },
    testCases: [
        {
            areas: ["CN"],
            url: "http://static-alias-1.360buyimg.com/jzt/temp/conermark/dot.png",
        },
        {
            areas: ["CN"],
            url: "https://www.baidu.com/favicon.ico",
        },
        {
            areas: ["CN"],
            url: "https://cn.bing.com/favicon.ico",
        },
    ],
};
