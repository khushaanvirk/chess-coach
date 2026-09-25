import { useRouter } from "next/router";
import { PageTitle } from "@/components/pageTitle";
import RetryTrainer from "@/sections/retry";

export default function RetryPage() {
  const router = useRouter();
  const { gameKey } = router.query;

  if (!router.isReady) return null;

  return (
    <>
      <PageTitle title="Chess Coach · Practise mistakes" />
      <RetryTrainer
        key={typeof gameKey === "string" ? gameKey : "recent"}
        gameKey={typeof gameKey === "string" ? gameKey : undefined}
      />
    </>
  );
}
