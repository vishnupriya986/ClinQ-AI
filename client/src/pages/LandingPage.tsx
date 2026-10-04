import { ArrowRight, Activity, HeartPulse, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="brand"><span className="brand-mark"><Activity size={21} /></span><span>ClinQ<span className="brand-ai"> AI</span><small>HEALTH COMPANION</small></span></Link>
        <div><Link className="nav-login" to="/login">Sign in</Link><Link className="button button-primary nav-cta" to="/register">Get started <ArrowRight size={16} /></Link></div>
      </header>
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span /> A MORE INFORMED HEALTH JOURNEY</div>
            <h1>Your health,<br />with <em>more clarity.</em></h1>
            <p>A private, thoughtful space to explore health information and feel more prepared for conversations with your care team.</p>
            <div className="hero-actions"><Link className="button button-primary" to="/register">Create your account <ArrowRight size={17} /></Link><Link className="hero-secondary" to="/login">I already have an account</Link></div>
            <div className="hero-assurance"><ShieldCheck size={17} /> Private account <span /> Health information, not a diagnosis</div>
          </div>
          <div className="hero-art">
            <div className="art-glow" />
            <div className="art-ring ring-outer" /><div className="art-ring ring-inner" />
            <div className="health-card">
              <div className="health-card-top"><span><HeartPulse size={18} /></span><small>YOUR HEALTHSPACE</small><b>•••</b></div>
              <div className="health-card-title">A thoughtful space<br />for your health journey.</div>
              <div className="landing-card-items"><span><ShieldCheck size={15} /> Private account</span><span><Sparkles size={15} /> Health information</span><span><HeartPulse size={15} /> Care conversations</span></div>
              <div className="health-card-bottom"><span>Designed around your journey</span><span className="live-dot" /></div>
            </div>
            <div className="floating-pill pill-top"><span className="pill-icon"><ShieldCheck size={16} /></span><span><b>Private by design</b><small>Your information stays yours</small></span></div>
            <div className="floating-pill pill-bottom"><span className="pill-icon sparkle"><Sparkles size={16} /></span><span><b>Thoughtful support</b><small>Understand health information</small></span></div>
            <div className="art-orb" />
          </div>
        </section>
        <section className="landing-values">
          <div><span><ShieldCheck size={18} /></span><p><b>Private workspace</b><small>Your account and information stay yours.</small></p></div>
          <div><span><HeartPulse size={18} /></span><p><b>Health-first perspective</b><small>Information to support—not replace—care.</small></p></div>
          <div><span><Sparkles size={18} /></span><p><b>Built with care</b><small>Created for clearer health conversations.</small></p></div>
        </section>
      </main>
      <footer className="landing-footer">ClinQ AI <span>·</span> This service does not provide medical diagnosis or treatment.</footer>
    </div>
  )
}
