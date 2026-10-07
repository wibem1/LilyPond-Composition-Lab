import assert from 'node:assert/strict';
import {compositionCosts,costLabel} from '../src/composition-costs.mjs';
assert.equal(compositionCosts(undefined),null);assert.equal(costLabel(null),'Kosten nicht erfasst');
assert.equal(costLabel({composition:.7,realisation:.01}),'$0.710000');
assert.equal(costLabel({composition:0,realisation:0}),'$0.000000');
assert.deepEqual(compositionCosts({composition:Infinity,realisation:-1}),{composition:0,realisation:0});
console.log('PASS: recorded USD costs, historical unknown costs and zero-cost imports stay distinct.');
