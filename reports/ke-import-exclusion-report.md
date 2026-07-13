# K-Electric Legacy Import - Excluded Data Report

Generated: 2026-07-13T00:20:27.479Z
Import batch: `62a41a10-aa85-4fb0-92c0-968c64abccba`  
Source manifest: `9d899a39e3a6adc2df236fc3ec629d69b981a837c2b54e588c783e29c9de58ba`

## Executive summary

Across the two order-bearing exports there are **811 unique legacy order IDs**. **594 (73.24%)** were imported and **217 (26.76%)** were not imported. No legacy ID was silently dropped.

Of the 805 authoritative order headers, 594 were imported and 211 were excluded. Another 6 IDs occur only in sales-report.json and have no order header.

| Outcome | Orders | Notes |
|---|---:|---|
| Imported | 594 | Final delivered, no refund, exact item/order financial reconciliation |
| Excluded order headers | 211 | Classified by the reasons below |
| Sales-only orphan IDs | 6 | No authoritative order header; not part of the 805 headers |
| **Unique legacy IDs** | **811** | Imported + all exclusions |

## Why records were excluded

| Primary reason | Count | Share of all legacy IDs | Legacy reported total* | Explanation |
|---|---:|---:|---:|---|
| NOT_DELIVERED | 164 | 20.22% | Rs 7,443,140.90 | The header was not in final Delivered state. This includes active, partial, cancelled, and refunded workflow states. |
| HAS_REFUND | 15 | 1.85% | Rs 643,900.00 | The order was delivered but has a refund amount; item-level refund evidence is unavailable and refunds were explicitly skipped. |
| ITEM_SUBTOTAL_MISMATCH | 20 | 2.47% | Rs 1,271,319.08 | Defensible item-level values do not reconcile to the reported order subtotal. |
| UNRESOLVED_ITEM_PRICE | 12 | 1.48% | Rs 398,408.52 | One or more final charged unit prices cannot be established without guessing. |
| MISSING_ORDER_HEADER | 6 | 0.74% | Rs 23,638.94 | Sales rows exist without a matching authoritative order header. |

* Excluded totals are informational legacy header values. They are not all valid sale revenue; for example, cancelled and refunded headers are included.

## Excluded workflow-status breakdown

| Legacy status interpretation | Count | Legacy reported total* |
|---|---:|---:|
| Cancelled | 87 | Rs 1,765,607.60 |
| Delivered | 47 | Rs 2,313,627.60 |
| Out For Delivery | 31 | Rs 977,593.00 |
| Order Placed | 21 | Rs 338,101.00 |
| In Process | 14 | Rs 1,941,575.00 |
| Refunded | 8 | Rs 110,647.30 |
| Unknown Legacy Status 9 | 6 | Rs 23,638.94 |
| Partial Delivery | 3 | Rs 2,309,617.00 |

## Successfully imported baseline

- Orders: 594
- Order-item rows: 5236
- Fulfilled quantity: 41199
- Product subtotal: Rs 41,151,789.00
- Tax: Rs 6,487.20
- Grand total: Rs 41,158,276.20

## Other source data intentionally not written

- Refund report: empty. Refunds were excluded by request and cannot be reconstructed safely without item-level refund evidence.
- Budget export: not imported because it does not provide reliable allocation tenure; current production budgets were deliberately left unchanged.
- Stock export: not imported because current stock is operational state and historical orders must not alter it.
- Product-summary zero-quantity artifacts: 39 rows were ignored as price evidence.
- users.json: 0 bytes, so it supplied no additional user data.
- Product categories: the exports do not contain a trustworthy category mapping; newly created historical products remain Uncategorized/inactive.

## Row-level evidence

The complete 217-row evidence table is in [ke-import-exclusions.csv](./ke-import-exclusions.csv). The machine-readable report is [ke-import-exclusion-report.json](./ke-import-exclusion-report.json).

### Legacy IDs by primary reason

- **NOT_DELIVERED (164)**: 43, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 196, 197, 198, 199, 201, 202, 204, 210, 211, 212, 213, 214, 248, 250, 407, 408, 409, 415, 520, 525, 619, 626, 633, 640, 675, 702, 722, 723, 729, 731, 754, 755, 756, 757, 758, 759, 760, 765, 778, 877, 878, 879, 894, 897, 898, 906, 912, 924, 925, 926, 937, 983, 998, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1018, 1021, 1022, 1023, 1026, 1027, 1028, 1029, 1032, 1033, 1037, 1041, 1042, 1043, 1044, 1045, 1046, 1047, 1048, 1049, 1050, 1098, 1105, 1130, 1131, 1133, 1134, 1136, 1139, 1141, 1142, 1145, 1148, 1149, 1153, 1154, 1155, 1156, 1157, 1158, 1159, 1162, 1163, 1164, 1165, 1166, 1167, 1168, 1169, 1170, 1171, 1172, 1173, 1174, 1175, 1177, 1178, 1179, 1181, 1182, 1183, 1184, 1185, 1186, 1187, 1188, 1189, 1190

- **HAS_REFUND (15)**: 238, 362, 421, 515, 574, 580, 616, 683, 753, 811, 827, 987, 1015, 1085, 1100

- **ITEM_SUBTOTAL_MISMATCH (20)**: 118, 154, 158, 159, 161, 216, 217, 591, 603, 628, 704, 919, 920, 936, 950, 997, 1083, 1099, 1102, 1112

- **UNRESOLVED_ITEM_PRICE (12)**: 145, 400, 406, 485, 672, 677, 712, 727, 771, 777, 989, 1117

- **MISSING_ORDER_HEADER (6)**: 41, 44, 51, 53, 60, 87

