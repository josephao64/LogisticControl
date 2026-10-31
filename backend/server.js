require("dotenv").config();
const express = require("express"),
  cors = require("cors"),
  path = require("path"),
  fs = require("fs");
const app = express();
app.disable("x-powered-by");
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(
  ",",
);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
  }),
);
app.use(express.json({ limit: "1mb" }));
const { auth, db } = require("./config/firebase");
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/public-users", async (req, res, next) => {
  try {
    const [snap, branchSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("sucursales").get(),
    ]);
    const branchMap = Object.fromEntries(
      branchSnap.docs.map((b) => [b.id, b.data()?.nombre || b.id]),
    );
    const list = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (data.active === false) continue;
      let email = data.email;
      let name = data.name || data.nombre;
      if (!email && name && name.includes("@")) email = name;
      if (!email && auth && auth.getUser) {
        try {
          const u = await auth.getUser(d.id);
          email = u?.email;
          if (!name) name = u?.displayName || email;
        } catch { }
      }
      if (email) {
        const assignedBranches = (data.branchIds || [])
          .map((bid) => branchMap[bid])
          .filter(Boolean);
        list.push({
          id: d.id,
          name: name || email,
          username: data.username || "",
          email: email.toLowerCase(),
          role: data.role || "Usuario",
          branchesLabel:
            data.role === "Tienda" && assignedBranches.length
              ? assignedBranches.join(", ")
              : "",
        });
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    res.json({ success: true, users: list });
  } catch (err) {
    next(err);
  }
});
app.use("/api", require("./middleware/auth"));
app.use("/api/operacion", require("./routes/operationRoutes"));
app.use("/api/catalogos", require("./routes/catalogRoutes"));
// Legacy writes are deliberately unavailable: all operational writes use validated commands.
app.use("/api", (req, res) =>
  res
    .status(404)
    .json({
      success: false,
      error: "Ruta no disponible. Utilice el flujo operativo actualizado.",
    }),
);
const frontendDist = path.resolve(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}
app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res
    .status(status)
    .json({
      success: false,
      error:
        status >= 500
          ? "No se pudo completar la operación. Intente nuevamente."
          : error.message,
    });
});
if (require.main === module)
  app.listen(process.env.PORT || 3000, () =>
    console.log("Logistic Control API iniciada."),
  );
module.exports = app;
