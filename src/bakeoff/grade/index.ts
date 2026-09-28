// Grade bake-off entry point (prototype). NOT the production entry (src/index.ts) and never deployed.
// Render: npx remotion render src/bakeoff/grade/index.ts <CompositionId> out/<name> --props=out/grade-props.json
import { registerRoot } from 'remotion';
import { GradeRoot } from './Root';

registerRoot(GradeRoot);
