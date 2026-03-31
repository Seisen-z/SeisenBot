import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 1 week

// Server Action — this is the ONLY reliable way to set httpOnly cookies
// in Next.js App Router on Vercel production.
async function setSessionCookies(token: string, userId: string) {
  "use server";
  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  cookieStore.set("user_id", userId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  redirect("/");
}

export default async function SetSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; u?: string }>;
}) {
  const { t: token, u: userId } = await searchParams;

  // If no token, someone visited this page directly — send to login
  if (!token || !userId) {
    redirect("/login?error=no_session");
  }

  // Call the server action immediately to set cookies and redirect to /
  await setSessionCookies(token, userId);

  // This is never rendered but needed for TypeScript
  return null;
}
