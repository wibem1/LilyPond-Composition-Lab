// Unknown historical costs stay unknown rather than inheriting another piece's cost.
export function compositionCosts(value){
 if(!value||typeof value!=='object')return null;
 const read=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:0;};
 return {composition:read(value.composition),realisation:read(value.realisation)};
}
export function costLabel(value){
 const costs=compositionCosts(value);
 return costs?'$'+(costs.composition+costs.realisation).toFixed(6):'Kosten nicht erfasst';
}
