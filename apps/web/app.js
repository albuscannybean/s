import {bootstrapWorkspace} from '../../packages/ui/workspace-controller.js';

bootstrapWorkspace().then(controller=>{globalThis.lmnWorkspace=controller}).catch(error=>{
  console.error(error);
  const status=document.querySelector('#runtimeStatus');
  if(status)status.textContent=`Startup failed: ${error.message}`;
});
