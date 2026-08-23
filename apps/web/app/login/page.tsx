import { signIn, signInWithGitHub } from "./actions";

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">PRIVATE OWNER ACCESS</p><h1>Sign in</h1>{error && <p role="alert">Sign-in was not accepted. Check the provider setup or credentials and try again.</p>}<form action={signInWithGitHub}><button type="submit">Continue with GitHub</button></form><p className="auth-separator"><span>or password fallback</span></p><form action={signIn}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="secondary-button" type="submit">Open dashboard</button></form></section></main>;
}
