const CRM_DEAL_DETAILS_BASE =
  "https://td.monolit-crm.ru/crm/deal/details";

/** Deep link to a deal card in Bitrix / Monolit CRM. */
export function buildDealCrmUrl(dealId: number): string {
  return `${CRM_DEAL_DETAILS_BASE}/${dealId}/`;
}
