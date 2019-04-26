/**
 * Created by qhyang on 2017/9/6.
 */

const crypto = require('crypto'),
    fs = require('fs'),
    OSS = require('ali-oss'),
    co = require('co');

const client = new OSS({
    accessKeyId: require('../credentials').storage.ali.development.accessKeyId,
    accessKeySecret: require('../credentials').storage.ali.development.accessKeySecret,
    region: 'oss-ap-southeast-1',
    bucket: 'bubblesoft',
});


module.exports = function () {
    return {
        uploadFilesToAliyun: function (files, hashMethod, unique) {
            return co(function* () {
                let results = {};

                for (let file in files) {
                    if (files.hasOwnProperty(file)) {
                        if (unique == true) {
                            let hash = yield new Promise((resolve, reject) => {
                                try {
                                    const hash = crypto.createHash(hashMethod),
                                        input = fs.createReadStream(files[file].path || files[file].buffer);

                                    input.on('readable', () => {
                                        const data = input.read();

                                        if (data) {
                                            hash.update(data);
                                        } else {
                                            resolve(hash.digest('hex'));
                                        }
                                    });
                                } catch (err) {
                                    reject(err);
                                }
                            });

                            results[file] = yield client.put(hash + '_' + files[file].name, files[file].path || files[file].buffer);
                        } else {
                            results[file] = yield client.put(files[file].name, files[file].path || files[file].buffer);
                        }
                    }
                }

                return results;
            });
        }
    };
};
