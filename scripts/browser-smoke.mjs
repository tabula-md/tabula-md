import { runBrowserSmoke } from "./browser-smoke/support/runtime.mjs";
import { suites } from "./browser-smoke/suites/index.mjs";

await runBrowserSmoke(suites);
