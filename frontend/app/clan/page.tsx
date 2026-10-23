import ClanOverviewClient from "./overview-client";

type ClanPageProps = {
  searchParams?: Promise<{
    clan?: string;
  }>;
};

export default async function ClanPage({ searchParams }: ClanPageProps) {
  const params = await searchParams;
  const clan = params?.clan ?? "";

  return <ClanOverviewClient clan={clan} />;
}
