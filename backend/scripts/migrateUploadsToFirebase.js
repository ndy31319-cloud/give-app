const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const db = require("../db");
const { getStorageBucket } = require("../lib/firebaseAdmin");

const apply = process.argv.includes("--apply");
const uploadDir = path.join(__dirname, "..", "uploads");

const imageTargets = [
  {
    tableName: "ITEM_DONATE_IMAGE",
    idColumn: "donate_id",
  },
  {
    tableName: "ITEM_REQUEST_IMAGE",
    idColumn: "request_id",
  },
];

const getFilenameFromUrl = (imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  return String(imageUrl).split(/[\\/]/).pop();
};

const buildFirebaseDownloadUrl = (bucketName, destination, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;

const uploadToFirebase = async (bucket, filePath, filename) => {
  const token = crypto.randomUUID();
  const destination = `give-app/posts/migrated-${Date.now()}-${crypto.randomUUID()}-${filename}`;

  await bucket.upload(filePath, {
    destination,
    metadata: {
      contentType: "image/jpeg",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return buildFirebaseDownloadUrl(bucket.name, destination, token);
};

const migrateTable = async (connection, bucket, target) => {
  const [rows] = await connection.query(
    `SELECT ${target.idColumn} AS post_id, image_url
     FROM ${target.tableName}
     WHERE image_url LIKE '%/uploads/%'`,
  );

  for (const row of rows) {
    const filename = getFilenameFromUrl(row.image_url);
    const filePath = filename ? path.join(uploadDir, filename) : null;

    if (!filePath || !fs.existsSync(filePath)) {
      console.log(
        `[missing] ${target.tableName}.${target.idColumn}=${row.post_id} ${row.image_url}`,
      );
      continue;
    }

    if (!apply) {
      console.log(
        `[dry-run] ${target.tableName}.${target.idColumn}=${row.post_id} ${filename}`,
      );
      continue;
    }

    const firebaseUrl = await uploadToFirebase(bucket, filePath, filename);
    await connection.query(
      `UPDATE ${target.tableName}
       SET image_url = ?
       WHERE ${target.idColumn} = ? AND image_url = ?`,
      [firebaseUrl, row.post_id, row.image_url],
    );

    console.log(
      `[updated] ${target.tableName}.${target.idColumn}=${row.post_id} ${firebaseUrl}`,
    );
  }
};

const main = async () => {
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error("FIREBASE_STORAGE_BUCKET is required.");
  }

  const bucket = getStorageBucket();
  const connection = await db.getConnection();

  try {
    for (const target of imageTargets) {
      await migrateTable(connection, bucket, target);
    }
  } finally {
    connection.release();
    await db.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
