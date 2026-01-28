import pandas as pd
import numpy as np
from collections import Counter

DATA = "../data"

# ---------- Load ----------
entities = pd.read_csv(f"{DATA}/mev_entities.csv")                # entity_id, wallet
wallet_accounts = pd.read_csv(f"{DATA}/wallet_accounts.csv")     # wallet, account
shapes = pd.read_csv(f"{DATA}/execution_shapes.csv")             # wallet, shape
slots = pd.read_csv(f"{DATA}/slot_participation.csv")            # wallet, slot

atomic = pd.read_csv(f"{DATA}/step4/atomic_arbitrage.csv")       # wallet, shape
pga = pd.read_csv(f"{DATA}/step4/pga_entities.csv")              # entity_id, slot, tx_count

concentration = pd.read_csv(f"{DATA}/step5/entity_concentration.csv")  # slot, total_tx, top_entity_share
toxicity = pd.read_csv(f"{DATA}/step5/pool_toxicity.csv")              # entity_id, account, interaction_count
adverse = pd.read_csv(f"{DATA}/step5/adverse_selection.csv")            # entity_id, early_rate, total_txs

validator_capture = pd.read_csv(f"{DATA}/step6/validator_capture_score.csv")
validator_loyalty = pd.read_csv(f"{DATA}/step6/validator_entity_loyalty.csv")
validator_mev = pd.read_csv(f"{DATA}/step6/validator_tx_mev_rate.csv")

# ---------- Base: wallet_count ----------
wallet_count = (
    entities.groupby("entity_id")["wallet"]
    .nunique()
    .reset_index(name="wallet_count")
)

df = wallet_count.copy()

# ---------- Unique accounts ----------
acc_entity = (
    wallet_accounts
    .merge(entities, on="wallet", how="inner")
    .groupby("entity_id")["account"]
    .nunique()
    .reset_index(name="unique_accounts")
)

df = df.merge(acc_entity, on="entity_id", how="left")

# ---------- Execution shape entropy ----------
def entropy(values):
    if len(values) == 0:
        return 0.0
    c = Counter(values)
    probs = np.array(list(c.values())) / sum(c.values())
    return -np.sum(probs * np.log2(probs))

shape_entity = (
    shapes
    .merge(entities, on="wallet", how="inner")
    .groupby("entity_id")["shape"]
    .apply(list)
    .reset_index()
)

shape_features = shape_entity.assign(
    execution_shape_count=lambda x: x["shape"].apply(lambda v: len(set(v))),
    shape_entropy=lambda x: x["shape"].apply(entropy)
).drop(columns="shape")

df = df.merge(shape_features, on="entity_id", how="left")

# ---------- Slot participation ----------
slot_entity = (
    slots
    .merge(entities, on="wallet", how="inner")
    .groupby("entity_id")
    .agg(
        slot_count=("slot", "nunique")
    )
    .reset_index()
)

df = df.merge(slot_entity, on="entity_id", how="left")

# ---------- Strategy counts ----------
atomic_count = (
    atomic
    .merge(entities, on="wallet", how="inner")
    .groupby("entity_id")
    .size()
    .reset_index(name="atomic_arb_count")
)

pga_count = (
    pga.groupby("entity_id")["slot"]
    .nunique()
    .reset_index(name="pga_slot_count")
)

df = df.merge(atomic_count, on="entity_id", how="left")
df = df.merge(pga_count, on="entity_id", how="left")

# ---------- Market concentration ----------
# NOTE: entity_concentration is SLOT level, not entity level
# We aggregate slots where entity participated

entity_slots = (
    slots.merge(entities, on="wallet", how="inner")[["entity_id", "slot"]]
    .drop_duplicates()
)

entity_concentration = (
    entity_slots
    .merge(concentration, on="slot", how="left")
    .groupby("entity_id")["top_entity_share"]
    .mean()
    .reset_index(name="avg_top_entity_share")
)

df = df.merge(entity_concentration, on="entity_id", how="left")

# ---------- Pool toxicity ----------
toxic_feat = (
    toxicity.groupby("entity_id")["interaction_count"]
    .sum()
    .reset_index(name="toxic_pool_interactions")
)

df = df.merge(toxic_feat, on="entity_id", how="left")

# ---------- Adverse selection ----------
df = df.merge(adverse, on="entity_id", how="left")

# ---------- Validator coupling ----------
# validator_capture → GLOBAL (no entity_id)
validator_capture_feat = validator_capture.mean(numeric_only=True).to_dict()

for k, v in validator_capture_feat.items():
    df[f"validator_{k}"] = v

# validator_loyalty → entity-specific
validator_loyalty_feat = (
    validator_loyalty
    .groupby("mev_entity_id")
    .agg(
        avg_slots_seen=("slots_seen", "mean"),
        best_entity_rank=("entity_rank", "min")
    )
    .reset_index()
    .rename(columns={"mev_entity_id": "entity_id"})
)

df = df.merge(validator_loyalty_feat, on="entity_id", how="left")

# validator_mev → GLOBAL
validator_mev_feat = validator_mev.mean(numeric_only=True).to_dict()

for k, v in validator_mev_feat.items():
    df[f"validator_{k}"] = v

# ---------- Cleanup ----------
df = df.fillna(0)

df.to_csv(f"{DATA}/entity_features.csv", index=False)

print("✅ Built entity_features.csv (schema-correct, entity-safe)")
