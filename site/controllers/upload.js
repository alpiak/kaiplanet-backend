/**
 * Created by qhyang on 2017/9/4.
 */

const formidable = require('formidable');

module.exports = {
    registerRoutes: function(app) {
        app.post('/upload/files', this.uploadFiles);
        app.post('/upload/base64', this.uploadBase64Encoded);
    },

    uploadFiles: (req, res) => {
        const form = new formidable.IncomingForm();

        form.parse(req, (err, fields, files) => {
            if (err) {
                return res.json({
                    code: -1,
                    message: 'Upload Failed - ' + err.message
                });
            }

            if (fields.unique === undefined) {
                fields.unique = true;
            }

            require('../services/file')().uploadFilesToAliyun(files, 'md5', fields.unique).then(results => {
                res.send({
                    code: 1,
                    data: results
                });
            }, err => {
                res.send({
                    code: -1,
                    message: 'Upload Failed - ' + err.message
                });
            });
        });
    },
    uploadBase64Encoded: (req, res) => {
        const fileData = Buffer.from(req.body.data.replace(/ /g, '+'), 'base64');

        if (req.body.unique === undefined) {
            req.body.unique = true;
        }

        require('../services/file')().uploadFilesToAliyun({
            img: {
                buffer: fileData,
                name: req.body.unique ? '' : (req.user.userId + '_') + req.body.name
            }
        }, 'md5', req.body.unique).then(results => {
            res.send({
                code: 1,
                data: results
            });
        }, err => {
            res.send({
                code: -1,
                message: 'Upload Failed - ' + err.message
            });
        });
    }
};
