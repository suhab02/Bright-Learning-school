/** Accept a public Page address, never a post/share/login URL or arbitrary iframe source. */
export function facebookPageUrl(value:string|null|undefined):string|null {
  if(!value||value.length>500)return null;
  try {
    const u=new URL(value.trim());
    if(!['https:','http:'].includes(u.protocol)||!['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com'].includes(u.hostname)||u.username||u.password||u.port)return null;
    const p=u.pathname.replace(/\/+$/,'');
    if(p==='/profile.php'){const id=u.searchParams.get('id');return id&&/^\d+$/.test(id)?`https://www.facebook.com/profile.php?id=${id}`:null;}
    if(/^\/(?:p\/[^/]+-\d+|pages\/[^/]+\/\d+)$/.test(p))return `https://www.facebook.com${p}`;
    if(!/^\/[A-Za-z0-9.]+$/.test(p)||['login','groups','events','watch','marketplace','dialog','share','posts','photos','photo','reel','reels','stories','plugins','help','settings','messages','home.php'].includes(p.slice(1).toLowerCase()))return null;
    return `https://www.facebook.com${p}`;
  }catch{return null;}
}
/** Only embed a public post belonging to the configured school Page. */
export function facebookPostUrl(value:string|null|undefined,pageUrl:string|null):string|null {
  const page=facebookPageUrl(pageUrl);
  if(!page||typeof value!=='string'||value.length>500)return null;
  return value.startsWith(page+'/posts/')&&/^https:\/\/www[.]facebook[.]com\/[A-Za-z0-9.]+\/posts\/[A-Za-z0-9]+$/.test(value)?value:null;
}
export function facebookFeedUrl(pageUrl:string,width:number,height:number) {
  const page=facebookPageUrl(pageUrl);if(!page)return null;
  const q=new URLSearchParams({href:page,tabs:'timeline',width:String(Math.max(180,Math.min(500,Math.floor(width)))),height:String(Math.max(300,Math.min(650,Math.floor(height)))),small_header:'true',adapt_container_width:'true',hide_cover:'false',show_facepile:'false'});
  return `https://www.facebook.com/plugins/page.php?${q}`;
}
