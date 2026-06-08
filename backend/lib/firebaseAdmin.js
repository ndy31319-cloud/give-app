const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

let firebaseApp;

const buildCredential = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    );

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(
        /\\n/g,
        "\n",
      );
    }

    return admin.credential.cert(serviceAccount);
  }

  const serviceAccountPath = path.join(
    __dirname,
    "..",
    "serviceAccountKey.json",
  );

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8"),
    );

    return admin.credential.cert(serviceAccount);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase configuration is missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  return admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });
};

const getFirebaseApp = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = admin.initializeApp({
    credential: buildCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  return firebaseApp;
};

const getFirestore = () => {
  try {
    return getFirebaseApp().firestore();
  } catch (error) {
    const firestoreError = new Error(
      "Firebase configuration is invalid. Replace backend/serviceAccountKey.json with a real Firebase service account JSON.",
    );
    firestoreError.code = "FIREBASE_CONFIG_INVALID";
    firestoreError.cause = error;
    throw firestoreError;
  }
};

const getStorageBucket = () => {
  try {
    return getFirebaseApp().storage().bucket();
  } catch (error) {
    const storageError = new Error(
      "Firebase Storage configuration is invalid. Set FIREBASE_STORAGE_BUCKET to your Cloud Storage bucket name.",
    );
    storageError.code = "FIREBASE_STORAGE_CONFIG_INVALID";
    storageError.cause = error;
    throw storageError;
  }
};

module.exports = {
  admin,
  getFirestore,
  getStorageBucket,
};
