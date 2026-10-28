# Seoul district boundaries

`seoul-districts.json` comes from [southkorea/seoul-maps](https://github.com/southkorea/seoul-maps), commit `dbb1dcde2e3c9937684c5a44ab9301888ad63ee6`, file `juso/2015/json/seoul_municipalities_geo_simple.json`.

Source: JUSO administrative district boundaries (2015). Published by Lucy Park and contributors under Apache 2.0; see `LICENSE-seoul-districts.txt`. The geometry is used only to classify an IP provider's approximate point. It does not verify a visitor's physical location. Boundary simplification can affect points near district borders.

No coordinates, IP addresses or queries are sent to a geocoding service. Only the derived district and its estimation source are stored with activity records.

## Seoul postcodes

`seoul-postal-districts.json` is derived from Korea Post's [regional postcode address database](https://www.epost.go.kr/search/zipcode/areacdAddressDown.jsp), [download](https://www.epost.go.kr/search/areacd/zipcode_DB.zip), published 2026-10-13 (addresses as of 2026-10-08), `서울특별시.txt`.

It contains 65 inclusive numeric ranges covering the 5,634 distinct postcodes present in the source. Only postcode and district columns are retained; unused gaps are preserved and no building addresses are included. ZIP entry names and text are CP949. A postcode provided by an IP database still estimates a network location, not the visitor's physical address.
