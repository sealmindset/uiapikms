import { buildApp } from "./app";
const app = buildApp();
const port = parseInt(process.env.PORT || "4000", 10);
app.listen(port, () => {
  console.log(`Admin UI listening on http://localhost:${port}`);
});
