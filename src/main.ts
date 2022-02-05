import { startServer } from "./server";
import { connect } from "./config/typeorm";
import { environment } from "./config/environment";
import { sendAlerts, sendReport } from "./services/admin.service";

async function main() {
  connect();
  const app = await startServer();
  app.listen(environment.PORT);
  console.log("App running on port", environment.PORT);
}

//   // ************** Tareas agendadas ****************
const cron = require("node-cron");

//reporte para administración
const administrationTask = cron.schedule("0 0 * * Monday", async function () {
  const result = await sendReport();
  console.log("Report sent");
});
administrationTask.start();

//reporte para usuarios
const expiredRentAlert = cron.schedule("0 10 * * Monday", async function () {
  console.log(
    "!---- Alertas de alquileres vencidos : Todos los Lunes a las 00:10 horas"
  );
  const result = await sendAlerts();
  console.log("Alerts sent");
});
expiredRentAlert.start();

main();
