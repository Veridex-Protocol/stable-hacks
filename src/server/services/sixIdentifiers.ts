// Derived from:
// - /Users/mannyuncharted/Documents/gigs/veridex/hackathon/stablehacks-2026/Cross Currency and Precious Metals Identifiers.xlsx
// - worksheet BC148
//
// These identifiers are the VALOR_BC values expected by the SIX intradaySnapshot
// endpoint for the hackathon account.

export const SIX_FOREX_IDENTIFIERS: Record<string, string> = {
  'EUR/USD': '946681_148',
  'CHF/USD': '275164_148',
  'CHF/EUR': '968880_148',
  'GBP/USD': '275017_148',
  'USD/NGN': '199113_148',
  'USD/XAG': '274720_148',
  'USD/XPT': '287635_148',
  'USD/XPD': '283501_148',
};

