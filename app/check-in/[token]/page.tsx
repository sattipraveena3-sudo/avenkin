import CheckInClient from "./CheckInClient";

export const dynamic = "force-dynamic";

export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CheckInClient token={token} />;
}
