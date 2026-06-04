export default async function BrandCampaignDetail({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Campaign · {campaignId}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        TODO: read-only campaign view + content approval queue + spend tracker.
      </p>
    </div>
  );
}
