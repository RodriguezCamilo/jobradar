import { synchronize } from "../src/lib/sync";
import { database } from "../src/lib/database";
try {
  console.log(JSON.stringify(await synchronize(["getonbrd"]), null, 2));
} finally {
  await database().end();
}
