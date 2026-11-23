const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const view=fs.readFileSync(path.join(root,'src/features/private-activity/sph-guide-panel.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'src/features/private-activity/sph-panel.css'),'utf8');

test('Guide detail table keeps compact fixed columns without modifying sales table',()=>{
 assert.match(css,/\.sph-simple \.private-records \.sph-guide-events-table\{[^}]*min-width:790px;table-layout:fixed/);
 assert.match(css,/\.sph-simple \.private-records \.sph-guide-events-table th:nth-child\(1\)\{width:195px\}/);
 assert.match(css,/\.sph-simple \.private-records \.sph-guide-events-table th:nth-child\(2\)\{width:255px\}/);
 assert.match(css,/\.sph-simple \.private-records \.sph-guide-events-table th:nth-child\(3\)\{width:126px\}/);
 assert.match(css,/\.sph-simple \.private-records \.sph-guide-events-table td\{[^}]*padding:10px 15px/);
 assert.match(css,/\.sph-guide-ip-line\{display:flex;align-items:center/);
 assert.match(view,/className="sph-guide-ip-line"/);
 assert.match(view,/activityDeviceLabel\(event\.ip\)/);
 assert.match(css,/\.sph-guide-detail-text\{[^}]*-webkit-line-clamp:2/);
 assert.match(view,/title=\{event\.detail\}/);
});
