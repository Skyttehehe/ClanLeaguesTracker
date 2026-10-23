import RegionsClient from "./regionsClient";

type RegionsPageProps = {
  searchParams?: Promise<{
    clan?: string;
    username?: string;
  }>;
};

export default async function RegionsPage({ searchParams }: RegionsPageProps) {
  const params = await searchParams;
  const clan = params?.clan ?? "Unknown Clan";
  const username = params?.username ?? "Unknown Player";

  return <RegionsClient clan={clan} username={username} />;
}
