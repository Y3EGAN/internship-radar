import Link from "next/link";
import { RealtimeRefresh } from "./realtime-refresh";

const navigation = [
  ["Overview", "/"], ["Jobs", "/jobs"], ["Saved", "/saved"], ["Applied", "/applied"], ["Applications", "/applications"],
  ["Sources", "/sources"], ["Runs", "/runs"], ["Profile", "/profile"], ["Devices", "/settings/devices"],
] as const;

export function DashboardShell({ children, ownerId }: { readonly children: React.ReactNode; readonly ownerId: string }) {
  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link href="/" className="brand">INTERNSHIP<br /><span>RADAR</span></Link>
        <nav>{navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
        <p className="sidebar-note">Private workspace<br />Best-effort source timing</p>
      </aside>
      <details className="mobile-nav">
        <summary>Menu <span aria-hidden="true">+</span></summary>
        <nav>{navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      </details>
      <main id="main-content" className="main-content"><RealtimeRefresh ownerId={ownerId} />{children}</main>
    </div>
  );
}
