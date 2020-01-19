import developmentConfig from "./config/development";
import productionConfig from "./config/production";

const getConfig = () => {
    const env = process.env.NODE_ENV;

    switch (env) {
        case "production":
            return productionConfig;
        case "development":
        default:
            return developmentConfig;
    }
};

const retry = async <T> (callback: () => T, retryTimes: number) => {
    if (retryTimes <= 0) {
        throw new Error("Invalid retry times provided.");
    }

    let err;
    let i = 0;

    while (i++ < retryTimes) {
        try {
            return await callback();
        } catch (e) {
            err = e;
        }

    }

    throw err;
};

export { getConfig, retry };
