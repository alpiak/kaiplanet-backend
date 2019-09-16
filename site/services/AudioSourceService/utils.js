const retry = async (callback, retryTimes) => {
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

module.exports = { retry };
