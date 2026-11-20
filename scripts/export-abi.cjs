// Writes lib/chain/abi.ts from the Foundry build output.
const a = require("../contracts/out/CostShieldVault.sol/CostShieldVault.json");
require("fs").writeFileSync("lib/chain/abi.ts", "// Generated from contracts/out by `npm run abi`. Do not edit by hand.\nexport const vaultAbi = " + JSON.stringify(a.abi) + " as const;\n\nexport const vaultBytecode = \"" + a.bytecode.object + "\" as `0x${string}`;\n");
