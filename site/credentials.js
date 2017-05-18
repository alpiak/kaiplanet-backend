/**
 * Created by qhyang on 2017/4/27.
 */

module.exports = {
    darkSkyKey: "5e1c8c7eab6320aa615d40e3af1aa644",
    mongo: {
        bubblesoft: {
            development: {
                connectionString: 'mongodb://admin:User@123@ds129281.mlab.com:29281/bubblesoft',
            },
            production: {
                connectionString: 'mongodb://admin:User@123@ds129281.mlab.com:29281/bubblesoft',
            }
        }
    },
    authProviders: {
        baidu: {
            development: {
                appId: '0F1NaaZ5RQQaRd1cx7jyRBrX',
                appSecret: 'BvRFZ0ciVp3NDVwo98mSGIGn5CpO6c4G',
            }
        }
    }
};