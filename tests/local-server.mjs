import http from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {extname,join,normalize,sep} from 'node:path';

const portFlag=process.argv.indexOf('--port'),hostFlag=process.argv.indexOf('--host');
const root=process.cwd(),port=Number(portFlag>=0?process.argv[portFlag+1]:(process.argv[2]??4174)),host=hostFlag>=0?process.argv[hostFlag+1]:'127.0.0.1',mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(pathname==='/'){
      response.writeHead(302,{location:'/apps/web/'});response.end();return;
    }
    const relative=normalize(pathname).replace(/^[/\\]+/,'');
    let file=join(root,relative);
    if(file!==root&&!file.startsWith(root+sep)){
      response.writeHead(403);response.end('Forbidden');return;
    }
    if(statSync(file).isDirectory())file=join(file,'index.html');
    statSync(file);
    response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});
    createReadStream(file).pipe(response);
  }catch{
    response.writeHead(404);response.end('Not found');
  }
}).listen(port,host,()=>console.log(`LMN local QA server: http://${host}:${port}`));
