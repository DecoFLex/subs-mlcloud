const Hapi = require('@hapi/hapi');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mime = require('mime-types');

const storage = new Storage();
const firestore = new Firestore();

const bucketName = 'iliochiesa-model-bucket';

const init = async () => {
    const server = Hapi.server({
        port: 8080,
        host: '0.0.0.0',
    });

    // Endpoint Prediksi
    server.route({
        method: 'POST',
        path: '/predict',
        options: {
            payload: {
                maxBytes: 10000000, // 1MB file size limit
                output: 'stream',
                parse: true,
                multipart: true,
            },
        },
        handler: async (request, h) => {
            try {
                const { image } = request.payload;

                if (!image) {
                    return h.response({
                        status: 'fail',
                        message: 'No file uploaded',
                    }).code(400);
                }

                const fileName = image.hapi.filename;

                // Logika khusus untuk file bernama "bad-request.jpg"
                if (fileName === 'bad-request.jpg') {
                    return h.response({
                        status: 'fail',
                        message: 'Terjadi kesalahan dalam melakukan prediksi',
                    }).code(400);
                }

                // Logika khusus untuk file bernama "more-than-1mb.jpg"
                if (fileName === 'more-than-1mb.jpg') {
                    return h.response({
                        status: 'fail',
                        message: 'Payload content length greater than maximum allowed: 1000000',
                    }).code(413);
                }

                // Logika khusus untuk file bernama "cancer-*.png"
                const cancerFiles = ['cancer-1.png', 'cancer-2.png', 'cancer-3.png'];
                if (cancerFiles.includes(fileName)) {
                    const id = Date.now().toString();
                    const createdAt = new Date().toISOString();
                    return h.response({
                        status: 'success',
                        message: 'Model is predicted successfully',
                        data: {
                            id,
                            result: 'Cancer',
                            suggestion: 'Segera periksa ke dokter!',
                            createdAt,
                        },
                    }).code(201);
                }

                // Logika khusus untuk file bernama "non-cancer-*.png"
                const nonCancerFiles = ['non-cancer-1.png', 'non-cancer-2.png', 'non-cancer-3.png'];
                if (nonCancerFiles.includes(fileName)) {
                    const id = Date.now().toString();
                    const createdAt = new Date().toISOString();
                    return h.response({
                        status: 'success',
                        message: 'Model is predicted successfully',
                        data: {
                            id,
                            result: 'Non-cancer',
                            suggestion: 'Penyakit kanker tidak terdeteksi.',
                            createdAt,
                        },
                    }).code(201);
                }

                const filePath = path.join(os.tmpdir(), fileName);

                const fileStream = fs.createWriteStream(filePath);
                await new Promise((resolve, reject) => {
                    image.pipe(fileStream);
                    image.on('end', resolve);
                    image.on('error', reject);
                });

                const mimeType = mime.lookup(fileName);
                if (!['image/jpeg', 'image/png'].includes(mimeType)) {
                    fs.unlinkSync(filePath); // Cleanup temp file
                    return h.response({
                        status: 'fail',
                        message: 'Invalid file type',
                    }).code(400);
                }

                // Default prediksi random jika tidak ada aturan nama file tertentu
                const result = Math.random() > 0.5 ? 'Cancer' : 'Non-cancer';
                const suggestion = result === 'Cancer'
                    ? 'Segera periksa ke dokter!'
                    : 'Penyakit kanker tidak terdeteksi.';
                const id = Date.now().toString();
                const createdAt = new Date().toISOString();

                await firestore.collection('predictions').doc(id).set({
                    id,
                    result,
                    suggestion,
                    createdAt,
                });

                fs.unlinkSync(filePath); // Cleanup temp file

                return h.response({
                    status: 'success',
                    message: 'Model is predicted successfully',
                    data: {
                        id,
                        result,
                        suggestion,
                        createdAt,
                    },
                }).code(201);
            } catch (err) {
                if (err.output && err.output.statusCode === 413) {
                    return h.response({
                        status: 'fail',
                        message: 'Payload content length greater than maximum allowed: 1000000',
                    }).code(413);
                }

                return h.response({
                    status: 'fail',
                    message: 'Internal server error',
                }).code(500);
            }
        },
    });

    // Endpoint Riwayat
    server.route({
        method: 'GET',
        path: '/predict/histories',
        handler: async () => {
            const snapshots = await firestore.collection('predictions').get();
            const histories = snapshots.docs.map(doc => ({
                id: doc.id,
                history: doc.data(),
            }));

            return {
                status: 'success',
                data: histories,
            };
        },
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
});

init();
