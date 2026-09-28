const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { getStorageBucket } = require('./firebaseAdmin');
const { buildUploadUrl } = require('./uploadUrl');
const { imageFormat } = require('./chatContent');

async function saveChatImage(req, buffer) {
  const [extension, contentType] = imageFormat(buffer);
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'give-app/chat', resource_type: 'image' }, (error, value) => error ? reject(error) : resolve(value));
      stream.end(buffer);
    });
    return { url: result.secure_url, remove: () => cloudinary.uploader.destroy(result.public_id) };
  }
  const name = `chat-${crypto.randomUUID()}.${extension}`;
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    const bucket = getStorageBucket();
    const file = bucket.file(`give-app/chat/${name}`);
    const token = crypto.randomUUID();
    await file.save(buffer, { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } });
    return {
      url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`,
      remove: () => file.delete(),
    };
  }
  const filePath = path.join(__dirname, '..', 'uploads', name);
  await fs.writeFile(filePath, buffer);
  return { url: buildUploadUrl(req, `/uploads/${name}`), remove: () => fs.unlink(filePath) };
}

module.exports = { saveChatImage };
