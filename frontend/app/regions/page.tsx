import RegionsClient from "./regionsClient";

type RegionsPageProps = {
  searchParams?: {
    clan?: string;
    username?: string;
  };
};

export default function RegionsPage({ searchParams }: RegionsPageProps) {
  const clan = searchParams?.clan ?? "Unknown Clan";
  const username = searchParams?.username ?? "Unknown Player";

  return <RegionsClient clan={clan} username={username} />;
}
