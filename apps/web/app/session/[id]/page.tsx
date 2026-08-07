import SessionClient from "@/components/session/SessionClient";

export default function RunPage({ params }: { params: { id: string } }) {
  return <SessionClient id={params.id} />;
}
