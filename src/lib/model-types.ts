export type ModelChoice={id:string;name:string;provider:string;model:string;source:string;available:boolean;reason?:string;effort?:'low'|'high'|'max';isDefault?:boolean};
export type ModelInventory={models:ModelChoice[];defaultId:string;lawApiConnected:boolean;readOnly?:boolean;connections:{provider:string;name:string;connected:boolean;message:string}[]};
