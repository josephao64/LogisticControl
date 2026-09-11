// One-time provisioning, executed by the project owner with server credentials.
require("dotenv").config();
const { auth, db } = require("../config/firebase");
async function main() {
  const uid = process.argv[2];
  if (!uid) throw Error("Uso: node scripts/bootstrap-admin.js UID_DE_FIREBASE");
  const user = await auth.getUser(uid);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(
      db.collection("users").where("role", "==", "Administrador"),
    );
    if (!existing.empty)
      throw Error(
        "Ya existe un administrador. Asigne los permisos desde la aplicación.",
      );
    tx.create(db.collection("users").doc(uid), {
      role: "Administrador",
      name: user.displayName || user.email,
      companyIds: [],
      branchIds: [],
      active: true,
    });
    tx.create(db.collection("auditEvents").doc(), {
      action: "INICIALIZAR_ADMINISTRADOR",
      entityType: "users",
      entityId: uid,
      actorId: uid,
      at: new Date().toISOString(),
    });
  });
  console.log("Administrador inicial configurado.");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
