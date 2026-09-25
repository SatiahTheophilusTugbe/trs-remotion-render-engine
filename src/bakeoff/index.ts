// Bake-off entry point (prototype). NOT the production entry (src/index.ts) and never deployed.
// Render: npx remotion render src/bakeoff/index.ts <CompositionId> out/<name>.mp4 --props=out/bakeoff-props.json
import { registerRoot } from 'remotion';
import { BakeoffRoot } from './Root';

registerRoot(BakeoffRoot);
