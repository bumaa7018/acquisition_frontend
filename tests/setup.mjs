// Тестийн бэлтгэл — src/-ийн TypeScript import-уудыг resolve хийх hook-ийг залгана.
import { register } from "node:module";

register("./resolve-project-modules.mjs", import.meta.url);
