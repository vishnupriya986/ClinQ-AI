import { Activity, LockKeyhole } from 'lucide-react'

export default function AuthAside() {
  return (
    <aside className="auth-aside">
      <div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" />
      <div className="aside-content">
        <div className="aside-kicker"><span /> A MORE INFORMED YOU</div>
        <h2>Clarity for<br />your health<br /><em>journey.</em></h2>
        <p>A thoughtful space to understand your health and prepare for better conversations with your care team.</p>
        <div className="aside-stats">
          <div><span className="stat-icon"><Activity size={17} /></span><span><strong>Made for you</strong><small>Your personal health workspace</small></span></div>
          <div><span className="stat-icon"><LockKeyhole size={17} /></span><span><strong>Private by design</strong><small>Your account, your information</small></span></div>
        </div>
      </div>
      <span className="aside-foot">CLINQ AI <span>·</span> HEALTH INFORMATION, REIMAGINED</span>
    </aside>
  )
}
