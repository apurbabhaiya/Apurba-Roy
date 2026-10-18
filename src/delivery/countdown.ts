export function countdownParts(expiresAt:string|null|undefined,now:number){
 const end=expiresAt?new Date(expiresAt).getTime():NaN;
 const total=Number.isFinite(end)?Math.max(0,Math.ceil((end-now)/1000)):0;
 return [Math.floor(total/86400),Math.floor(total%86400/3600),Math.floor(total%3600/60),total%60];
}
