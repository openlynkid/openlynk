// @ts-check
import { module } from "@prisma/composer";
import openlynkService from "./service.mjs";

export default module("openlynk", ({ provision }) => {
  provision(openlynkService);
});
