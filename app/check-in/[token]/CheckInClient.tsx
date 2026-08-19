"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Space = {
  member:{name:string;role:string};
  family:{parentName:string;parentLocation:string};
  items:Array<{id:number;type:"medication"|"appointment";title:string;details:string;scheduledFor:string}>;
  serverNow:string;
  error?:string;
};

export default function CheckInClient({token}:{token:string}) {
  const [space,setSpace]=useState<Space|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<Space["items"][number]|null>(null);
  const [busy,setBusy]=useState(false);
  const [success,setSuccess]=useState("");

  useEffect(()=>{fetch(`/api/check-in/${encodeURIComponent(token)}`,{cache:"no-store"}).then(async response=>{const json=await response.json() as Space;if(!response.ok)throw new Error(json.error||"Could not open this care space");return json;}).then(json=>setSpace(json)).catch(cause=>setError(cause instanceof Error?cause.message:"Could not open this care space")).finally(()=>setLoading(false));},[token]);

  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!selected)return;const form=new FormData(event.currentTarget);setBusy(true);setError("");try{const response=await fetch(`/api/check-in/${encodeURIComponent(token)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemId:selected.id,note:form.get("note")})});const json=await response.json() as Space;if(!response.ok)throw new Error(json.error||"Could not save check-in");setSpace(json);setSuccess(`${selected.title} has been shared with the family.`);setSelected(null);}catch(cause){setError(cause instanceof Error?cause.message:"Could not save check-in");}finally{setBusy(false);}}

  if(loading)return <main className="checkin-shell"><div className="checkin-loading"><span className="brand-mark"><i/><i/><i/></span><p>Opening today’s care plan…</p></div></main>;
  if(!space)return <main className="checkin-shell"><section className="invalid-link"><span>!</span><h1>We can’t open this link</h1><p>{error||"Ask the family organiser for a new private check-in link."}</p><small>Avenkin · Care coordination only</small></section></main>;

  return <main className="checkin-shell">
    <nav className="checkin-nav"><Link className="wordmark" href="/"><span className="brand-mark"><i/><i/><i/></span><span>Avenkin</span></Link><span>Private care link</span></nav>
    <section className="checkin-wrap">
      <header className="checkin-hello"><span className="checkin-avatar">{initials(space.member.name)}</span><p className="app-kicker">HELLO, {first(space.member.name).toUpperCase()}</p><h1>What’s been taken care of?</h1><p>Tap an item to update everyone caring for <strong>{space.family.parentName}</strong>.</p></header>
      {success&&<div className="checkin-success" role="status"><span>✓</span><div><strong>Update shared</strong><p>{success}</p></div><button onClick={()=>setSuccess("")} aria-label="Dismiss">×</button></div>}
      {error&&<div className="error-banner">{error}<button onClick={()=>setError("")}>×</button></div>}
      <section className="checkin-card">
        <div className="checkin-card-heading"><div><span className="today-dot"/><p className="app-kicker">READY TO CHECK IN</p></div><strong>{space.items.length} {space.items.length===1?"item":"items"}</strong></div>
        <div className="checkin-items">
          {space.items.length===0?<div className="all-done"><span>✓</span><h2>Everything is checked in</h2><p>There are no pending care items on this link.</p></div>:space.items.map(item=>{const date=new Date(item.scheduledFor);const overdue=date.getTime()<new Date(space.serverNow).getTime();return <article key={item.id} className={overdue?"overdue":""}><time><strong>{date.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</strong><span>{date.toLocaleDateString([], {weekday:"short",day:"numeric",month:"short"})}</span></time><div className="checkin-type">{item.type==="medication"?"✣":"□"}</div><div><small>{item.type}</small><h2>{item.title}</h2><p>{item.details||"No extra details"}</p>{overdue&&<b>Due for an update</b>}</div><button onClick={()=>setSelected(item)} aria-label={`Mark ${item.title} complete`}>✓</button></article>;})}
        </div>
      </section>
      <div className="checkin-reassurance"><span>♧</span><p><strong>Your update goes straight to the shared timeline.</strong>No calls, logins, or downloads needed.</p></div>
      <p className="checkin-disclaimer">Avenkin coordinates family-entered information. It does not give medical advice or monitor emergencies.</p>
    </section>
    {selected&&<div className="modal-backdrop"><section className="confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><button className="composer-close" onClick={()=>setSelected(null)}>×</button><span className="confirm-check">✓</span><p className="app-kicker">ONE-TAP CHECK-IN</p><h2 id="confirm-title">Confirm {selected.type==="medication"?"taken":"attended"}?</h2><h3>{selected.title}</h3><form onSubmit={submit}><label>Add a quick note <span>Optional</span><textarea name="note" rows={3} placeholder={`e.g. ${space.family.parentName} seemed cheerful today`}/></label><button className="app-primary setup-submit" disabled={busy}>{busy?"Sharing update…":"Confirm and share →"}</button></form></section></div>}
  </main>;
}

function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join("").toUpperCase();}
function first(value:string){return value.trim().split(/\s+/)[0]||"there";}
