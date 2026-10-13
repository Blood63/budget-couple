"""Test hors ligne de scripts/check_rates.py (extraits réels des pages officielles, 13/10/2026). Lancer : python3 tests/test_check_rates.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import check_rates as C
T = {"F2365": "Le taux d'intérêt annuel du livret A est de 1,7 %.", "F2368": "Le taux d'intérêt annuel est de 1,7 %",
     "F2367": "Le taux d'intérêt du LEP est de 2,50 %.", "epargne-logement": "Le taux de rémunération du CEL est de 1.25 % brut"}
f = lambda url: next(v for k, v in T.items() if k in url)
path = os.path.join(os.path.dirname(__file__), "..", "rates.json")
assert C.main(path, f) == 0
T["F2365"] = T["F2365"].replace("1,7", "1,5"); assert C.main(path, f) == 10
T["F2367"] = "structure modifiée"; assert C.main(path, f) == 10
T["F2365"] = T["F2365"].replace("1,5", "1,7"); assert C.main(path, f) == 20
print("OK")
