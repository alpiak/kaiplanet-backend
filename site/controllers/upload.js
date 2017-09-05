/**
 * Created by qhyang on 2017/9/4.
 */

const crypto = require('crypto'),
    fs = require('fs'),
    thunkify = require('thunkify'),
    formidable = require('formidable'),
    OSS = require('ali-oss'),
    co = require('co');

module.exports = {
    registerRoutes: function(app) {
        app.post('/upload', this.uploadFiles);
    },

    uploadFiles: (req, res) => {
        const form = new formidable.IncomingForm();

        form.parse(req, (err, fields, files) => {
            if (err) {
                res.json({
                    code: -1,
                    message: 'Upload Failed - ' + err.message
                });
            }

            const client = new OSS({
                accessKeyId: require('../credentials').storage.ali.development.accessKeyId,
                accessKeySecret: require('../credentials').storage.ali.development.accessKeySecret,
                region: 'oss-ap-southeast-1',
                bucket: 'bubblesoft',
            });

            co(function* () {
                let results = {};

                for (let file in files) {
                    if (files.hasOwnProperty(file)) {
                        if (fields.unique == true) {
                            let hash = yield new Promise((resolve, reject) => {
                                try {
                                    const hash = crypto.createHash('md5'),
                                        input = fs.createReadStream(files[file].path);

                                    input.on('readable', () => {
                                        const data = input.read();

                                        if (data)
                                            hash.update(data);
                                        else {
                                            resolve(hash.digest('hex'));
                                        }
                                    });
                                } catch (err) {
                                    reject(err);
                                }
                            });

                            results[file] = yield client.put(hash + '_' + files[file].name, files[file].path);
                        } else {
                            results[file] = yield client.put(files[file].name, files[file].path);
                        }
                    }
                }
                res.send({
                    code: 1,
                    data: results
                });
            }).catch(err => {
                res.send({
                    code: -1,
                    message: 'Upload Failed - ' + err.message
                });
            });
        });
    }
};
