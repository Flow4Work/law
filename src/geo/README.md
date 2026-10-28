# Seoul district boundaries

`seoul-districts.json` comes from [southkorea/seoul-maps](https://github.com/southkorea/seoul-maps), commit `dbb1dcde2e3c9937684c5a44ab9301888ad63ee6`, file `juso/2015/json/seoul_municipalities_geo_simple.json`.

Source: JUSO administrative district boundaries (2015). Published by Lucy Park and contributors under Apache 2.0; see `LICENSE-seoul-districts.txt`. The geometry is used only to classify an IP provider's approximate point. It does not verify a visitor's physical location. Boundary simplification can affect points near district borders.

No coordinates, IP addresses or queries are stored with activity records. Only the derived district, its estimation source and the estimation confidence are stored.

## District estimation pipeline

Vercel's GeoIP headers alone cannot name a Seoul district: for almost every Korean
address `x-vercel-ip-city` is just `Seoul`, `x-vercel-ip-postal-code` is usually
empty, and `x-vercel-ip-latitude`/`x-vercel-ip-longitude` is a single shared city
centre point (37.5665, 126.9780) that falls inside 중구 for every visitor. Reporting
that point as a district is why every Seoul record used to read `서울특별시 중구`.

`src/lib/activity-location.ts` therefore collects several independent signals and
only reports a district that they support:

| Signal | Source | Weight |
| --- | --- | --- |
| Full five-digit postcode | `x-vercel-ip-postal-code` or the IP database | 6 |
| District naming city (`Nowon-gu`, `노원구`) | `x-vercel-ip-city` or the IP database | 4 |
| Coarse three-digit postcode prefix (`018xx`) | IP database `zip` | 3 |
| Approximate point inside a district polygon | either provider | 1 |

Rules:

* A point within 1.2 km of the Seoul centre is treated as "no information" and never
  produces a district.
* Evidence from both the Vercel headers and the IP database must agree before a
  district is reported with `정확도 높음`. A single provider is capped at `정확도 보통`,
  a bare point at `정확도 낮음`.
* Conflicting district evidence is never silently averaged: the strongest evidence is
  stored and the disagreement is written to `locationNote`.
* When nothing is known the record keeps `서울특별시` and says so, instead of guessing.

### Third-party IP database

When Vercel's headers do not identify a district the server asks
[ip-api.com](https://ip-api.com/docs/api:json) for that one visitor IP
(`city`, `zip`, coordinates, ISP, proxy/hosting flags) and maps the answer locally.
The visitor IP is therefore disclosed to that service; no query text, cookie or
coordinate is ever sent. Set `LEGAL_IP_LOOKUP=off` to keep lookups inside Vercel
only. Lookups are cached per IP for six hours, are skipped for private and
loopback addresses, time out after 2.5 seconds, and never block an activity record.
ip-api.com is free for non-commercial use only; review its terms before commercial use.

The response also records `isp`, `asn`, `networkType` (일반/모바일/데이터센터·VPN) and
`networkRisk` so a proxied or datacenter IP can be recognised instead of trusted.

### Browser-verified district

Free IP databases disagree with each other by several kilometres inside Seoul, and
Vercel's Korean postcode is usually the capital's registration postcode rather than
the visitor's own. The only exact source is the visitor's device.

The private console therefore offers **내 위치로 구 확인**. The browser reports its
position once, the server converts it to a district with the same boundary polygons
and keeps only the district name — the coordinates are never written anywhere — under
`activity/verified/<hashed ip>.enc`. Every later activity from that network address
is recorded as `verified` with `정확도 높음`, and the console shows the evidence as
`브라우저 위치 확인`.

## Seoul postcodes

`seoul-postal-districts.json` is derived from Korea Post's [regional postcode address database](https://www.epost.go.kr/search/zipcode/areacdAddressDown.jsp), [download](https://www.epost.go.kr/search/areacd/zipcode_DB.zip), published 2026-10-13 (addresses as of 2026-10-08), `서울특별시.txt`.

It contains 65 inclusive numeric ranges covering the 5,634 distinct postcodes present in the source. Only postcode and district columns are retained; unused gaps are preserved and no building addresses are included. ZIP entry names and text are CP949. A postcode provided by an IP database still estimates a network location, not the visitor's physical address.
