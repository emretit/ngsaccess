"""UI-audit-2 commit: karışık dosyaların 'yalnız bizim hunk'larımız' sürümünü üretir.
HEAD içeriğine -U0 diff'in seçili hunk'larını uygular. Çıktı: .claude/ui-audit-2-commit/mixed/<yol>.
Kullanım: python3 -I .claude/ui-audit-2-commit/build_mixed.py  (repo kökünden)"""
import os, re, subprocess

KEEP = {
    "convex/schema.ts": {0, 1, 2, 7, 9, 10, 11},          # e9: 3,4,5 (alarm), 6 (leaves.source), 8 (attendanceCorrections)
    "src/lib/routeMeta.ts": {1, 2},                         # e9: 0 (BellRing), 3 (/alarms)
    "src/pages/Employees.tsx": {3, 5, 6, 7, 8},             # e9: 0,1,2,4,9 (Excel içe/dışa aktar)
    "src/components/employees/EmployeeBulkActions.tsx": {2, 3, 5, 6, 7},  # e9: 0,1,4 (Toplu kart ata)
    "src/components/employees/EmployeeTable.tsx": set(range(22)) - {1, 5, 14},  # e9: 1,5,14 + H21 içindeki BatchCardAssignDialog bloğu
}
# Hunk içi kısmi tutma: (dosya, hunk) -> eklenen satırların tutulacak dilimi
PARTIAL = {("src/components/employees/EmployeeTable.tsx", 21): slice(0, 6)}
# Ek: HEAD api.d.ts'e yalnız bizim yeni convex/lib modüllerimiz (codegen sırası alfabetik)
API_NEW = ["lib/pdksAvailability", "lib/pdksDay", "lib/pdksWorkDay"]

def git(*a): return subprocess.run(["git", *a], capture_output=True, text=True, check=True).stdout

def hunks(path):
    d = git("diff", "-U0", "HEAD", "--", path).splitlines()
    out, cur = [], None
    for line in d:
        m = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
        if m:
            cur = {"old": int(m[1]), "olen": int(m[2]) if m[2] is not None else 1, "add": [], "del": []}
            out.append(cur)
        elif cur is not None and line.startswith("+") and not line.startswith("+++"): cur["add"].append(line[1:])
        elif cur is not None and line.startswith("-") and not line.startswith("---"): cur["del"].append(line[1:])
    return out

def build(path, keep):
    base = git("show", f"HEAD:{path}").split("\n")
    hs = hunks(path)
    res, pos = [], 0  # pos: base içinde 0-tabanlı imleç
    for i, h in enumerate(hs):
        start = h["old"] - 1 if h["olen"] > 0 else h["old"]  # olen=0 → old satırından SONRA ekleme
        res.extend(base[pos:start]); pos = start
        if i in keep:
            add = h["add"][PARTIAL[(path, i)]] if (path, i) in PARTIAL else h["add"]
            assert base[pos:pos + h["olen"]] == h["del"], (path, i)
            res.extend(add); pos += h["olen"]
    res.extend(base[pos:])
    return "\n".join(res)

def build_api():
    path = "convex/_generated/api.d.ts"
    lines = git("show", f"HEAD:{path}").split("\n")
    for mod in API_NEW:
        ident = mod.replace("/", "_")
        imp = f'import type * as {ident} from "../{mod}.js";'
        ent = f'  "{mod}": typeof {ident};'
        for new, pat in ((imp, r'^import type \* as (\S+) from "\.\./(.+)\.js";$'), (ent, r'^  "?([^":]+)"?: typeof \S+;$')):
            idx = [k for k, l in enumerate(lines) if re.match(pat, l)]
            key = lambda l: re.match(pat, l).group(2 if pat.startswith("^import") else 1)
            nk = key(new)
            at = next((k for k in idx if key(lines[k]) > nk), idx[-1] + 1)
            lines.insert(at, new)
    return "\n".join(lines)

root = os.path.dirname(os.path.abspath(__file__))
for p, keep in KEEP.items():
    dst = os.path.join(root, "mixed", p); os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, "w").write(build(p, keep))
dst = os.path.join(root, "mixed", "convex/_generated/api.d.ts"); os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, "w").write(build_api())
print("ok")
