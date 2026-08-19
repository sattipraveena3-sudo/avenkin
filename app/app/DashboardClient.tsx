"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type Family = { id:number; parentName:string; parentLocation:string; timezone:string; alertWindowMinutes:number; notificationEmail:string; emailAlertsEnabled:boolean };
type Member = { id:number; name:string; role:string; accessToken:string };
type CareItem = { id:number; type:"medication"|"appointment"; title:string; details:string; scheduledFor:string; status:"pending"|"completed"|"missed"; completedBy:string|null; note:string };
type Entry = { id:number; kind:string; actor:string; message:string; note:string; createdAt:string };
type Delivery = { id:number; channel:"email"|"sms"; recipient:string; status:"queued"|"sent"|"failed"; errorMessage:string|null; sentAt:string|null; createdAt:string };
type AlertCapabilities = { emailConfigured:boolean; scheduledRunnerConfigured:boolean };
type DashboardData = { family:Family|null; members:Member[]; items:CareItem[]; timeline:Entry[]; notifications?:Delivery[]; alertCapabilities?:AlertCapabilities; error?:string };
type Props = { user:{ name:string; email:string }; signOutHref:string };

const blank:DashboardData = { family:null, members:[], items:[], timeline:[] };

export default function DashboardClient({ user, signOutHref }:Props) {
  const [data,setData] = useState<DashboardData>(blank);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [tab,setTab] = useState<"today"|"timeline"|"family"|"alerts">("today");
  const [composer,setComposer] = useState<"medication"|"appointment"|"member"|null>(null);
  const [toast,setToast] = useState("");
  const [browserAlerts,setBrowserAlerts] = useState<"off"|"enabled"|"blocked"|"unsupported">("off");
  const notifiedMissed = useRef<Set<number>>(new Set());

  useEffect(()=>{
    fetch("/api/dashboard",{ cache:"no-store" })
      .then(async response => {
        const json = await response.json() as DashboardData;
        if (!response.ok) throw new Error(json.error || "Could not load your family space");
        return json;
      })
      .then(json => {
        setData(json);
        notifiedMissed.current = new Set(json.items.filter(item=>item.status==="missed").map(item=>item.id));
        if (!("Notification" in window)) setBrowserAlerts("unsupported");
        else if (Notification.permission === "denied") setBrowserAlerts("blocked");
        else if (Notification.permission === "granted" && localStorage.getItem("avenkin-browser-alerts") === "enabled") setBrowserAlerts("enabled");
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Could not load your family space"))
      .finally(() => setLoading(false));
  },[]);

  useEffect(()=>{
    const timer = window.setInterval(()=>{
      fetch("/api/dashboard",{ cache:"no-store" })
        .then(async response => {
          const json = await response.json() as DashboardData;
          if (!response.ok) throw new Error(json.error || "Alert check failed");
          return json;
        })
        .then(json => {
          const newMissed = json.items.filter(item=>item.status==="missed" && !notifiedMissed.current.has(item.id));
          if (localStorage.getItem("avenkin-browser-alerts") === "enabled" && "Notification" in window && Notification.permission === "granted") {
            for (const item of newMissed) new Notification(`Avenkin: ${item.title} needs attention`, { body:"A scheduled care check-in is overdue. Open Avenkin for details.", tag:`avenkin-${item.id}` });
          }
          for (const item of newMissed) notifiedMissed.current.add(item.id);
          setData(json);
        })
        .catch(()=>undefined);
    },60_000);
    return ()=>window.clearInterval(timer);
  },[]);

  async function send(payload:Record<string,unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/dashboard",{ method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload) });
      const json = await response.json() as DashboardData;
      if (!response.ok) throw new Error(json.error || "Could not save that change");
      setData(json); setComposer(null); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save that change"); return false; }
    finally { setBusy(false); }
  }

  if (loading) return <div className="app-loading"><span className="brand-mark"><i/><i/><i/></span><p>Preparing your family space…</p></div>;
  if (!data.family) return <Setup userName={user.name} busy={busy} error={error} onSubmit={send} signOutHref={signOutHref}/>;

  const family = data.family;
  const todayKey = localDay(new Date());
  const todayItems = data.items.filter(item => localDay(new Date(item.scheduledFor)) === todayKey);
  const upcoming = data.items.filter(item => localDay(new Date(item.scheduledFor)) > todayKey && item.status === "pending").slice(0,4);
  const completed = todayItems.filter(item=>item.status==="completed").length;
  const missed = data.items.filter(item=>item.status==="missed").length;

  async function copyLink(member:Member) {
    const url = `${window.location.origin}/check-in/${member.accessToken}`;
    try { await navigator.clipboard.writeText(url); setToast(`${member.name}’s private link copied`); }
    catch { window.prompt("Copy this private check-in link",url); }
    window.setTimeout(()=>setToast(""),2200);
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) { setBrowserAlerts("unsupported"); return; }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem("avenkin-browser-alerts","enabled");
      setBrowserAlerts("enabled");
      new Notification("Avenkin alerts are on", { body:"This device will notify you when a care check-in becomes overdue while Avenkin is open.", tag:"avenkin-enabled" });
      setToast("Browser alerts enabled on this device");
      window.setTimeout(()=>setToast(""),2200);
    } else setBrowserAlerts(permission === "denied" ? "blocked" : "off");
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <Link className="wordmark app-wordmark" href="/"><span className="brand-mark light"><i/><i/><i/></span><span>Avenkin</span></Link>
        <div className="family-switch"><span>{initials(family.parentName)}</span><div><small>CARE SPACE</small><strong>{family.parentName}</strong></div><b>⌄</b></div>
        <nav aria-label="Care space">
          <button className={tab==="today"?"active":""} onClick={()=>setTab("today")}><i>⌂</i><span>Today</span>{todayItems.some(i=>i.status==="pending")&&<b>{todayItems.filter(i=>i.status==="pending").length}</b>}</button>
          <button className={tab==="timeline"?"active":""} onClick={()=>setTab("timeline")}><i>◷</i><span>Timeline</span></button>
          <button className={tab==="alerts"?"active":""} onClick={()=>setTab("alerts")}><i>♢</i><span>Alerts</span>{missed>0&&<b>{missed}</b>}</button>
          <button className={tab==="family"?"active":""} onClick={()=>setTab("family")}><i>♧</i><span>Family & caregivers</span></button>
        </nav>
        <div className="sidebar-help"><span>♡</span><strong>Need help?</strong><p>Avenkin coordinates care. For urgent concerns, contact local emergency services.</p></div>
        <a className="sidebar-user" href={signOutHref}><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><b>↗</b></a>
      </aside>

      <section className="app-main">
        <header className="app-header">
          <div><span className="app-kicker">{longDate()}</span><h1>{tab==="today"?`Good ${dayPart()}, ${firstName(user.name)}`:tab==="timeline"?"Shared timeline":tab==="alerts"?"Alert centre":"Your care circle"}</h1></div>
          <div className="header-actions"><button className="icon-button" aria-label="Open alerts" onClick={()=>setTab("alerts")}>♢{missed>0&&<i/>}</button><button className="app-primary" onClick={()=>setComposer("medication")}>＋ Add care item</button></div>
        </header>
        {error&&<div className="error-banner" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}

        {tab==="today"&&<>
          <section className={`care-status ${missed>0?"attention":""}`}>
            <span className="care-status-icon">{missed>0?"!":"✓"}</span>
            <div><h2>{missed>0?`${missed} check-in${missed===1?"":"s"} need attention`:`${family.parentName} is on track`}</h2><p>{missed>0?"Open the timeline for details and contact your care circle if needed.":completed?`${completed} of ${todayItems.length} care items confirmed today.`:"Today’s care plan is ready."}</p></div>
            <div className="status-metric"><small>TODAY</small><strong>{completed}<span>/{todayItems.length}</span></strong><b>confirmed</b></div>
            <div className="status-metric"><small>ALERT WINDOW</small><strong>{family.alertWindowMinutes}<span> min</span></strong><b>after due time</b></div>
          </section>

          <div className="dashboard-grid">
            <section className="schedule-panel">
              <div className="panel-heading"><div><h2>Today’s care</h2><p>{todayItems.length?"The shared plan everyone can see.":"A quiet day so far."}</p></div><div className="segmented"><button className="active">Day</button><button>Week</button></div></div>
              <div className="full-care-list">
                {todayItems.length===0&&<EmptyState onAdd={()=>setComposer("medication")}/>} 
                {todayItems.map((item,index)=><CareRow key={item.id} item={item} last={index===todayItems.length-1} busy={busy} onComplete={()=>send({action:"completeItem",itemId:item.id})}/>)}
              </div>
              <button className="add-quiet" onClick={()=>setComposer("medication")}>＋ Add medication or appointment</button>
            </section>

            <aside className="timeline-panel">
              <div className="panel-heading"><div><h2>Latest updates</h2><p>One timeline, no chasing.</p></div><button onClick={()=>setTab("timeline")}>View all →</button></div>
              <Timeline entries={data.timeline.slice(0,5)}/>
            </aside>
          </div>

          {upcoming.length>0&&<section className="upcoming-section"><div className="panel-heading"><div><h2>Coming up</h2><p>A little visibility for the days ahead.</p></div></div><div className="upcoming-grid">{upcoming.map(item=><article key={item.id}><span>{item.type==="medication"?"✣":"□"}</span><div><small>{shortDate(item.scheduledFor)}</small><strong>{item.title}</strong><p>{item.details||"No extra details"}</p></div></article>)}</div></section>}
        </>}

        {tab==="timeline"&&<section className="wide-panel"><div className="timeline-filter"><button className="active">All updates</button><button>Check-ins</button><button>Notes</button><button>Alerts</button></div><Timeline entries={data.timeline}/></section>}

        {tab==="family"&&<section className="family-page"><div className="family-intro"><div><span>{initials(family.parentName)}</span><h2>{family.parentName}’s care circle</h2><p>Each person gets a private link for simple check-ins. No download or account required.</p></div><button className="app-primary" onClick={()=>setComposer("member")}>＋ Add person</button></div><div className="member-grid">{data.members.map(member=><article key={member.id}><div className="member-avatar">{initials(member.name)}</div><div><h3>{member.name}</h3><p>{member.role}</p></div><span className="link-status">● Link active</span><button onClick={()=>copyLink(member)}>Copy check-in link</button></article>)}</div></section>}

        {tab==="alerts"&&<AlertsPanel family={family} capabilities={data.alertCapabilities||{emailConfigured:false,scheduledRunnerConfigured:false}} deliveries={data.notifications||[]} browserAlerts={browserAlerts} busy={busy} onEnableBrowser={enableBrowserNotifications} onSave={send} onTestEmail={()=>send({action:"testEmail"})}/>} 
      </section>

      <nav className="mobile-app-nav" aria-label="Mobile care space"><button className={tab==="today"?"active":""} onClick={()=>setTab("today")}>⌂<small>Today</small></button><button className={tab==="timeline"?"active":""} onClick={()=>setTab("timeline")}>◷<small>Timeline</small></button><button className="mobile-add" onClick={()=>setComposer("medication")}>＋</button><button className={tab==="family"?"active":""} onClick={()=>setTab("family")}>♧<small>Family</small></button><a href={signOutHref}>↗<small>Account</small></a></nav>
      {composer&&<Composer mode={composer} busy={busy} family={family} onClose={()=>setComposer(null)} onSubmit={send}/>} 
      {toast&&<div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}

function Setup({userName,busy,error,onSubmit,signOutHref}:{userName:string;busy:boolean;error:string;onSubmit:(p:Record<string,unknown>)=>Promise<boolean>;signOutHref:string}) {
  async function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault(); const form=new FormData(event.currentTarget); await onSubmit({action:"setup",parentName:form.get("parentName"),parentLocation:form.get("parentLocation"),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,alertWindowMinutes:Number(form.get("alertWindowMinutes"))}); }
  return <main className="setup-shell"><div className="setup-brand"><span className="brand-mark"><i/><i/><i/></span><strong>Avenkin</strong></div><section className="setup-card"><div className="setup-progress"><i className="active"/><i/><i/></div><span className="setup-icon">♡</span><p className="app-kicker">WELCOME, {firstName(userName).toUpperCase()}</p><h1>Who are we caring for?</h1><p>Start with one parent profile. You can invite the rest of the care circle next.</p>{error&&<div className="error-banner">{error}</div>}<form onSubmit={submit}><label>Parent’s name<input name="parentName" placeholder="e.g. Lakshmi" required autoFocus/></label><label>City or area <span>Optional</span><input name="parentLocation" placeholder="e.g. Hyderabad"/></label><label>Alert me if a check-in is overdue<select name="alertWindowMinutes" defaultValue="120"><option value="30">30 minutes after due time</option><option value="60">1 hour after due time</option><option value="120">2 hours after due time</option><option value="240">4 hours after due time</option></select></label><button className="app-primary setup-submit" disabled={busy}>{busy?"Creating your space…":"Create care space →"}</button></form><small>Coordination only—never diagnosis, prescriptions, or medical advice.</small></section><a href={signOutHref} className="setup-signout">Use a different account</a></main>;
}

function Composer({mode,busy,family,onClose,onSubmit}:{mode:"medication"|"appointment"|"member";busy:boolean;family:Family;onClose:()=>void;onSubmit:(p:Record<string,unknown>)=>Promise<boolean>}) {
  async function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault(); const form=new FormData(event.currentTarget); if(mode==="member") await onSubmit({action:"addMember",name:form.get("name"),role:form.get("role")}); else { const raw=String(form.get("scheduledFor")); await onSubmit({action:"addItem",type:mode,title:form.get("title"),details:form.get("details"),scheduledFor:new Date(raw).toISOString()}); } }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title"><button className="composer-close" onClick={onClose} aria-label="Close">×</button><span className="composer-icon">{mode==="member"?"♧":mode==="medication"?"✣":"□"}</span><p className="app-kicker">{mode==="member"?"CARE CIRCLE":`FOR ${family.parentName.toUpperCase()}`}</p><h2 id="composer-title">{mode==="member"?"Add someone you trust":mode==="medication"?"Add medication":"Add appointment"}</h2><p>{mode==="member"?"They’ll receive a private, no-login check-in link.":"Enter only information your family or clinician has already provided."}</p><form onSubmit={submit}>{mode==="member"?<><label>Name<input name="name" required autoFocus placeholder="e.g. Anita"/></label><label>Role<select name="role"><option>Caregiver</option><option>Family member</option><option>Neighbour</option><option>Parent</option></select></label></>:<><label>{mode==="medication"?"Medication name":"Appointment"}<input name="title" required autoFocus placeholder={mode==="medication"?"e.g. Blood pressure tablet":"e.g. Dr. Mehta · Cardiology"}/></label><label>Details <span>Optional</span><input name="details" placeholder={mode==="medication"?"e.g. 1 tablet · With breakfast":"e.g. Apollo Clinic · Banjara Hills"}/></label><label>Date and time<input name="scheduledFor" type="datetime-local" required defaultValue={defaultDateTime()}/></label></>}<button className="app-primary setup-submit" disabled={busy}>{busy?"Saving…":mode==="member"?"Add to care circle":"Add to schedule"}</button></form></section></div>;
}

