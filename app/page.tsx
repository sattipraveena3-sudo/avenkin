import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

const today = [
  { time: "8:00", period: "AM", title: "Blood pressure tablet", meta: "1 tablet · With breakfast", state: "done" },
  { time: "1:00", period: "PM", title: "Vitamin D", meta: "1 capsule · After lunch", state: "due" },
  { time: "4:30", period: "PM", title: "Dr. Mehta · Cardiology", meta: "Apollo Clinic · Banjara Hills", state: "later" },
];

export default async function Home() {
  const user = await getChatGPTUser();
  const appHref = user ? "/app" : chatGPTSignInPath("/app");

  return (
    <main>
      <section className="hero-shell">
        <nav className="site-nav" aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="Avenkin home">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>Avenkin</span>
          </a>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#safety">Safety</a>
          </div>
          <a className="button button-small button-ink" href={appHref}>
            {user ? "Open dashboard" : "Sign in"}<span aria-hidden="true">↗</span>
          </a>
        </nav>

        <div id="top" className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span /> Care stays close, even when you aren’t</div>
            <h1>Know Mum is okay.<br /><em>Without another call.</em></h1>
            <p className="hero-lede">One calm place for medications, appointments and caregiver updates—made for families caring across cities.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={appHref}>Start coordinating <span aria-hidden="true">→</span></a>
              <a className="text-link" href="#product-preview"><span className="play-dot">▶</span> See today’s care</a>
            </div>
            <div className="trust-row" aria-label="Product benefits">
              <span>✓ No app for parents</span><span>✓ One-tap check-ins</span><span>✓ Private by design</span>
            </div>
          </div>

          <div className="hero-visual" id="product-preview">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="phone-card">
              <div className="phone-topbar"><span className="phone-time">9:41</span><span aria-hidden="true">● ◒</span></div>
              <header className="phone-header">
                <div><span className="mini-label">TUESDAY · 19 AUG</span><h2>Good morning, Praveena</h2></div>
                <span className="avatar">PS</span>
              </header>
              <div className="status-banner">
                <span className="status-icon">✓</span>
                <div><strong>Mum is on track</strong><small>Last update 24 minutes ago</small></div>
                <span className="pulse-bars" aria-hidden="true"><i /><i /><i /><i /></span>
              </div>
              <div className="schedule-heading"><div><span>TODAY’S CARE</span><b>3 items</b></div><button type="button" aria-label="Add a care item">+</button></div>
              <div className="care-list">
                {today.map((item) => (
                  <article className={`care-row ${item.state}`} key={item.title}>
                    <time><strong>{item.time}</strong><span>{item.period}</span></time>
                    <div className="timeline-pin"><span /></div>
                    <div className="care-copy"><strong>{item.title}</strong><span>{item.meta}</span></div>
                    <span className="care-state">{item.state === "done" ? "✓ Taken" : item.state === "due" ? "Due now" : "Upcoming"}</span>
                  </article>
                ))}
              </div>
              <div className="care-note">
                <span className="note-avatar">AN</span>
                <p><strong>Anita added a note</strong>“She ate well and took a short walk after breakfast.”</p>
                <time>8:26 AM</time>
              </div>
              <div className="phone-nav" aria-hidden="true"><span className="active">⌂<small>Today</small></span><span>◷<small>Timeline</small></span><span>♧<small>Family</small></span></div>
            </div>
            <aside className="floating-alert">
              <span className="bell">♢</span><div><strong>Everything’s covered</strong><small>We’ll alert you only when something needs attention.</small></div>
            </aside>
            <span className="petal petal-a" /><span className="petal petal-b" /><span className="petal petal-c" />
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Avenkin at a glance">
        <p>Built for the <strong>distance between “I hope” and “I know.”</strong></p>
        <div><span><b>1</b> shared timeline</span><span><b>0</b> apps for parents</span><span><b>24/7</b> quiet reassurance</span></div>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-heading">
          <span className="eyebrow"><span /> SIMPLE ON PURPOSE</span>
          <h2>Care coordination that feels<br /><em>less like coordination.</em></h2>
          <p>Everyone sees the same plan. Everyone can update it. You only get interrupted when it matters.</p>
        </div>
        <div className="step-grid">
          <article><span className="step-no">01</span><div className="step-icon calendar-icon">19</div><h3>Set the care rhythm</h3><p>Add medications, appointments and the grace period before an alert.</p></article>
          <article><span className="step-no">02</span><div className="step-icon tap-icon">✓</div><h3>One tap says “done”</h3><p>Parents and caregivers use a simple private link. No app or password needed.</p></article>
          <article><span className="step-no">03</span><div className="step-icon ripple-icon">◉</div><h3>Step in only when needed</h3><p>A missed check-in becomes a clear alert, not a crisis discovered days later.</p></article>
        </div>
      </section>

      <section className="safety-band" id="safety">
        <div><span className="brand-mark light" aria-hidden="true"><i /><i /><i /></span><h2>Coordination, not diagnosis.</h2></div>
        <p>Avenkin stores only the care information your family enters. It never prescribes, diagnoses, or recommends treatment. In an emergency, always contact local emergency services.</p>
        <a href={appHref}>Create your family space <span>→</span></a>
      </section>

      <footer>
        <a className="wordmark" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Avenkin</span></a>
        <p>Clarity for families caring from anywhere.</p>
        <small>© 2026 Avenkin · Coordination only, never medical advice.</small>
      </footer>
    </main>
  );
}
