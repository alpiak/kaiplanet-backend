/**
 * Created by qhyang on 2018/3/6.
 */

const { createWebAPIRequest } = require('./util/util')

module.exports = {
    getSimilarSongs(id, offset, limit) {
        const cookie = ''
        const data = {
            songid: id,
            offset: offset || 0,
            limit: limit || 50
        }

        return new Promise((resolve, reject) => {
            createWebAPIRequest(
                'music.163.com',
                '/weapi/v1/discovery/simiSong',
                'POST',
                data,
                cookie,
                music_req => {
                    resolve(music_req)
                },
                err => reject('fetch error')
            )
        });
    }
}
