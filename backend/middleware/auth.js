const { auth, db } = require("../config/firebase");
const roles = [
  "Administrador",
  "Logistica",
  "Bodega",
  "Tienda",
  "Gerencia",
  "Auditoria",
];
module.exports = async (req, res, next) => {
  const match = (req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!match)
    return res
      .status(401)
      .json({ success: false, error: "Inicie sesión para continuar." });
  try {
    const token = await auth.verifyIdToken(match[1], true);
    const profile = await db.collection("users").doc(token.uid).get();
    if (
      !profile.exists ||
      profile.data().active === false ||
      !roles.includes(profile.data().role)
    )
      return res
        .status(403)
        .json({
          success: false,
          error:
            "Usuario sin acceso asignado. Solicite la asignación al administrador.",
        });
    req.user = { ...profile.data(), uid: token.uid };
    next();
  } catch (e) {
    res
      .status(401)
      .json({ success: false, error: "Sesión inválida o vencida." });
  }
};
