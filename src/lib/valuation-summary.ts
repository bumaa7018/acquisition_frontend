import type { Asset, Compensation } from "@/types";

export type AssetValuationRow = {
  asset: Asset;
  compensations: Compensation[];
  total: number;
};

export function sumCompensations(compensations: Pick<Compensation, "amount">[]): number {
  return compensations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

export function parcelValuations(compensations: Compensation[], parcelId?: string): Compensation[] {
  return compensations.filter(
    (item) =>
      item.target_type === "parcel" &&
      (!parcelId || item.parcel_id === parcelId),
  );
}

export function assetValuationRows(
  assets: Asset[],
  compensations: Compensation[],
  assetType?: Asset["asset_type"],
): AssetValuationRow[] {
  return assets
    .filter((asset) => !assetType || asset.asset_type === assetType)
    .map((asset) => {
      const assetComps = compensations.filter(
        (item) => item.target_type === "asset" && item.asset_id === asset.id,
      );
      return {
        asset,
        compensations: assetComps,
        total: sumCompensations(assetComps),
      };
    });
}

export function valuationTotals(
  assets: Asset[],
  compensations: Compensation[],
  parcelId?: string,
) {
  const landTotal = sumCompensations(parcelValuations(compensations, parcelId));
  const assetTotal = sumCompensations(
    assetValuationRows(assets, compensations).flatMap((row) => row.compensations),
  );

  return {
    landTotal,
    assetTotal,
    total: landTotal + assetTotal,
  };
}
