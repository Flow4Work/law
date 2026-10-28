export function reorderItems<T extends {id:string}>(items:T[],id:string,targetId:string):T[]{
 const from=items.findIndex(x=>x.id===id),to=items.findIndex(x=>x.id===targetId);
 if(from<0||to<0||from===to)return items;
 const next=[...items];const [moving]=next.splice(from,1);next.splice(to,0,moving);return next;
}
