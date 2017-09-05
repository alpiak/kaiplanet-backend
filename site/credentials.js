/**
 * Created by qhyang on 2017/4/27.
 */

module.exports = {
    mongo: {
        bubblesoft: {
            development: {
                connectionString: 'mongodb://admin:User#123@ds129281.mlab.com:29281/bubblesoft',
            },
            production: {
                connectionString: 'mongodb://admin:User#123@ds129281.mlab.com:29281/bubblesoft',
            }
        }
    },
    authProviders: {
        baidu: {
            development: {
                appId: 'AKuPWCF1NAvjzcdg6iHa8i8E',
                appSecret: 'GDOEBvSWuRFuVHGn6rlteZVwEZexUP7B',
            }
        }
    },
    storage: {
        ali: {
            development: {
                accessKeyId: 'LTAITxy7FilZOMIQ',
                accessKeySecret: 'C5eGXEVHHeQZrXsfnazPOzxWZZV9R7'
            }
        }
    },
    cookieSecret: 'correct horse battery staple',
    darkSkyKey: '5e1c8c7eab6320aa615d40e3af1aa644'
};
