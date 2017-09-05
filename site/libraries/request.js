/**
 * Created by qhyang on 2017/8/24.
 */

module.exports = function (req) {
    return {
        getClientIp: function () {
            return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress || req.ip;
        }
    };
};
