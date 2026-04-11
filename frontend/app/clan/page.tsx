import ClanOverviewClient from "./overview-client";

type ClanPageProps = {
  searchParams?: {
    clan?: string;
  };
};

export default function ClanPage({ searchParams }: ClanPageProps) {
  const clan = searchParams?.clan ?? "";

  return <ClanOverviewClient clan={clan} />;
}
