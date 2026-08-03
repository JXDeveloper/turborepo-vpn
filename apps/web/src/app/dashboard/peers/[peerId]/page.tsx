import PeerDetail from "./peer-detail";

export default async function PeerDetailPage({
  params,
}: {
  params: Promise<{ peerId: string }>;
}) {
  const { peerId } = await params;
  return <PeerDetail peerId={peerId} />;
}
