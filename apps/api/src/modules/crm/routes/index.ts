/**
 * CRM Routes Index
 *
 * Combines all CRM sub-routes into a single router.
 * Mounts sub-routers at their respective paths.
 *
 * @module modules/crm/routes
 */

import { createProtectedRouter } from "../../../lib/protected-router";

import { clientsRouter } from "./clients";
import { fieldsRouter } from "./fields";
import { pipelinesRouter } from "./pipelines";
import { stagesRouter } from "./stages";

const crm = createProtectedRouter({
  defaultPermission: { resource: "crmClient", action: "read" },
});

// Mount sub-routers
crm.route("/pipelines", pipelinesRouter);
crm.route("/stages", stagesRouter);
crm.route("/fields", fieldsRouter);
crm.route("/clients", clientsRouter);

export { crm };
