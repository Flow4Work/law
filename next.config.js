const {PHASE_DEVELOPMENT_SERVER}=require('next/constants');

/** Keep production builds from overwriting a running local development server. */
module.exports = phase=>({
 devIndicators:false,
 distDir:phase===PHASE_DEVELOPMENT_SERVER?'.next-dev':'.next',
 async headers(){
  const adminPath=process.env.LEGAL_ADMIN_PATH;
  if(!adminPath||!/^[a-zA-Z0-9_-]{24,100}$/.test(adminPath))return [];
  return [{source:`/${adminPath}/:path*`,headers:[{key:'Cache-Control',value:'private, no-store'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Frame-Options',value:'DENY'},{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'X-Content-Type-Options',value:'nosniff'}]}];
 }
});
