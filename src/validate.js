const allowed=['pending','accepted','preparing','ready_for_pickup','driver_assigned','picked_up','out_for_delivery','delivered','cancelled'];
function cleanText(v,max=500){return String(v??'').trim().slice(0,max)}
function positive(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
module.exports={allowed,cleanText,positive};