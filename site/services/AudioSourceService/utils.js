const retry = async (callback, retryTimes) => {
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
