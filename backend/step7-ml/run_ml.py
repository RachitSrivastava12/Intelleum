import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest

df = pd.read_csv("../data/entity_features.csv")

ENTITY_COL = "entity_id"
X = df.drop(columns=[ENTITY_COL])

# ---------- Normalize ----------
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ---------- PCA ----------
pca = PCA(n_components=3)
pca_coords = pca.fit_transform(X_scaled)

df["pca_1"] = pca_coords[:,0]
df["pca_2"] = pca_coords[:,1]
df["pca_3"] = pca_coords[:,2]

# ---------- Isolation Forest ----------
iso = IsolationForest(
    n_estimators=300,
    contamination=0.05,
    random_state=42
)

df["risk_score"] = -iso.fit_predict(X_scaled)
df["anomaly_score"] = -iso.decision_function(X_scaled)

# ---------- Rank ----------
df["risk_rank"] = df["anomaly_score"].rank(ascending=False)

df.sort_values("risk_rank", inplace=True)
df.to_csv("ml_entity_risk_scores.csv", index=False)

print("🔥 ML risk scoring complete")
