const url='http://127.0.0.1:3700/api/intake';
const tests=[
 {label:'체불 초기',message:'퇴사했는데 아직 월급을 못 받았어요.'},
 {label:'판결 이후 집행',message:'회사에서 임금 체불로 이미 승소 판결을 받고 회사 은행계좌를 압류했지만 52원밖에 없고, 다른 압류한 코인 FANC가 있어요.'},
 {label:'보증금 계약 종료',message:'전세계약이 이미 끝났는데 보증금 3천만 원을 못 받았고, 다음 달에 이사해야 합니다.'},
 {label:'불송치 받은 사건',message:'고소인인데 경찰 불송치 결정 통지를 2026년 10월 15일 받았어요. 어떻게 해야 하나요?'}
];
(async()=>{
for (const test of tests){
 const started=Date.now();
 try{
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:test.message})});
  const data=await res.json();
  console.log(JSON.stringify({test:test.label,status:res.status,ms:Date.now()-started,mode:data.mode,question:data.plan?.questions?.[0],routes:data.plan?.routes?.map(r=>r.title)}));
 }catch(e){console.log(JSON.stringify({test:test.label,error:e.message}))}
}
})().catch(console.error);