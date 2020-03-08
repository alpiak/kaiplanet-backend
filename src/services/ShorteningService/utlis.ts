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

export { getConfig };
