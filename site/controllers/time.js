/**
 * Created by qhyang on 2017/8/25.
 */

module.exports = {
    registerRoutes: function(app) {
        app.post('/time', this.getCurrentTime);
    },

    getCurrentTime: (req, res) => {
        res.json({
            code: 1,
            data: require('../services/time')().getCurrentTime()
        });
    }
};