function CareRow({item,last,busy,onComplete}:{item:CareItem;last:boolean;busy:boolean;onComplete:()=>void}) { const date=new Date(item.scheduledFor); return <article className={`full-care-row ${item.status} ${last?"last":""}`}><time><strong>{date.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</strong></time><div className="care-line"><span/></div><div className="care-type-icon">{item.type==="medication"?"✣":"□"}</div><div className="care-item-copy"><span>{item.type}</span><h3>{item.title}</h3><p>{item.details||"No extra details"}</p></div>{item.status==="pending"?<button disabled={busy} onClick={onComplete}>✓ Mark {item.type==="medication"?"taken":"attended"}</button>:<span className={`item-badge ${item.status}`}>{item.status==="completed"?`✓ ${item.type==="medication"?"Taken":"Attended"}`:"! Overdue"}</span>}</article>; }
function EmptyState({onAdd}:{onAdd:()=>void}) { return <div className="empty-state"><span>☼</span><h3>Nothing scheduled today</h3><p>Add the first medication or appointment to share the day’s care plan.</p><button onClick={onAdd}>Add a care item</button></div>; }
function Timeline({entries}:{entries:Entry[]}) { if(!entries.length)return <div className="empty-timeline">Updates will appear here as your family checks in.</div>; return <div className="timeline-list">{entries.map(entry=><article key={entry.id} className={entry.kind}><div className="timeline-symbol">{entry.kind==="alert"?"!":entry.kind==="checkin"?"✓":entry.kind==="note"?"✎":entry.kind==="member"?"♧":"＋"}</div><div><p><strong>{entry.actor}</strong> {lowerFirst(entry.message)}</p>{entry.note&&<blockquote>“{entry.note}”</blockquote>}<time>{relativeTime(entry.createdAt)}</time></div></article>)}</div>; }

function AlertsPanel({family,capabilities,deliveries,browserAlerts,busy,onEnableBrowser,onSave,onTestEmail}:{family:Family;capabilities:AlertCapabilities;deliveries:Delivery[];browserAlerts:"off"|"enabled"|"blocked"|"unsupported";busy:boolean;onEnableBrowser:()=>Promise<void>;onSave:(payload:Record<string,unknown>)=>Promise<boolean>;onTestEmail:()=>Promise<boolean>}) {
  const [saved,setSaved]=useState(false);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const ok=await onSave({action:"updateAlerts",notificationEmail:form.get("notificationEmail"),emailAlertsEnabled:form.get("emailAlertsEnabled")==="on",alertWindowMinutes:Number(form.get("alertWindowMinutes"))});
    if(ok){setSaved(true);window.setTimeout(()=>setSaved(false),2200);}
  }
  const browserCopy=browserAlerts==="enabled"?"Enabled on this device":browserAlerts==="blocked"?"Blocked in browser settings":browserAlerts==="unsupported"?"Not supported on this browser":"Ready to enable";
  return <section className="alerts-page">
    <div className="alerts-hero">
      <div><span className="alerts-hero-icon">♢</span><p className="app-kicker">ALERT ENGINE</p><h2>Know when a check-in needs attention</h2><p>Avenkin watches the shared schedule and flags anything still unconfirmed after your chosen window.</p></div>
      <span className={`engine-status ${capabilities.scheduledRunnerConfigured?"active":"waiting"}`}><i/>{capabilities.scheduledRunnerConfigured?"Automatic checks active":"Activation pending"}</span>
    </div>

    <div className="alert-channel-grid">
      <article className="alert-channel-card">
        <div className="channel-heading"><span>▣</span><div><small>THIS DEVICE</small><h3>Browser notifications</h3></div></div>
        <p>See a native notification when a new overdue item appears while Avenkin is open in this browser.</p>
        <div className="channel-footer"><span className={`channel-state ${browserAlerts}`}>● {browserCopy}</span>{browserAlerts==="off"&&<button type="button" onClick={onEnableBrowser}>Enable alerts</button>}</div>
      </article>
      <article className="alert-channel-card">
        <div className="channel-heading"><span>✉</span><div><small>PRIMARY RECIPIENT</small><h3>Email alerts</h3></div></div>
        <p>{capabilities.emailConfigured?"Email delivery is connected. Missed check-ins are sent to the address below.":"Email logic is ready. Connect a verified sending provider to begin external delivery."}</p>
        <div className="channel-footer"><span className={`channel-state ${capabilities.emailConfigured?"enabled":"off"}`}>● {capabilities.emailConfigured?"Provider connected":"Provider connection pending"}</span><button type="button" onClick={onTestEmail} disabled={busy||!capabilities.emailConfigured}>Send test</button></div>
      </article>
    </div>

    <div className="alert-lower-grid">
      <form className="alert-settings" onSubmit={save}>
        <div className="panel-heading"><div><h2>Alert preferences</h2><p>Choose how late a check-in can be before it becomes an alert.</p></div>{saved&&<span className="saved-state">✓ Saved</span>}</div>
        <label>Alert recipient<input name="notificationEmail" type="email" defaultValue={family.notificationEmail} placeholder="you@example.com" required/></label>
        <label>Overdue window<select name="alertWindowMinutes" defaultValue={String(family.alertWindowMinutes)}><option value="30">30 minutes after due time</option><option value="60">1 hour after due time</option><option value="120">2 hours after due time</option><option value="240">4 hours after due time</option></select></label>
        <label className="alert-toggle"><input name="emailAlertsEnabled" type="checkbox" defaultChecked={family.emailAlertsEnabled}/><span><strong>Queue email alerts</strong><small>Send automatically once an email provider is connected.</small></span></label>
        <button className="app-primary" disabled={busy}>{busy?"Saving…":"Save preferences"}</button>
      </form>

      <section className="delivery-panel">
        <div className="panel-heading"><div><h2>Delivery history</h2><p>The latest external alert attempts.</p></div></div>
        {deliveries.length===0?<div className="empty-deliveries"><span>✓</span><strong>No delivery issues</strong><p>Alert attempts will appear here when a check-in is missed.</p></div>:<div className="delivery-list">{deliveries.map(delivery=><article key={delivery.id}><span className={`delivery-icon ${delivery.status}`}>{delivery.status==="sent"?"✓":delivery.status==="failed"?"!":"·"}</span><div><strong>{delivery.channel.toUpperCase()} · {delivery.recipient}</strong><p>{delivery.status==="sent"?"Delivered":delivery.status==="failed"?(delivery.errorMessage||"Delivery failed"):"Queued for delivery"}</p><time>{relativeTime(delivery.sentAt||delivery.createdAt)}</time></div><b className={delivery.status}>{delivery.status}</b></article>)}</div>}
      </section>
    </div>
    <p className="alerts-footnote">Avenkin coordinates and informs. It does not provide emergency monitoring, diagnosis, prescriptions, or medical advice.</p>
  </section>;
}

function localDay(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function defaultDateTime(){const d=new Date(Date.now()+60*60*1000);d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);return `${localDay(d)}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join("").toUpperCase();}
function firstName(value:string){return value.trim().split(/\s+/)[0]||"there";}
function dayPart(){const h=new Date().getHours();return h<12?"morning":h<17?"afternoon":"evening";}
function longDate(){return new Date().toLocaleDateString([], {weekday:"long",day:"numeric",month:"long"}).toUpperCase();}
function shortDate(value:string){return new Date(value).toLocaleDateString([], {weekday:"short",day:"numeric",month:"short"}).toUpperCase();}
function lowerFirst(value:string){return value?value[0].toLowerCase()+value.slice(1):value;}
function relativeTime(value:string){const ms=Date.now()-new Date(value).getTime();const min=Math.max(0,Math.round(ms/60000));if(min<1)return"Just now";if(min<60)return`${min}m ago`;const hours=Math.round(min/60);if(hours<24)return`${hours}h ago`;return new Date(value).toLocaleDateString([], {day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});}
