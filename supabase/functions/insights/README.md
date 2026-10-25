# Insights Edge Function (architecture)
# Mobile never calls the AI provider.
# This function should:
# 1. authenticate the user
# 2. load precomputed SQL metrics
# 3. send only aggregated numbers to the model
# 4. return copy — never invented amounts
