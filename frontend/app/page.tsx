import { Suspense } from "react";
import HomePageContent from "./page-content";

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}
