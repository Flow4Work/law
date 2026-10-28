export async function readAnalysisStream(response:Response,onEvent:(event:any)=>void){
 if(!response.body)throw new Error('응답 연결을 받지 못했어요.');
 const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';
 try{while(true){const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});let end:number;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end).trimEnd();pending=pending.slice(end+1);if(line.startsWith('data: '))onEvent(JSON.parse(line.slice(6)))}if(done)break}if(pending.startsWith('data: '))onEvent(JSON.parse(pending.slice(6)))}finally{reader.releaseLock()}
}
