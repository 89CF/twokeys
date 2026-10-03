import { DealView } from "@/components/deal/DealView";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ deal: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { deal } = await params;
  const { created } = await searchParams;
  return <DealView address={deal} created={created === "1"} />;
}
