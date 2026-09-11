const admin = require("firebase-admin");
// Production never falls back to a local file. Tests inject an isolated repository.
if (!admin.apps.length) {
  if (
    process.env.FIRESTORE_EMULATOR_HOST &&
    process.env.NODE_ENV !== "production"
  ) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || "demo-logistic-control",
    });
  } else {
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT
      ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      : admin.credential.applicationDefault();
    admin.initializeApp({ credential });
  }
}
module.exports = { admin, db: admin.firestore(), auth: admin.auth() };
