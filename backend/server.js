require("dotenv").config();
const express = require("express"),
  cors = require("cors");
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
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
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
