// Dump the website's preset parameter payloads exactly as the browser sends
// them to /api/compute (PRESET_BASELINES -> convertParametersToAPIFormat).
// Run: node --experimental-strip-types bugs/harness/dump_presets.mts > bugs/harness/presets.json
import { PRESET_BASELINES } from '../../constants/parameters.ts';
import { convertParametersToAPIFormat } from '../../utils/monteCarlo.ts';

const ids = ['daniel-08-16-26', 'eli-08-16-26', 'brendan-08-16-26'];
const out: Record<string, unknown> = {};
for (const id of ids) out[id] = convertParametersToAPIFormat({ ...(PRESET_BASELINES as any)[id] });
console.log(JSON.stringify(out, null, 1));
