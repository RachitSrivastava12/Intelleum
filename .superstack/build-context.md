# Build Context: Intelleum

```json
{
  "project": "Intelleum",
  "pipeline": {
    "ingestion_method": "webhook",
    "data_types": [
      "transactions",
      "token-transfers",
      "program-events",
      "route-risk time buckets",
      "toxic-flow candles"
    ],
    "storage": "custom",
    "backfill_implemented": false
  },
  "notes": [
    "QuickNode stream receiver feeds live chain blocks into the detector pipeline.",
    "The Toxic Flow Terminal is a derived API/UI surface over route risk, markout, LVR, and attack overlays.",
    "Production storage should persist candle buckets by slot/time so redeploys do not reset terminal history."
  ]
}
```
