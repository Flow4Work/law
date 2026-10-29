// Node's native type stripping needs explicit resolution for the app's TS imports.
const {registerHooks}=require('node:module');
registerHooks({resolve(specifier,context,next){
 try{return next(specifier,context)}catch(error){
  if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);
  throw error;
 }
}});
