const {PHASE_DEVELOPMENT_SERVER}=require('next/constants');

/** Keep production builds from overwriting a running local development server. */
module.exports = phase=>({devIndicators:false,distDir:phase===PHASE_DEVELOPMENT_SERVER?'.next-dev':'.next'});
